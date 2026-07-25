/**
 * MemoryEngine — higher-level "memory" operations built on top of the
 * summary + embedding engines: related conversations, suggested project,
 * duplicate detection, importance/learning scoring.
 */
import { db } from "@/lib/db";
import { listConversations, getConversation } from "@/services/conversations";
import { listProjects } from "@/services/memories";
import { findRelatedConversations } from "@/knowledge/search";
import { getSummary, summarizeConversation } from "./SummaryEngine";
import { embedConversation, semanticNeighbors } from "./EmbeddingEngine";
import type { AIConversationSummary } from "./types";

export interface RelatedConversation {
  conversationId: string;
  title: string;
  score: number;
  reason: "semantic" | "shared-tech" | "shared-topic";
}

export async function getRelatedConversations(
  conversationId: string,
  limit = 5,
): Promise<RelatedConversation[]> {
  // Prefer semantic neighbours when embeddings exist.
  const semantic = await semanticNeighbors(conversationId, limit * 2).catch(() => []);
  const combined = new Map<string, RelatedConversation>();
  for (const s of semantic) {
    combined.set(s.conversationId, {
      conversationId: s.conversationId,
      title: s.title,
      score: s.similarity,
      reason: "semantic",
    });
  }
  // Fill from knowledge-engine facets when needed.
  if (combined.size < limit) {
    const facet = await findRelatedConversations(conversationId, limit);
    for (const f of facet) {
      if (combined.has(f.conversationId)) continue;
      combined.set(f.conversationId, {
        conversationId: f.conversationId,
        title: f.title,
        score: f.score / 10,
        reason: "shared-tech",
      });
    }
  }
  return [...combined.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface SuggestedProject {
  projectId: string | null;
  name: string;
  reason: string;
  score: number;
}

export async function suggestProject(conversationId: string): Promise<SuggestedProject | null> {
  const sum = (await getSummary(conversationId)) ?? (await summarizeConversation(conversationId));
  if (!sum) return null;
  const projects = await listProjects();
  if (projects.length === 0) return null;

  const bag = new Set(
    [
      ...(sum.topics ?? []),
      ...(sum.technologies ?? []),
      ...(sum.smartTags ?? []),
      sum.category ?? "",
    ].map((s) => s.toLowerCase().trim()).filter(Boolean),
  );

  let best: SuggestedProject | null = null;
  for (const p of projects) {
    const name = p.name.toLowerCase();
    let score = 0;
    for (const t of bag) if (name.includes(t) || t.includes(name)) score += 1;
    if (score > 0 && (!best || score > best.score)) {
      best = { projectId: p.id, name: p.name, reason: `matches ${score} topic${score > 1 ? "s" : ""}`, score };
    }
  }
  return best;
}

export interface DuplicateCandidate {
  conversationId: string;
  title: string;
  similarity: number;
}

/** Duplicates share a summary category + very high semantic similarity. */
export async function findDuplicates(conversationId: string, threshold = 0.92): Promise<DuplicateCandidate[]> {
  const neighbors = await semanticNeighbors(conversationId, 5).catch(() => []);
  return neighbors.filter((n) => n.similarity >= threshold).map((n) => ({
    conversationId: n.conversationId,
    title: n.title,
    similarity: n.similarity,
  }));
}

export function scoreImportance(sum: AIConversationSummary): number {
  if (typeof sum.importanceScore === "number") return clamp(sum.importanceScore);
  let s = 0;
  s += Math.min(0.3, (sum.decisions?.length ?? 0) * 0.06);
  s += Math.min(0.3, (sum.actionItems?.length ?? 0) * 0.06);
  s += Math.min(0.2, (sum.importantCode?.length ?? 0) * 0.05);
  s += Math.min(0.2, (sum.importantUrls?.length ?? 0) * 0.04);
  return clamp(s);
}

export function scoreLearning(sum: AIConversationSummary): number {
  if (typeof sum.learningScore === "number") return clamp(sum.learningScore);
  const denseTopics = (sum.topics?.length ?? 0) + (sum.technologies?.length ?? 0);
  const answered = sum.questionsAnswered?.length ?? 0;
  const diff = sum.difficulty === "advanced" ? 1 : sum.difficulty === "intermediate" ? 0.7 : 0.4;
  return clamp((denseTopics * 0.05 + answered * 0.08) * diff);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Ensure summary + embeddings exist. Safe to call repeatedly. */
export async function enrichConversation(conversationId: string): Promise<void> {
  const conv = await getConversation(conversationId);
  if (!conv) return;
  await summarizeConversation(conversationId);
  await embedConversation(conversationId).catch(() => undefined);
  void db; // keep import used for future direct writes
}
