/**
 * ProjectBrain — Phase 12.5.
 *
 * Turns a Project row into a living workspace by aggregating every
 * signal Memlace already collects (conversations, knowledge, decisions,
 * goals, memories, project detection) into a single view-model.
 *
 * The service is READ-ONLY. Every ingredient is derived from existing
 * indexes — no new Dexie tables, no new observers. Results are cached
 * in memory per project and invalidated by the background pipeline in
 * `conversations.ts` when anything upstream changes.
 */
import { db } from "@/lib/db";
import type {
  KnowledgeCodeBlock,
  KnowledgeLink,
  KnowledgeRecord,
} from "@/knowledge/types";
import type {
  Memory,
  Project,
  StoredConversation,
  StoredConvMessage,
} from "@/types";
import { extractDecisions } from "@/context/DecisionExtractor";
import { detectGoals } from "@/context/GoalDetector";
import type { DetectedGoal, ExtractedDecision } from "@/context/types";
import {
  allProjectMappings,
  conversationsForProject,
} from "@/services/projectDetection";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type ProjectHealth =
  | "planning"
  | "in-progress"
  | "testing"
  | "ready-to-deploy"
  | "maintaining";

export interface ProjectBrain {
  project: Project;
  status: ProjectHealth;
  statusLabel: string;
  /** ≤ 10 short lines; safe to render as-is. */
  summary: string[];
  knowledge: {
    technologies: string[];
    languages: string[];
    topics: string[];
    entities: string[];
    codeSnippets: KnowledgeCodeBlock[];
    links: KnowledgeLink[];
  };
  /** Sorted newest-first; supersedes chains preserved for history. */
  decisions: ExtractedDecision[];
  goals: DetectedGoal[];
  /** Chronological (newest first) capped list — the "project timeline". */
  timeline: {
    id: string;
    ts: number;
    conversation: StoredConversation;
  }[];
  related: {
    conversations: StoredConversation[];
    projects: { project: Project; sharedTech: string[] }[];
  };
  counts: {
    conversations: number;
    memories: number;
    knowledgeItems: number;
    decisions: number;
    goals: number;
  };
  builtAt: number;
}

/* ------------------------------------------------------------------ *
 * Cache
 * ------------------------------------------------------------------ */

const CACHE = new Map<string, ProjectBrain>();
const INFLIGHT = new Map<string, Promise<ProjectBrain>>();
/** Monotonic version — bumped on any pipeline write. */
let VERSION = 0;
const VERSIONS = new Map<string, number>();

export function invalidateProjectBrain(projectId?: string): void {
  VERSION += 1;
  if (projectId) {
    CACHE.delete(projectId);
    VERSIONS.delete(projectId);
  } else {
    CACHE.clear();
    VERSIONS.clear();
  }
}

/* ------------------------------------------------------------------ *
 * Health heuristic
 * ------------------------------------------------------------------ */

const DEPLOY_HINTS =
  /\b(deploy(ed|ment)?|shipped|vercel|netlify|cloudflare|production|prod\b|release|published)\b/i;
const TEST_HINTS = /\b(test(s|ing|ed)?|qa\b|regression|coverage|jest|vitest|playwright)\b/i;
const BUILD_HINTS = /\b(implement|build|refactor|feature|component|api|schema|migration)\b/i;
const PLAN_HINTS = /\b(plan|design|architecture|spec|proposal|research|explore|idea)\b/i;

function scoreHealth(text: string): ProjectHealth {
  const isDeploy = DEPLOY_HINTS.test(text);
  const isTest = TEST_HINTS.test(text);
  const isBuild = BUILD_HINTS.test(text);
  const isPlan = PLAN_HINTS.test(text);
  if (isDeploy && isTest) return "ready-to-deploy";
  if (isDeploy && !isBuild) return "maintaining";
  if (isTest) return "testing";
  if (isBuild) return "in-progress";
  if (isPlan) return "planning";
  return "in-progress";
}

const HEALTH_LABEL: Record<ProjectHealth, string> = {
  planning: "Planning",
  "in-progress": "In Progress",
  testing: "Testing",
  "ready-to-deploy": "Ready to Deploy",
  maintaining: "Maintaining",
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function dedupe<T>(arr: T[], limit = 24): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    const key = typeof v === "string" ? v.toLowerCase() : JSON.stringify(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

function countMap(strings: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of strings) {
    const k = s.toLowerCase().trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function topN(m: Map<string, number>, n: number): string[] {
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/* ------------------------------------------------------------------ *
 * Core builder
 * ------------------------------------------------------------------ */

async function build(project: Project): Promise<ProjectBrain> {
  // 1. Ingredients — parallel reads over already-indexed tables.
  const [detectedIds, memoriesForProject, allProjects] = await Promise.all([
    conversationsForProject(project.id).catch(() => [] as string[]),
    db.memories
      .where("projectId")
      .equals(project.id)
      .and((m) => !m.trashed)
      .toArray()
      .catch(() => [] as Memory[]),
    db.projects.toArray().catch(() => [] as Project[]),
  ]);

  const convIds = Array.from(new Set(detectedIds));
  const conversations = convIds.length
    ? (await db.conversations.bulkGet(convIds)).filter(
        (c): c is StoredConversation => !!c,
      )
    : [];
  conversations.sort((a, b) => b.updatedAt - a.updatedAt);

  const knowledgeRows = convIds.length
    ? await db.knowledge
        .where("conversationId")
        .anyOf(convIds)
        .toArray()
        .catch(() => [] as KnowledgeRecord[])
    : [];

  // 2. Aggregate knowledge facets.
  const techCounts = countMap(knowledgeRows.flatMap((k) => k.technologies ?? []));
  const langCounts = countMap(knowledgeRows.flatMap((k) => k.languages ?? []));
  const topicCounts = countMap(knowledgeRows.flatMap((k) => k.topics ?? []));
  const entityCounts = countMap(knowledgeRows.flatMap((k) => k.entities ?? []));

  const codeSnippets: KnowledgeCodeBlock[] = dedupe(
    knowledgeRows.flatMap((k) => k.codeBlocks ?? []),
    12,
  );
  const links: KnowledgeLink[] = dedupe(
    knowledgeRows.flatMap((k) => k.links ?? []),
    12,
  );

  // 3. Decisions + goals — extract from the most recent 20 conversations'
  //    messages so we don't scan the whole corpus.
  const recentIds = conversations.slice(0, 20).map((c) => c.id);
  const messages: StoredConvMessage[] = recentIds.length
    ? await db.convMessages
        .where("conversationId")
        .anyOf(recentIds)
        .toArray()
    : [];
  const byConv = new Map<string, StoredConvMessage[]>();
  for (const m of messages) {
    const arr = byConv.get(m.conversationId) ?? [];
    arr.push(m);
    byConv.set(m.conversationId, arr);
  }
  const decisionsRaw: ExtractedDecision[] = [];
  const goalsRaw: DetectedGoal[] = [];
  for (const [cid, msgs] of byConv) {
    msgs.sort((a, b) => a.order - b.order);
    decisionsRaw.push(...extractDecisions(cid, msgs));
    goalsRaw.push(...detectGoals(cid, msgs, 3));
  }

  // Dedupe decisions across conversations, keep newest per subject.
  const decisionBySubject = new Map<string, ExtractedDecision>();
  for (const d of decisionsRaw.sort((a, b) => a.detectedAt - b.detectedAt)) {
    const key = `${d.polarity === "reject" ? "!" : ""}${d.statement
      .toLowerCase()
      .replace(/^(?:use|adopt|pick|choose|drop|avoid|not\s+use)\s+/i, "")
      .slice(0, 60)}`;
    const prev = decisionBySubject.get(key);
    if (prev) d.supersedes = prev.id;
    decisionBySubject.set(key, d);
  }
  const decisions = [...decisionBySubject.values()]
    .sort((a, b) => b.detectedAt - a.detectedAt)
    .slice(0, 30);

  // Dedupe goals by label.
  const seenGoals = new Set<string>();
  const goals: DetectedGoal[] = [];
  for (const g of goalsRaw.sort((a, b) => b.updatedAt - a.updatedAt)) {
    const key = g.label.toLowerCase().slice(0, 60);
    if (seenGoals.has(key)) continue;
    seenGoals.add(key);
    goals.push(g);
    if (goals.length >= 12) break;
  }

  // 4. Health — cheap heuristic over recent decisions + goals + titles.
  const healthCorpus = [
    ...decisions.map((d) => d.statement),
    ...goals.map((g) => `${g.label} ${g.status}`),
    ...conversations.slice(0, 10).map((c) => c.title || ""),
  ]
    .join(" ")
    .toLowerCase();
  const status = scoreHealth(healthCorpus);

  // 5. Related projects — projects that share at least one top technology.
  const myTech = new Set(topN(techCounts, 8));
  const relatedProjects: { project: Project; sharedTech: string[] }[] = [];
  if (myTech.size) {
    const mappingByConv = await allProjectMappings().catch(() => ({}));
    const projConvIds = new Map<string, string[]>();
    for (const [convId, entry] of Object.entries(mappingByConv)) {
      if (!entry?.projectId || entry.projectId === project.id) continue;
      const arr = projConvIds.get(entry.projectId) ?? [];
      arr.push(convId);
      projConvIds.set(entry.projectId, arr);
    }
    for (const other of allProjects) {
      if (other.id === project.id) continue;
      const ids = projConvIds.get(other.id);
      if (!ids?.length) continue;
      const rows = await db.knowledge
        .where("conversationId")
        .anyOf(ids)
        .toArray()
        .catch(() => [] as KnowledgeRecord[]);
      const shared = new Set<string>();
      for (const r of rows) {
        for (const t of r.technologies ?? []) {
          const tl = t.toLowerCase();
          if (myTech.has(tl)) shared.add(t);
        }
      }
      if (shared.size) {
        relatedProjects.push({ project: other, sharedTech: [...shared].slice(0, 6) });
      }
      if (relatedProjects.length >= 6) break;
    }
  }

  // 6. Summary (≤ 10 lines, terse).
  const latestConv = conversations[0];
  const activeGoals = goals.filter((g) => g.status === "active");
  const latestDecision = decisions[0];
  const stack = topN(techCounts, 5);
  const summary: string[] = [];
  if (activeGoals[0]) summary.push(`Objective: ${activeGoals[0].label}`);
  if (stack.length) summary.push(`Stack: ${stack.join(", ")}`);
  if (latestConv)
    summary.push(
      `Latest activity: ${latestConv.title || "Untitled"} · ${new Date(latestConv.updatedAt).toLocaleDateString()}`,
    );
  if (latestDecision)
    summary.push(
      `Latest decision: ${latestDecision.polarity === "reject" ? "Rejected" : latestDecision.polarity === "complete" ? "Completed" : "Adopted"} — ${latestDecision.statement}`,
    );
  const openGoal = activeGoals.find((g) => g !== activeGoals[0]);
  if (openGoal) summary.push(`Open: ${openGoal.label}`);
  if (codeSnippets.length) summary.push(`Code snippets tracked: ${codeSnippets.length}`);
  summary.push(
    `Knowledge: ${knowledgeRows.length} conversations indexed, ${topN(topicCounts, 3).join(", ") || "no topics yet"}.`,
  );
  summary.push(
    `Memory: ${conversations.length} conversations · ${memoriesForProject.length} notes.`,
  );
  summary.push(`Status: ${HEALTH_LABEL[status]}.`);
  const trimmedSummary = summary.slice(0, 10);

  const brain: ProjectBrain = {
    project,
    status,
    statusLabel: HEALTH_LABEL[status],
    summary: trimmedSummary,
    knowledge: {
      technologies: topN(techCounts, 16),
      languages: topN(langCounts, 10),
      topics: topN(topicCounts, 16),
      entities: topN(entityCounts, 20),
      codeSnippets,
      links,
    },
    decisions,
    goals,
    timeline: conversations.slice(0, 40).map((c) => ({
      id: c.id,
      ts: c.updatedAt,
      conversation: c,
    })),
    related: {
      conversations: conversations.slice(0, 8),
      projects: relatedProjects,
    },
    counts: {
      conversations: conversations.length,
      memories: memoriesForProject.length,
      knowledgeItems: knowledgeRows.length,
      decisions: decisions.length,
      goals: goals.length,
    },
    builtAt: Date.now(),
  };
  return brain;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export async function getProjectBrain(project: Project): Promise<ProjectBrain> {
  const cached = CACHE.get(project.id);
  const v = VERSIONS.get(project.id);
  if (cached && v === VERSION) return cached;

  const existing = INFLIGHT.get(project.id);
  if (existing) return existing;

  const p = build(project).then((res) => {
    CACHE.set(project.id, res);
    VERSIONS.set(project.id, VERSION);
    INFLIGHT.delete(project.id);
    return res;
  });
  INFLIGHT.set(project.id, p);
  return p;
}

/** Render the summary as a copy-pastable Markdown blob. */
export function renderProjectSummary(brain: ProjectBrain): string {
  const { project, statusLabel, summary, knowledge, goals, decisions } = brain;
  const lines: string[] = [];
  lines.push(`# ${project.name}`);
  lines.push(`_Status: ${statusLabel}_`);
  lines.push("");
  lines.push("## Summary");
  for (const s of summary) lines.push(`- ${s}`);
  if (knowledge.technologies.length) {
    lines.push("", "## Stack");
    lines.push(knowledge.technologies.join(", "));
  }
  if (goals.length) {
    lines.push("", "## Goals");
    for (const g of goals) lines.push(`- [${g.status === "completed" ? "x" : " "}] ${g.label}`);
  }
  if (decisions.length) {
    lines.push("", "## Decisions");
    for (const d of decisions.slice(0, 10)) {
      const mark = d.polarity === "reject" ? "✗" : d.polarity === "complete" ? "✓" : "→";
      lines.push(`- ${mark} ${d.statement}`);
    }
  }
  return lines.join("\n");
}
