/**
 * AnswerEngine — Phase 12.6.
 *
 * Personal Intelligence layer for Ask Memlace. Runs 100% locally by
 * default: turns a natural-language question into a single structured
 * answer built from existing indexes (conversations, knowledge,
 * projects, memories, decisions, code snippets).
 *
 * External AI providers may later *enrich* the answer, but the core
 * engine always works offline. Never fabricates: every field maps to a
 * source we can point back at.
 */
import { db } from "@/lib/db";
import { searchKnowledge, listConversationsForTechnology } from "@/knowledge/search";
import { search as unifiedSearch } from "./SemanticSearch";
import { extractDecisions } from "@/context/DecisionExtractor";
import type { ExtractedDecision } from "@/context/types";
import { allProjectMappings } from "@/services/projectDetection";
import type { KnowledgeRecord } from "@/knowledge/types";
import type {
  Memory,
  Project,
  ProviderId,
  StoredConversation,
  StoredConvMessage,
} from "@/types";

type ProjectMappingEntry = { projectId: string | null; reason: string; ts: number };
type ProjectMappings = Record<string, ProjectMappingEntry>;


/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type AnswerIntent = "code" | "when" | "who" | "project" | "browse" | "general";

export interface AnswerSource {
  kind: "conversation" | "project" | "decision" | "code" | "memory";
  id: string;
  label: string;
  provider?: ProviderId;
  ts?: number;
  meta?: string;
}

export interface AnswerCodeSnippet {
  language: string | null;
  preview: string;
  conversationId: string;
  conversationTitle: string;
}

export interface Answer {
  question: string;
  intent: AnswerIntent;
  /** One-sentence lead. Rendered as the answer headline. */
  headline: string;
  /** Optional supporting sentence. Empty when no extra detail exists. */
  detail: string;
  /** "Based on" bullets — always source-backed counts. */
  bullets: { icon: "conv" | "decision" | "project" | "code" | "note"; text: string }[];
  latestActivity?: {
    at: number;
    conversationId: string;
    conversationTitle: string;
    provider: ProviderId;
  };
  related: string[];
  sources: AnswerSource[];
  primaryConversationId?: string;
  primaryProjectId?: string;
  codeSnippets: AnswerCodeSnippet[];
  followUps: string[];
  confidence: "none" | "low" | "medium" | "high";
  scopedToProjectId?: string;
  builtAt: number;
  tookMs: number;
}

export interface AnswerOptions {
  /** Prioritise (and optionally restrict to) this project. */
  scopedToProjectId?: string;
  /** If false, ignore scopedToProjectId and search everything. Default true. */
  respectScope?: boolean;
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------ *
 * Cache — tiny LRU keyed by (scope|question).
 * ------------------------------------------------------------------ */

const CACHE_MAX = 20;
const CACHE = new Map<string, Answer>();

function cacheKey(q: string, scope?: string): string {
  return `${scope ?? "*"}::${q.trim().toLowerCase()}`;
}

function cacheGet(k: string): Answer | undefined {
  const v = CACHE.get(k);
  if (!v) return undefined;
  // touch — move to end
  CACHE.delete(k);
  CACHE.set(k, v);
  return v;
}

function cachePut(k: string, v: Answer): void {
  CACHE.set(k, v);
  if (CACHE.size > CACHE_MAX) {
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
}

export function invalidateAnswers(): void {
  CACHE.clear();
}

/* ------------------------------------------------------------------ *
 * Intent detection
 * ------------------------------------------------------------------ */

const RX_CODE = /\b(code|snippet|schema|hook|hooks|middleware|api\s+route|route\s+handler|function|component|regex|import|useeffect|usestate|sql|migration|query)\b/i;
const RX_WHEN = /\b(when|what\s+day|what\s+date|deploy(ed)?|shipp?ed|released|launched|completed|finished)\b/i;
const RX_WHO = /\b(which\s+ai|who\s+suggested|who\s+recommended|claude|chatgpt|gpt|gemini|perplexity|copilot|deepseek|aistudio)\b/i;
const RX_PROJECT = /\b(project|projects|workspace)\b/i;
const RX_BROWSE = /^(show|list|find)\s+(every|all|my)\b/i;

function detectIntent(q: string): AnswerIntent {
  if (RX_BROWSE.test(q)) return "browse";
  if (RX_CODE.test(q)) return "code";
  if (RX_WHEN.test(q)) return "when";
  if (RX_WHO.test(q)) return "who";
  if (RX_PROJECT.test(q)) return "project";
  return "general";
}

const STOP = new Set([
  "the","a","an","and","or","of","for","to","in","on","at","by","with","is","are","was","were","be","been","being",
  "i","my","me","we","our","you","your","it","this","that","these","those","did","do","does","have","has","had",
  "what","when","where","which","who","why","how","show","find","list","every","all","some","any","about",
  "discussed","discussion","mentioning","mention","help","helped","solve","solved","build","built","use","using",
]);

function keywords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/* ------------------------------------------------------------------ *
 * Provider label detection (for "which AI" intent)
 * ------------------------------------------------------------------ */

const PROVIDER_HINTS: Record<string, ProviderId> = {
  claude: "claude",
  chatgpt: "chatgpt",
  gpt: "chatgpt",
  openai: "chatgpt",
  gemini: "gemini",
  aistudio: "aistudio",
  "ai studio": "aistudio",
  perplexity: "perplexity",
  copilot: "copilot",
  deepseek: "deepseek",
};

function providerFilter(q: string): ProviderId | null {
  const lower = q.toLowerCase();
  for (const [k, v] of Object.entries(PROVIDER_HINTS)) {
    if (lower.includes(k)) return v;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

function truncate(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function unique<T>(xs: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of xs) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function humanDate(ts: number): string {
  const diff = Date.now() - ts;
  const day = 86_400_000;
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return new Date(ts).toLocaleDateString();
}

/* ------------------------------------------------------------------ *
 * Follow-up templates
 * ------------------------------------------------------------------ */

function buildFollowUps(
  intent: AnswerIntent,
  entities: string[],
  primaryProject?: Project,
): string[] {
  const topic = entities[0];
  const out: string[] = [];
  if (intent === "code") {
    if (topic) out.push(`Show every ${topic} code snippet`);
    out.push("Who suggested this solution?");
    out.push("When was it completed?");
  } else if (intent === "when") {
    if (topic) out.push(`Show the ${topic} timeline`);
    out.push("What was the latest decision?");
    out.push("Continue this work");
  } else if (intent === "who") {
    if (topic) out.push(`What did other AIs say about ${topic}?`);
    out.push("Show related conversations");
    out.push("Continue this work");
  } else if (intent === "project" || intent === "browse") {
    if (primaryProject) out.push(`Show the ${primaryProject.name} decisions`);
    if (topic) out.push(`Which project uses ${topic}?`);
    out.push("Show recent activity");
  } else {
    if (topic) out.push(`Show ${topic} code`);
    if (topic) out.push(`When did I last work on ${topic}?`);
    out.push("Show related conversations");
  }
  out.push("Continue this work");
  return unique(out, (s) => s.toLowerCase()).slice(0, 4);
}

/* ------------------------------------------------------------------ *
 * Core
 * ------------------------------------------------------------------ */

export async function answerQuestion(
  question: string,
  opts: AnswerOptions = {},
): Promise<Answer> {
  const q = question.trim();
  if (!q) throw new Error("Empty question");
  const scope = opts.respectScope === false ? undefined : opts.scopedToProjectId;
  const key = cacheKey(q, scope);
  const cached = cacheGet(key);
  if (cached) return { ...cached, tookMs: 0 };

  const started = performance.now();
  const intent = detectIntent(q);
  const entities = keywords(q);
  const providerHint = providerFilter(q);

  // 1. Retrieve candidate conversations. Reuse the unified search
  //    (semantic when AI is on, keyword otherwise).
  const hits = await unifiedSearch(q, 30);
  let convIds = hits.map((h) => h.conversationId);

  // 2. Apply project scope if any.
  const mappings: ProjectMappings = await allProjectMappings().catch(() => ({}));
  if (scope) {
    convIds = convIds.filter((id) => mappings[id]?.projectId === scope);
  }

  // 3. Load conversations + knowledge in parallel.
  const [conversations, knowledgeHits, allProjects] = await Promise.all([
    convIds.length
      ? db.conversations.bulkGet(convIds).then((rows) =>
          rows.filter((r): r is StoredConversation => !!r),
        )
      : Promise.resolve<StoredConversation[]>([]),
    searchKnowledge(q).catch(() => [] as ReturnType<typeof searchKnowledge> extends Promise<infer R> ? R : never),
    db.projects.toArray().catch(() => [] as Project[]),
  ]);

  // 4. Provider filter — "did Claude help me..." → only Claude threads.
  const filteredConvs = providerHint
    ? conversations.filter((c) => c.provider === providerHint)
    : conversations;

  // 5. Knowledge rows scoped to the surviving conversations.
  const scopedConvIds = new Set(filteredConvs.map((c) => c.id));
  const knowledgeRecords: KnowledgeRecord[] = knowledgeHits
    .filter((h) => (scopedConvIds.size ? scopedConvIds.has(h.record.conversationId) : true))
    .map((h) => h.record);
  const knowledgeById = new Map(knowledgeRecords.map((k) => [k.conversationId, k]));

  // 6. Project attribution — which project(s) do these conversations map to?
  const projectHits = new Map<string, number>();
  for (const c of filteredConvs) {
    const pid = mappings[c.id]?.projectId;
    if (pid) projectHits.set(pid, (projectHits.get(pid) ?? 0) + 1);
  }
  const primaryProjectId =
    scope ??
    [...projectHits.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const primaryProject = allProjects.find((p) => p.id === primaryProjectId);

  // Also match by project *name* — natural language often names them.
  const nameMatchProjects = allProjects.filter((p) =>
    entities.some((e) => p.name.toLowerCase().includes(e)),
  );

  // 7. Memories that match — light substring pass.
  const memories = await db.memories
    .filter(
      (m) =>
        !m.trashed &&
        (scope ? m.projectId === scope : true) &&
        (entities.length === 0 ||
          entities.some(
            (e) =>
              m.title.toLowerCase().includes(e) ||
              m.content.toLowerCase().includes(e),
          )),
    )
    .limit(20)
    .toArray()
    .catch(() => [] as Memory[]);

  // 8. Code snippets aggregated from the top knowledge records.
  const codeSnippets: AnswerCodeSnippet[] = [];
  for (const k of knowledgeRecords.slice(0, 8)) {
    const conv = filteredConvs.find((c) => c.id === k.conversationId);
    for (const cb of (k.codeBlocks ?? []).slice(0, 4)) {
      if (intent === "code" && entities.length) {
        const hay = `${cb.language ?? ""} ${cb.preview}`.toLowerCase();
        if (!entities.some((e) => hay.includes(e))) continue;
      }
      codeSnippets.push({
        language: cb.language,
        preview: truncate(cb.preview, 180),
        conversationId: k.conversationId,
        conversationTitle: conv?.title ?? k.title,
      });
      if (codeSnippets.length >= 6) break;
    }
    if (codeSnippets.length >= 6) break;
  }

  // 9. Decisions — extract from the top ≤ 8 conversations' messages.
  const topConvIds = filteredConvs.slice(0, 8).map((c) => c.id);
  const messages: StoredConvMessage[] = topConvIds.length
    ? await db.convMessages
        .where("conversationId")
        .anyOf(topConvIds)
        .toArray()
        .catch(() => [] as StoredConvMessage[])
    : [];
  const msgsByConv = new Map<string, StoredConvMessage[]>();
  for (const m of messages) {
    const arr = msgsByConv.get(m.conversationId) ?? [];
    arr.push(m);
    msgsByConv.set(m.conversationId, arr);
  }
  const decisions: ExtractedDecision[] = [];
  for (const [cid, msgs] of msgsByConv) {
    msgs.sort((a, b) => a.order - b.order);
    const found = extractDecisions(cid, msgs);
    // Filter by query relevance when the user asked about a topic.
    const relevant = entities.length
      ? found.filter((d) =>
          entities.some((e) => d.statement.toLowerCase().includes(e)),
        )
      : found;
    decisions.push(...relevant);
  }
  decisions.sort((a, b) => b.detectedAt - a.detectedAt);

  // 10. Latest activity.
  const latestConv = filteredConvs[0];

  // 11. Related tags — top techs/topics across matched knowledge.
  const tagCounts = new Map<string, number>();
  for (const k of knowledgeRecords) {
    for (const t of [...(k.technologies ?? []), ...(k.topics ?? [])]) {
      const key = t.toLowerCase();
      if (entities.includes(key)) continue;
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const related = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  // 12. Confidence.
  const evidence =
    filteredConvs.length + decisions.length + codeSnippets.length + memories.length;
  const confidence: Answer["confidence"] =
    evidence === 0
      ? "none"
      : evidence < 3
        ? "low"
        : evidence < 8
          ? "medium"
          : "high";

  // 13. Synthesize headline + detail — always source-backed templates.
  let headline = "";
  let detail = "";
  const topic = entities[0] ?? q;
  if (confidence === "none") {
    headline = "I couldn't find enough information.";
    detail =
      "Nothing in your saved memory matches that yet. Try broader wording or capture a related conversation first.";
  } else if (nameMatchProjects[0] && intent === "project") {
    const p = nameMatchProjects[0];
    headline = `Found the ${p.name} project.`;
    detail = latestConv
      ? `Latest activity ${humanDate(latestConv.updatedAt).toLowerCase()} in "${truncate(latestConv.title, 60)}".`
      : "";
  } else if (primaryProject) {
    headline = `${topic.charAt(0).toUpperCase()}${topic.slice(1)} was primarily discussed in the ${primaryProject.name} project.`;
    if (latestConv)
      detail = `Latest activity ${humanDate(latestConv.updatedAt).toLowerCase()} in "${truncate(latestConv.title, 60)}".`;
  } else if (intent === "code" && codeSnippets.length) {
    headline = `Found ${codeSnippets.length} ${codeSnippets.length === 1 ? "snippet" : "snippets"} for ${topic}.`;
    detail = `Across ${filteredConvs.length} ${filteredConvs.length === 1 ? "conversation" : "conversations"}.`;
  } else if (intent === "who" && providerHint) {
    headline = `${filteredConvs.length} ${filteredConvs.length === 1 ? "conversation" : "conversations"} with ${providerHint} touch on ${topic}.`;
    if (latestConv)
      detail = `Most recent: "${truncate(latestConv.title, 60)}" ${humanDate(latestConv.updatedAt).toLowerCase()}.`;
  } else if (intent === "when" && latestConv) {
    headline = `Most recent activity was ${humanDate(latestConv.updatedAt).toLowerCase()}.`;
    detail = `Seen in "${truncate(latestConv.title, 60)}".`;
  } else {
    headline = `Found ${filteredConvs.length} ${filteredConvs.length === 1 ? "match" : "matches"} for ${topic}.`;
    if (latestConv)
      detail = `Latest ${humanDate(latestConv.updatedAt).toLowerCase()} in "${truncate(latestConv.title, 60)}".`;
  }

  // 14. Bullet counters.
  const bullets: Answer["bullets"] = [];
  if (filteredConvs.length)
    bullets.push({
      icon: "conv",
      text: `${filteredConvs.length} ${filteredConvs.length === 1 ? "conversation" : "conversations"}`,
    });
  if (decisions.length)
    bullets.push({
      icon: "decision",
      text: `${decisions.length} ${decisions.length === 1 ? "decision" : "decisions"}`,
    });
  if (primaryProject || nameMatchProjects.length)
    bullets.push({
      icon: "project",
      text: `${primaryProject ? 1 : nameMatchProjects.length} project${(primaryProject ? 1 : nameMatchProjects.length) > 1 ? "s" : ""}`,
    });
  if (codeSnippets.length)
    bullets.push({
      icon: "code",
      text: `${codeSnippets.length} code ${codeSnippets.length === 1 ? "snippet" : "snippets"}`,
    });
  if (memories.length)
    bullets.push({
      icon: "note",
      text: `${memories.length} ${memories.length === 1 ? "note" : "notes"}`,
    });

  // 15. Sources — the transparency payload.
  const sources: AnswerSource[] = [];
  for (const c of filteredConvs.slice(0, 6)) {
    sources.push({
      kind: "conversation",
      id: c.id,
      label: c.title || "Untitled",
      provider: c.provider,
      ts: c.updatedAt,
    });
  }
  if (primaryProject) {
    sources.push({
      kind: "project",
      id: primaryProject.id,
      label: primaryProject.name,
    });
  }
  for (const p of nameMatchProjects.slice(0, 2)) {
    if (p.id === primaryProject?.id) continue;
    sources.push({ kind: "project", id: p.id, label: p.name });
  }
  for (const d of decisions.slice(0, 4)) {
    sources.push({
      kind: "decision",
      id: d.id,
      label: d.statement,
      ts: d.detectedAt,
      meta:
        d.polarity === "reject"
          ? "rejected"
          : d.polarity === "complete"
            ? "completed"
            : d.polarity === "unresolved"
              ? "open"
              : "adopted",
    });
  }
  for (const s of codeSnippets.slice(0, 3)) {
    sources.push({
      kind: "code",
      id: `${s.conversationId}#${s.preview.slice(0, 12)}`,
      label: s.conversationTitle,
      meta: s.language ?? undefined,
    });
  }
  for (const m of memories.slice(0, 3)) {
    sources.push({ kind: "memory", id: m.id, label: m.title, ts: m.updatedAt });
  }

  // 16. Assemble.
  const answer: Answer = {
    question: q,
    intent,
    headline,
    detail,
    bullets,
    latestActivity: latestConv
      ? {
          at: latestConv.updatedAt,
          conversationId: latestConv.id,
          conversationTitle: latestConv.title,
          provider: latestConv.provider,
        }
      : undefined,
    related,
    sources,
    primaryConversationId: filteredConvs[0]?.id,
    primaryProjectId: primaryProject?.id,
    codeSnippets,
    followUps: buildFollowUps(intent, entities, primaryProject),
    confidence,
    scopedToProjectId: scope,
    builtAt: Date.now(),
    tookMs: Math.round(performance.now() - started),
  };

  cachePut(key, answer);
  // Silence unused-var lint on the helper.
  void knowledgeById;
  return answer;
}

/* ------------------------------------------------------------------ *
 * Memory Explorer — cheap facet listing over already-indexed data.
 * ------------------------------------------------------------------ */

export interface ExplorerFacets {
  projects: { id: string; name: string; count: number }[];
  technologies: { name: string; count: number }[];
  frameworks: { name: string; count: number }[];
  languages: { name: string; count: number }[];
  topics: { name: string; count: number }[];
  recent: { id: string; title: string; provider: ProviderId; ts: number }[];
  pinned: { id: string; title: string }[];
}

export async function loadExplorer(): Promise<ExplorerFacets> {
  const [projects, knowledge, conversations, memories, mappings] = await Promise.all([
    db.projects.toArray().catch(() => [] as Project[]),
    db.knowledge.toArray().catch(() => [] as KnowledgeRecord[]),
    db.conversations.toArray().catch(() => [] as StoredConversation[]),
    db.memories
      .filter((m) => !m.trashed && m.pinned)
      .limit(12)
      .toArray()
      .catch(() => [] as Memory[]),
    allProjectMappings().catch(() => ({}) as Awaited<ReturnType<typeof allProjectMappings>>),
  ]);

  const projConvCount = new Map<string, number>();
  for (const entry of Object.values(mappings)) {
    if (!entry?.projectId) continue;
    projConvCount.set(entry.projectId, (projConvCount.get(entry.projectId) ?? 0) + 1);
  }

  const tech = new Map<string, number>();
  const lang = new Map<string, number>();
  const frame = new Map<string, number>();
  const topics = new Map<string, number>();
  for (const k of knowledge) {
    for (const t of k.technologies ?? []) tech.set(t, (tech.get(t) ?? 0) + 1);
    for (const l of k.languages ?? []) lang.set(l, (lang.get(l) ?? 0) + 1);
    for (const t of k.topics ?? []) topics.set(t, (topics.get(t) ?? 0) + 1);
    for (const e of k.entityDetails ?? []) {
      if (e.type === "framework") frame.set(e.name, (frame.get(e.name) ?? 0) + 1);
    }
  }

  const sortTop = (m: Map<string, number>, n = 10) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }));

  const recent = conversations
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8)
    .map((c) => ({ id: c.id, title: c.title || "Untitled", provider: c.provider, ts: c.updatedAt }));

  return {
    projects: projects
      .map((p) => ({ id: p.id, name: p.name, count: projConvCount.get(p.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    technologies: sortTop(tech),
    frameworks: sortTop(frame),
    languages: sortTop(lang, 8),
    topics: sortTop(topics, 10),
    recent,
    pinned: memories.map((m) => ({ id: m.id, title: m.title })),
  };
}

/* ------------------------------------------------------------------ *
 * Follow-up helpers exposed for the UI
 * ------------------------------------------------------------------ */

export async function conversationsForTechnology(name: string): Promise<StoredConversation[]> {
  const rows = await listConversationsForTechnology(name);
  if (!rows.length) return [];
  const convs = await db.conversations.bulkGet(rows.map((r) => r.conversationId));
  return convs.filter((c): c is StoredConversation => !!c).sort((a, b) => b.updatedAt - a.updatedAt);
}
