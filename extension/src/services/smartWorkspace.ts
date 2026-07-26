/**
 * SmartWorkspace — Phase 12.7.
 *
 * A calm, proactive layer on top of Memlace's existing indexes. Turns
 * silent memory into gentle guidance: what to continue, what to finish,
 * what today looked like, which projects quietly relate.
 *
 * Design invariants:
 * - READ-ONLY. Never mutates conversations, memories, or projects.
 * - No new observers. All signals come from existing tables + the
 *   Project Brain cache.
 * - Deterministic + local. Never calls a remote model.
 * - Portable: nothing here touches DOM or chrome.* — so the engine can
 *   later back a desktop, VS Code, or mobile surface unchanged.
 */
import { db } from "@/lib/db";
import type {
  Memory,
  Project,
  ProviderId,
  StoredConversation,
  StoredConvMessage,
} from "@/types";
import type { KnowledgeRecord } from "@/knowledge/types";
import { extractDecisions } from "@/context/DecisionExtractor";
import { detectGoals } from "@/context/GoalDetector";
import type { DetectedGoal, ExtractedDecision } from "@/context/types";
import { allProjectMappings } from "@/services/projectDetection";
import { getContinueHistory } from "@/services/continueHistory";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface ContinueItem {
  id: string;
  conversationId: string;
  conversationTitle: string;
  provider: ProviderId;
  projectId?: string;
  projectName?: string;
  lastActive: number;
  /** Short human phrase (e.g. "Architecture complete"). */
  progress?: string;
  /** One imperative sentence, always derived. */
  nextAction?: string;
  reason: "unfinished" | "recent-focus" | "recently-continued";
}

export interface FocusChip {
  label: string;
  count: number;
  kind: "technology" | "topic";
}

export interface NextActionSuggestion {
  text: string;
  sourceConversationId?: string;
  sourceProjectId?: string;
  confidence: "low" | "medium" | "high";
}

export interface NeedsAttentionItem {
  conversationId: string;
  title: string;
  provider: ProviderId;
  lastActive: number;
  reason: "todo" | "unresolved" | "unanswered-question" | "incomplete-deploy" | "bug-open";
  hint: string;
  projectId?: string;
  projectName?: string;
}

export interface DailyDigest {
  conversationsToday: number;
  projectsUpdated: number;
  goalsCompleted: number;
  decisionsRecorded: number;
  focusChips: string[];
}

export interface CrossProjectLink {
  topic: string;
  projects: { id: string; name: string }[];
}

export interface ProjectRanking {
  id: string;
  score: number;
  reason: "frequent" | "long-running" | "recently-continued" | "recent";
}

export interface Workspace {
  builtAt: number;
  continueWorking: ContinueItem[];
  recentFocus: FocusChip[];
  nextAction?: NextActionSuggestion;
  needsAttention: NeedsAttentionItem[];
  daily: DailyDigest;
  crossProject: CrossProjectLink[];
  ranking: ProjectRanking[];
  everythingSynced: boolean;
  lastSyncAt?: number;
  tookMs: number;
}

/* ------------------------------------------------------------------ *
 * Cache — one workspace-wide snapshot, invalidated by the pipeline.
 * ------------------------------------------------------------------ */

let CACHE: Workspace | null = null;
let CACHE_VERSION = 0;
let CACHE_AT = 0;
const TTL_MS = 30_000;

export function invalidateWorkspace(): void {
  CACHE_VERSION += 1;
  CACHE = null;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function humanAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} week${wk === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}

function joinList(xs: string[], max = 3): string {
  const trimmed = xs.slice(0, max);
  return trimmed.join(", ") + (xs.length > max ? "…" : "");
}

function first<T>(xs: T[]): T | undefined {
  return xs.length ? xs[0] : undefined;
}

/* ------------------------------------------------------------------ *
 * Attention heuristics — regexes reused across items.
 * ------------------------------------------------------------------ */

const R_TODO = /\b(TODO|FIXME|@?todo|next\s+step|next\s+time|later[:,]?\s+)/i;
const R_UNRESOLVED =
  /\b(still\s+(?:broken|failing|not\s+working)|not\s+fixed|still\s+errors?|unresolved|blocked)\b/i;
const R_DEPLOY = /\b(deploy|ship|publish|release|push\s+to\s+prod)\b/i;
const R_DEPLOY_DONE =
  /\b(deployed|shipped|published|released|live\s+in\s+prod|in\s+production)\b/i;
const R_BUG = /\b(bug|error|exception|traceback|crash|500|nullpointer)\b/i;
const R_BUG_DONE = /\b(fixed|resolved|patched|works\s+now|solved)\b/i;

function classifyAttention(
  conv: StoredConversation,
  lastText: string,
): { reason: NeedsAttentionItem["reason"]; hint: string } | null {
  const t = lastText.toLowerCase();
  const endsWithQuestion = /\?\s*$/.test(lastText.trim());
  if (R_UNRESOLVED.test(t))
    return { reason: "unresolved", hint: "Marked unresolved in the last messages." };
  if (R_BUG.test(t) && !R_BUG_DONE.test(t))
    return { reason: "bug-open", hint: "A bug was raised but not marked fixed." };
  if (R_DEPLOY.test(t) && !R_DEPLOY_DONE.test(t))
    return { reason: "incomplete-deploy", hint: "Deployment discussed but not confirmed." };
  if (R_TODO.test(lastText))
    return { reason: "todo", hint: "Contains a TODO or pending next step." };
  if (endsWithQuestion && conv.messageCount >= 2)
    return { reason: "unanswered-question", hint: "Ended on an open question." };
  return null;
}

/* ------------------------------------------------------------------ *
 * Next-action synthesis — heuristic sentences, never invented content.
 * ------------------------------------------------------------------ */

function nextActionFromGoal(g: DetectedGoal): string {
  const verb = /^(deploy|ship|test|fix|write|implement|build|research)/i.exec(g.label);
  const body = g.label.replace(/^(please|help me|let's|we should)\s+/i, "");
  if (verb) return `${verb[0][0].toUpperCase()}${verb[0].slice(1).toLowerCase()} ${body.replace(verb[0], "").trim()}`.trim();
  return `Continue: ${body}`;
}

function nextActionFromDecision(d: ExtractedDecision): string | null {
  if (d.polarity === "unresolved") return `Resolve: ${d.statement}`;
  if (d.polarity === "adopt") return `Follow through on: ${d.statement}`;
  return null;
}

function nextActionFromAttention(a: NeedsAttentionItem): string {
  switch (a.reason) {
    case "todo":
      return `Address the TODO in "${a.title}"`;
    case "unresolved":
      return `Revisit the unresolved thread in "${a.title}"`;
    case "unanswered-question":
      return `Answer the open question in "${a.title}"`;
    case "incomplete-deploy":
      return `Finish deployment discussed in "${a.title}"`;
    case "bug-open":
      return `Reproduce and fix the bug from "${a.title}"`;
  }
}

/* ------------------------------------------------------------------ *
 * Core builder
 * ------------------------------------------------------------------ */

async function build(): Promise<Workspace> {
  const started = performance.now();

  const [conversations, projects, memories, knowledgeRows, mappings, history] =
    await Promise.all([
      db.conversations.toArray().catch(() => [] as StoredConversation[]),
      db.projects.toArray().catch(() => [] as Project[]),
      db.memories.toArray().catch(() => [] as Memory[]),
      db.knowledge.toArray().catch(() => [] as KnowledgeRecord[]),
      allProjectMappings().catch(
        () =>
          ({}) as Record<
            string,
            { projectId: string | null; reason: string; ts: number }
          >,
      ),
      getContinueHistory().catch(() => []),
    ]);

  const now = Date.now();
  const todayStart = startOfToday();
  const projectById = new Map(projects.map((p) => [p.id, p] as const));
  const knowledgeByConv = new Map(knowledgeRows.map((k) => [k.conversationId, k] as const));
  const convById = new Map(conversations.map((c) => [c.id, c] as const));

  // Sort conversations by recency for downstream slices.
  conversations.sort((a, b) => b.updatedAt - a.updatedAt);

  // Recent tail scanned for messages — cap to keep work bounded.
  const recent = conversations.slice(0, 25);
  const recentIds = recent.map((c) => c.id);
  const recentMessages: StoredConvMessage[] = recentIds.length
    ? await db.convMessages
        .where("conversationId")
        .anyOf(recentIds)
        .toArray()
        .catch(() => [])
    : [];
  const msgsByConv = new Map<string, StoredConvMessage[]>();
  for (const m of recentMessages) {
    const arr = msgsByConv.get(m.conversationId) ?? [];
    arr.push(m);
    msgsByConv.set(m.conversationId, arr);
  }
  for (const arr of msgsByConv.values()) arr.sort((a, b) => a.order - b.order);

  // ------------------------------------------------------------------
  // Needs Attention — scan the last 2 messages of each recent conv.
  // ------------------------------------------------------------------
  const attention: NeedsAttentionItem[] = [];
  for (const conv of recent) {
    const msgs = msgsByConv.get(conv.id) ?? [];
    if (!msgs.length) continue;
    const tail = msgs.slice(-2).map((m) => m.markdown || m.content || "").join("\n");
    if (!tail.trim()) continue;
    const cls = classifyAttention(conv, tail.slice(-1200));
    if (!cls) continue;
    const projId = mappings[conv.id]?.projectId ?? undefined;
    attention.push({
      conversationId: conv.id,
      title: conv.title || "Untitled",
      provider: conv.provider,
      lastActive: conv.updatedAt,
      reason: cls.reason,
      hint: cls.hint,
      projectId: projId ?? undefined,
      projectName: projId ? projectById.get(projId)?.name : undefined,
    });
    if (attention.length >= 8) break;
  }

  // ------------------------------------------------------------------
  // Decisions + goals extracted from recent conversations — reused for
  // Next Action and Continue Working "progress" chips.
  // ------------------------------------------------------------------
  const decisions: ExtractedDecision[] = [];
  const goals: DetectedGoal[] = [];
  for (const [cid, msgs] of msgsByConv) {
    decisions.push(...extractDecisions(cid, msgs));
    goals.push(...detectGoals(cid, msgs, 3));
  }
  decisions.sort((a, b) => b.detectedAt - a.detectedAt);
  goals.sort((a, b) => b.updatedAt - a.updatedAt);

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedToday = goals.filter(
    (g) => g.status === "completed" && g.updatedAt >= todayStart,
  );

  // Latest decision per conversation — used as a "progress" hint.
  const decisionByConv = new Map<string, ExtractedDecision>();
  for (const d of decisions) {
    if (!decisionByConv.has(d.conversationId)) decisionByConv.set(d.conversationId, d);
  }

  // ------------------------------------------------------------------
  // Continue Working — merge three signals, dedupe by conversation.
  // ------------------------------------------------------------------
  const continueSet = new Map<string, ContinueItem>();
  const pushContinue = (item: ContinueItem) => {
    const prev = continueSet.get(item.conversationId);
    if (!prev || prev.lastActive < item.lastActive) continueSet.set(item.conversationId, item);
  };

  // (a) Recently continued via Continue Anywhere — highest intent signal.
  for (const h of history.slice(0, 6)) {
    const conv = convById.get(h.conversationId);
    if (!conv) continue;
    const projId = mappings[conv.id]?.projectId ?? undefined;
    pushContinue({
      id: `hx_${h.id}`,
      conversationId: conv.id,
      conversationTitle: conv.title || h.conversationTitle,
      provider: conv.provider,
      projectId: projId ?? undefined,
      projectName: projId ? projectById.get(projId)?.name : undefined,
      lastActive: h.at,
      progress: describeProgress(conv, decisionByConv.get(conv.id)),
      reason: "recently-continued",
    });
  }

  // (b) Unfinished — the top of needs-attention doubles as continue-work.
  for (const a of attention.slice(0, 4)) {
    pushContinue({
      id: `att_${a.conversationId}`,
      conversationId: a.conversationId,
      conversationTitle: a.title,
      provider: a.provider,
      projectId: a.projectId,
      projectName: a.projectName,
      lastActive: a.lastActive,
      progress: a.hint,
      nextAction: nextActionFromAttention(a),
      reason: "unfinished",
    });
  }

  // (c) Simple recency fill — so users always see 3 items.
  for (const conv of recent) {
    if (continueSet.size >= 5) break;
    if (continueSet.has(conv.id)) continue;
    const projId = mappings[conv.id]?.projectId ?? undefined;
    pushContinue({
      id: `rec_${conv.id}`,
      conversationId: conv.id,
      conversationTitle: conv.title || "Untitled",
      provider: conv.provider,
      projectId: projId ?? undefined,
      projectName: projId ? projectById.get(projId)?.name : undefined,
      lastActive: conv.updatedAt,
      progress: describeProgress(conv, decisionByConv.get(conv.id)),
      reason: "recent-focus",
    });
  }
  const continueWorking = [...continueSet.values()]
    .sort((a, b) => rankContinue(b) - rankContinue(a) || b.lastActive - a.lastActive)
    .slice(0, 5);

  // ------------------------------------------------------------------
  // Recent Focus — top technologies + topics from last-7d knowledge.
  // ------------------------------------------------------------------
  const focusWindow = now - 7 * DAY_MS;
  const focusTech = new Map<string, number>();
  const focusTopic = new Map<string, number>();
  for (const conv of conversations) {
    if (conv.updatedAt < focusWindow) continue;
    const k = knowledgeByConv.get(conv.id);
    if (!k) continue;
    for (const t of k.technologies ?? []) focusTech.set(t, (focusTech.get(t) ?? 0) + 1);
    for (const t of k.topics ?? []) focusTopic.set(t, (focusTopic.get(t) ?? 0) + 1);
  }
  const recentFocus: FocusChip[] = [
    ...[...focusTech.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count, kind: "technology" as const })),
    ...[...focusTopic.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count, kind: "topic" as const })),
  ].slice(0, 6);

  // ------------------------------------------------------------------
  // Next Action — one derived, evidence-backed sentence.
  // ------------------------------------------------------------------
  let nextAction: NextActionSuggestion | undefined;
  const topAttention = first(attention);
  const topGoal = first(activeGoals);
  const unresolvedDecision = decisions.find((d) => d.polarity === "unresolved");
  if (topAttention) {
    const projId = topAttention.projectId;
    nextAction = {
      text: nextActionFromAttention(topAttention),
      sourceConversationId: topAttention.conversationId,
      sourceProjectId: projId,
      confidence: "high",
    };
  } else if (topGoal) {
    nextAction = {
      text: nextActionFromGoal(topGoal),
      sourceConversationId: topGoal.conversationId,
      confidence: "medium",
    };
  } else if (unresolvedDecision) {
    const text = nextActionFromDecision(unresolvedDecision);
    if (text)
      nextAction = {
        text,
        sourceConversationId: unresolvedDecision.conversationId,
        confidence: "medium",
      };
  } else if (continueWorking[0]) {
    const c = continueWorking[0];
    nextAction = {
      text: `Continue "${c.conversationTitle}"`,
      sourceConversationId: c.conversationId,
      sourceProjectId: c.projectId,
      confidence: "low",
    };
  }

  // ------------------------------------------------------------------
  // Daily Digest — cheap counters.
  // ------------------------------------------------------------------
  const convsToday = conversations.filter((c) => c.updatedAt >= todayStart);
  const projectsUpdatedToday = new Set<string>();
  for (const c of convsToday) {
    const pid = mappings[c.id]?.projectId;
    if (pid) projectsUpdatedToday.add(pid);
  }
  const decisionsToday = decisions.filter((d) => d.detectedAt >= todayStart).length;
  const daily: DailyDigest = {
    conversationsToday: convsToday.length,
    projectsUpdated: projectsUpdatedToday.size,
    goalsCompleted: completedToday.length,
    decisionsRecorded: decisionsToday,
    focusChips: recentFocus.slice(0, 3).map((f) => f.label),
  };

  // ------------------------------------------------------------------
  // Cross-project connections — shared technologies across ≥2 projects.
  // ------------------------------------------------------------------
  const techByProject = new Map<string, Set<string>>();
  for (const [convId, entry] of Object.entries(mappings)) {
    const pid = entry?.projectId;
    if (!pid) continue;
    const k = knowledgeByConv.get(convId);
    if (!k) continue;
    const set = techByProject.get(pid) ?? new Set<string>();
    for (const t of k.technologies ?? []) set.add(t);
    techByProject.set(pid, set);
  }
  const projectsPerTech = new Map<string, Set<string>>();
  for (const [pid, techs] of techByProject) {
    for (const t of techs) {
      const set = projectsPerTech.get(t) ?? new Set<string>();
      set.add(pid);
      projectsPerTech.set(t, set);
    }
  }
  const crossProject: CrossProjectLink[] = [];
  for (const [topic, pids] of projectsPerTech) {
    if (pids.size < 2) continue;
    const projectList = [...pids]
      .map((id) => projectById.get(id))
      .filter((p): p is Project => !!p)
      .slice(0, 4)
      .map((p) => ({ id: p.id, name: p.name }));
    if (projectList.length < 2) continue;
    crossProject.push({ topic, projects: projectList });
  }
  crossProject.sort((a, b) => b.projects.length - a.projects.length);
  const crossProjectTop = crossProject.slice(0, 4);

  // ------------------------------------------------------------------
  // Smart ranking — used by the UI to reorder project lists.
  // Explicit pinned/favorite items are untouched by callers; this is
  // only a ranking hint.
  // ------------------------------------------------------------------
  const convsByProject = new Map<string, StoredConversation[]>();
  for (const c of conversations) {
    const pid = mappings[c.id]?.projectId;
    if (!pid) continue;
    const arr = convsByProject.get(pid) ?? [];
    arr.push(c);
    convsByProject.set(pid, arr);
  }
  const recentContinuedProjects = new Set<string>();
  for (const h of history.slice(0, 10)) {
    const pid = mappings[h.conversationId]?.projectId;
    if (pid) recentContinuedProjects.add(pid);
  }
  const ranking: ProjectRanking[] = projects.map((p) => {
    const convs = convsByProject.get(p.id) ?? [];
    if (!convs.length) return { id: p.id, score: 0, reason: "recent" };
    const freq = convs.length;
    const newest = Math.max(...convs.map((c) => c.updatedAt));
    const oldest = Math.min(...convs.map((c) => c.createdAt));
    const spanDays = Math.max(1, (newest - oldest) / DAY_MS);
    const recency = Math.max(0, 30 - (now - newest) / DAY_MS);
    const continuedBoost = recentContinuedProjects.has(p.id) ? 20 : 0;
    const score =
      recency * 2 + Math.log2(freq + 1) * 6 + Math.log2(spanDays + 1) * 2 + continuedBoost;
    const reason: ProjectRanking["reason"] = continuedBoost
      ? "recently-continued"
      : freq >= 6
        ? "frequent"
        : spanDays > 14
          ? "long-running"
          : "recent";
    return { id: p.id, score, reason };
  });
  ranking.sort((a, b) => b.score - a.score);

  // ------------------------------------------------------------------
  // Sync indicator — last capture time.
  // ------------------------------------------------------------------
  const lastSyncAt = conversations[0]?.lastSyncAt ?? conversations[0]?.updatedAt;
  const everythingSynced = !lastSyncAt || now - lastSyncAt < 5 * 60_000;

  const tookMs = Math.round(performance.now() - started);
  const workspace: Workspace = {
    builtAt: now,
    continueWorking,
    recentFocus,
    nextAction,
    needsAttention: attention.slice(0, 5),
    daily,
    crossProject: crossProjectTop,
    ranking,
    everythingSynced,
    lastSyncAt,
    tookMs,
  };
  // Silence unused-var lint for helpers.
  void memories;
  return workspace;
}

function describeProgress(
  conv: StoredConversation,
  decision?: ExtractedDecision,
): string | undefined {
  if (decision) {
    const verb =
      decision.polarity === "reject"
        ? "Rejected"
        : decision.polarity === "complete"
          ? "Completed"
          : decision.polarity === "unresolved"
            ? "Open"
            : "Decided";
    return `${verb}: ${decision.statement.slice(0, 80)}`;
  }
  if (conv.messageCount)
    return `${conv.messageCount} message${conv.messageCount === 1 ? "" : "s"} · last active ${humanAgo(conv.updatedAt)}`;
  return undefined;
}

function rankContinue(item: ContinueItem): number {
  return item.reason === "unfinished" ? 3 : item.reason === "recently-continued" ? 2 : 1;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export async function getWorkspace(force = false): Promise<Workspace> {
  const fresh =
    !force &&
    CACHE &&
    CACHE_AT === CACHE_VERSION &&
    Date.now() - CACHE.builtAt < TTL_MS;
  if (fresh && CACHE) return CACHE;
  const w = await build();
  CACHE = w;
  CACHE_AT = CACHE_VERSION;
  return w;
}

export { humanAgo };
