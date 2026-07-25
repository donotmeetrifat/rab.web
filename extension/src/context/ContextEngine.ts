/**
 * ContextEngine — the Universal Context Engine facade.
 *
 * `buildContextPackage()` composes ingredients from every already-
 * persisted source (conversation, timeline session, project mapping,
 * knowledge, AI summary, decisions, goals), scores them, compresses to
 * fit the target provider's practical limit, and renders a final prompt
 * via the ProviderOptimizer.
 *
 * The engine is 100% provider-agnostic: it never imports adapter code
 * and never mutates persisted rows. Provider-specific formatting lives
 * in ProviderOptimizer; provider adapters can be added without touching
 * anything here.
 */
import { db } from "@/lib/db";
import type { ProviderId, StoredConversation, StoredConvMessage } from "@/types";
import type {
  BuildContextInput,
  ContextItem,
  ContextPackage,
  ContextSizeBucket,
  DetectedGoal,
  ExtractedDecision,
} from "./types";
import { extractDecisions } from "./DecisionExtractor";
import { detectGoals } from "./GoalDetector";
import {
  getConversation,
  getConversationMessages,
  listConversations,
} from "@/services/conversations";
import { getDetectedProject } from "@/services/projectDetection";
import { charBudgetFor, renderPackage } from "./ProviderOptimizer";
import { getCached, setCached, invalidateContext } from "./ContextCache";
import type { KnowledgeRecord } from "@/knowledge/types";
import type { AIConversationSummary } from "@/ai/types";

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export { invalidateContext };

export async function buildContextPackage(
  input: BuildContextInput,
): Promise<ContextPackage> {
  const { conversation, target } = input;
  const cached = getCached(conversation.id, conversation.hash, target);
  if (cached) return cached;

  const budget = input.charBudget ?? charBudgetFor(target);
  const messages = await getConversationMessages(conversation.id);

  const [knowledge, summary, projectMapping, sessionSiblings] = await Promise.all([
    loadKnowledge(conversation.id),
    loadSummary(conversation.id),
    getDetectedProject(conversation.id).catch(() => null),
    loadSessionSiblings(conversation),
  ]);

  const decisions = extractDecisions(conversation.id, messages);
  const goals = detectGoals(conversation.id, messages);

  const projectName = projectMapping?.projectId
    ? await loadProjectName(projectMapping.projectId)
    : null;

  const items = collectItems({
    conversation,
    messages,
    knowledge,
    summary,
    decisions,
    goals,
    sessionSiblings,
    projectName,
  });

  const compressed = compress(items, budget);
  const truncated = compressed.length < items.length;

  const draft: Omit<ContextPackage, "prompt" | "chars"> = {
    id: `pkg_${conversation.id}_${conversation.hash}_${target}`,
    conversationId: conversation.id,
    target,
    items: compressed,
    summary: buildSummaryBullets(compressed, {
      hasSummary: !!summary,
      relatedCount: sessionSiblings.length,
      projectName,
    }),
    size: "medium",
    truncated,
    counts: countIngredients(compressed, items.length, messages.length, decisions.length, goals.length),
    qualityScore: qualityScoreFor({
      conversation,
      knowledge,
      summary,
      decisions,
      goals,
      messageCount: messages.length,
      truncated,
    }),
    builtAt: Date.now(),
  };

  const { prompt, chars } = renderPackage(draft);
  const pkg: ContextPackage = { ...draft, prompt, chars, size: bucketFor(chars, budget) };

  setCached(conversation.id, conversation.hash, pkg);
  return pkg;
}

/* ------------------------------------------------------------------ *
 * Ingredient loaders
 * ------------------------------------------------------------------ */

async function loadKnowledge(conversationId: string): Promise<KnowledgeRecord | null> {
  try {
    return (await db.knowledge.where("conversationId").equals(conversationId).first()) ?? null;
  } catch {
    return null;
  }
}

async function loadSummary(conversationId: string): Promise<AIConversationSummary | null> {
  try {
    return (
      (await db.aiSummaries.where("conversationId").equals(conversationId).first()) ?? null
    );
  } catch {
    return null;
  }
}

async function loadProjectName(projectId: string): Promise<string | null> {
  try {
    const p = await db.projects.get(projectId);
    return p?.name ?? null;
  } catch {
    return null;
  }
}

const SESSION_WINDOW = 3 * 60 * 60 * 1000;

async function loadSessionSiblings(
  conversation: StoredConversation,
): Promise<StoredConversation[]> {
  try {
    const all = await listConversations();
    return all
      .filter(
        (c) =>
          c.id !== conversation.id &&
          Math.abs(c.updatedAt - conversation.updatedAt) <= SESSION_WINDOW,
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Assembly
 * ------------------------------------------------------------------ */

interface CollectArgs {
  conversation: StoredConversation;
  messages: StoredConvMessage[];
  knowledge: KnowledgeRecord | null;
  summary: AIConversationSummary | null;
  decisions: ExtractedDecision[];
  goals: DetectedGoal[];
  sessionSiblings: StoredConversation[];
  projectName: string | null;
}

function collectItems(args: CollectArgs): ContextItem[] {
  const items: ContextItem[] = [];
  
  const { conversation, messages, knowledge, summary, decisions, goals, sessionSiblings, projectName } = args;

  // Project header — cheap anchor for the receiving AI.
  if (projectName) {
    items.push({
      id: "project:name",
      kind: "project",
      label: `Project: ${projectName}`,
      text: `**Project:** ${projectName}`,
      priority: 92,
      updatedAt: conversation.updatedAt,
    });
  }

  // Active goals — highest priority (the "what am I doing right now").
  for (const g of goals) {
    if (g.status === "abandoned") continue;
    items.push({
      id: `goal:${g.id}`,
      kind: "goal",
      label: `Goal · ${g.label}`,
      text: `- ${g.status === "completed" ? "✓ " : ""}${g.label}`,
      priority: g.status === "active" ? 98 : 60,
      updatedAt: g.updatedAt,
    });
  }

  // Decisions — durable, small, high signal.
  for (const d of decisions.slice(0, 12)) {
    const marker =
      d.polarity === "adopt"
        ? "✓"
        : d.polarity === "reject"
          ? "✗"
          : d.polarity === "complete"
            ? "•"
            : "?";
    items.push({
      id: `dec:${d.id}`,
      kind: "decision",
      label: `${marker} ${d.statement}`,
      text: `- ${marker} ${d.statement}`,
      priority: 85 + Math.round(d.confidence * 10),
      updatedAt: d.detectedAt,
      meta: { polarity: d.polarity },
    });
  }

  // AI summary — condensed background if the user opted in.
  if (summary?.shortSummary || summary?.longSummary) {
    const text = summary.longSummary || summary.shortSummary || "";
    items.push({
      id: "summary:main",
      kind: "summary",
      label: "Prior work summary",
      text,
      priority: 78,
      updatedAt: summary.updatedAt,
    });
    for (const t of summary.takeaways?.slice(0, 5) ?? []) {
      items.push({
        id: `summary:take:${t.slice(0, 24)}`,
        kind: "summary",
        label: "Takeaway",
        text: `- ${t}`,
        priority: 70,
        updatedAt: summary.updatedAt,
      });
    }
  }

  // Knowledge — technologies / topics are dense, small anchors.
  if (knowledge) {
    const tech = (knowledge.technologies ?? []).slice(0, 12);
    if (tech.length) {
      items.push({
        id: "know:tech",
        kind: "knowledge",
        label: `Stack: ${tech.join(", ")}`,
        text: `**Stack in play:** ${tech.join(", ")}`,
        priority: 72,
        updatedAt: knowledge.updatedAt,
      });
    }
    const topics = (knowledge.topics ?? []).slice(0, 6);
    if (topics.length) {
      items.push({
        id: "know:topics",
        kind: "knowledge",
        label: `Topics: ${topics.join(", ")}`,
        text: `**Topics:** ${topics.join(", ")}`,
        priority: 60,
        updatedAt: knowledge.updatedAt,
      });
    }
    // Important code blocks — trim heavily.
    const code = (knowledge.codeBlocks ?? [])
      .slice(0, 3)
      .filter((b) => b.charCount > 0);
    for (const block of code) {
      const fence = block.language || "";
      const body = block.preview.length > 800 ? `${block.preview.slice(0, 800)}\n…` : block.preview;
      items.push({
        id: `code:${block.order}`,
        kind: "code",
        label: block.filename ?? `Code block (${block.language ?? "text"})`,
        text: "```" + fence + "\n" + body + "\n```",
        priority: 80,
        updatedAt: knowledge.updatedAt,
        meta: { language: block.language ?? "text", lines: block.lineCount },
      });
    }
    // Referenced files/links.
    const files = (knowledge.attachments ?? []).slice(0, 5);
    for (const f of files) {
      if (!f.name && !f.url) continue;
      items.push({
        id: `file:${f.url ?? f.name}`,
        kind: "file",
        label: f.name ?? f.url ?? "file",
        text: `- ${f.name ?? f.url}`,
        priority: 55,
        updatedAt: knowledge.updatedAt,
      });
    }
  }

  // Current conversation title (small anchor even if we drop message tail).
  items.push({
    id: "conv:title",
    kind: "current-conversation",
    label: conversation.title || "Current conversation",
    text: `**Current thread:** ${conversation.title || "Untitled"}`,
    priority: 88,
    updatedAt: conversation.updatedAt,
  });

  // Recent messages — highest priority is the newest exchange.
  const tail = messages.slice(-16);
  for (let i = 0; i < tail.length; i++) {
    const m = tail[i];
    const body = (m.markdown?.trim() || m.content || "").trim();
    if (!body) continue;
    const isLatest = i >= tail.length - 4;
    items.push({
      id: `msg:${m.id}`,
      kind: "recent-message",
      label: `${m.role} · ${body.slice(0, 40)}`,
      text: `### ${roleLabel(m.role)}\n${body}`,
      priority: isLatest ? 95 : 50 + i,
      updatedAt: m.createdAt || conversation.updatedAt,
    });
  }

  // Related session conversations — titles only; the receiving AI can
  // ask if it needs more.
  if (sessionSiblings.length) {
    const list = sessionSiblings
      .slice(0, 4)
      .map((c) => `- ${c.title || "Untitled"} (${c.provider})`)
      .join("\n");
    items.push({
      id: "session:list",
      kind: "session",
      label: `${sessionSiblings.length} nearby chats`,
      text: `Recent nearby conversations in the same work session:\n${list}`,
      priority: 45,
      updatedAt: conversation.updatedAt,
      meta: { count: sessionSiblings.length },
    });
  }

  return items.sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt);
}

/* ------------------------------------------------------------------ *
 * Compression
 * ------------------------------------------------------------------ */

const RESERVE_CHARS = 800; // room for provider intro/outro + section headers.

function compress(items: ContextItem[], charBudget: number): ContextItem[] {
  const budget = Math.max(1500, charBudget - RESERVE_CHARS);
  const kept: ContextItem[] = [];
  let used = 0;
  for (const item of items) {
    const cost = item.text.length + 8;
    if (used + cost > budget) {
      // Allow tiny items (labels, headers) even when tight.
      if (cost < 160 && budget - used > 200 && item.priority >= 85) {
        kept.push(item);
        used += cost;
      }
      continue;
    }
    kept.push(item);
    used += cost;
  }
  // Preserve inclusion order that ProviderOptimizer expects (section grouping).
  return kept;
}

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

function countIngredients(
  kept: ContextItem[],
  considered: number,
  messageCount: number,
  decisionCount: number,
  goalCount: number,
): ContextPackage["counts"] {
  const keptMessages = kept.filter((i) => i.kind === "recent-message").length;
  const codeBlocks = kept.filter((i) => i.kind === "code").length;
  const related = kept.filter((i) => i.kind === "session").length;
  void considered;
  return {
    consideredMessages: messageCount,
    keptMessages,
    decisions: kept.filter((i) => i.kind === "decision").length || decisionCount,
    goals: kept.filter((i) => i.kind === "goal").length || goalCount,
    codeBlocks,
    relatedConversations: related,
  };
}

function buildSummaryBullets(
  kept: ContextItem[],
  extras: { hasSummary: boolean; relatedCount: number; projectName: string | null },
): string[] {
  const out: string[] = ["Current conversation"];
  const goals = kept.filter((i) => i.kind === "goal").length;
  const decisions = kept.filter((i) => i.kind === "decision").length;
  const codeBlocks = kept.filter((i) => i.kind === "code").length;
  const knowledge = kept.filter((i) => i.kind === "knowledge").length;
  const messages = kept.filter((i) => i.kind === "recent-message").length;

  if (extras.projectName) out.push(`Project: ${extras.projectName}`);
  if (messages) out.push(`${messages} recent message${messages === 1 ? "" : "s"}`);
  if (goals) out.push(`${goals} active goal${goals === 1 ? "" : "s"}`);
  if (decisions) out.push(`${decisions} key decision${decisions === 1 ? "" : "s"}`);
  if (knowledge) out.push("Relevant knowledge");
  if (codeBlocks) out.push(`${codeBlocks} code snippet${codeBlocks === 1 ? "" : "s"}`);
  if (extras.hasSummary) out.push("Prior work summary");
  if (extras.relatedCount) out.push(`${extras.relatedCount} nearby chat${extras.relatedCount === 1 ? "" : "s"}`);
  return out;
}

function bucketFor(chars: number, budget: number): ContextSizeBucket {
  const ratio = chars / Math.max(1, budget);
  if (ratio < 0.25) return "small";
  if (ratio < 0.55) return "medium";
  if (ratio < 0.9) return "large";
  return "full";
}

function roleLabel(role: StoredConvMessage["role"]): string {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "system":
      return "System";
    case "tool":
      return "Tool";
    default:
      return role;
  }
}

/* ------------------------------------------------------------------ *
 * Quality scoring (internal — never surfaced in the UI)
 * ------------------------------------------------------------------ */

interface QualityArgs {
  conversation: StoredConversation;
  knowledge: KnowledgeRecord | null;
  summary: AIConversationSummary | null;
  decisions: ExtractedDecision[];
  goals: DetectedGoal[];
  messageCount: number;
  truncated: boolean;
}

function qualityScoreFor(a: QualityArgs): number {
  let s = 0;
  s += Math.min(0.25, a.messageCount * 0.02); // completeness
  if (a.knowledge) s += 0.15;
  if (a.knowledge?.codeBlocks?.length) s += 0.1;
  if (a.summary) s += 0.15;
  if (a.decisions.length) s += 0.1 + Math.min(0.1, a.decisions.length * 0.02);
  if (a.goals.some((g) => g.status === "active")) s += 0.1;
  // Recency — the more recent, the more likely to be actionable.
  const age = Date.now() - a.conversation.updatedAt;
  if (age < 24 * 60 * 60 * 1000) s += 0.05;
  if (a.truncated) s -= 0.05;
  return Math.max(0, Math.min(1, s));
}

/* ------------------------------------------------------------------ *
 * Convenience — used by the ContinueButton preview path.
 * ------------------------------------------------------------------ */

export async function buildContextPackageById(
  conversationId: string,
  target: ProviderId,
): Promise<ContextPackage | null> {
  const conv = await getConversation(conversationId);
  if (!conv) return null;
  return buildContextPackage({ conversation: conv, target });
}
