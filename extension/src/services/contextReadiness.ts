/**
 * ContextReadiness — internal-only score (0..1) describing whether a
 * memory has enough context for "Continue Anywhere". NEVER shown in UI.
 *
 * The score is derived on demand from already-persisted data. Callers
 * treat it as a heuristic to prioritise background work (embeddings,
 * summaries, prefetches). It is intentionally cheap: no network, no
 * blocking, in-memory LRU keyed by conversation hash.
 */
import { db } from "@/lib/db";
import type { StoredConversation } from "@/types";

const cache = new Map<string, { hash: string; score: number }>();
const MAX = 500;

const DAY = 24 * 60 * 60 * 1000;

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export async function contextReadiness(
  conv: StoredConversation,
): Promise<number> {
  const cached = cache.get(conv.id);
  if (cached && cached.hash === conv.hash) return cached.score;

  let score = 0;

  // Conversation completeness — a few round-trips already carries context.
  score += Math.min(0.25, conv.messageCount * 0.03);

  // Knowledge extraction present.
  const kn = await db.knowledge.where("conversationId").equals(conv.id).first().catch(() => null);
  if (kn) {
    if ((kn.topics?.length ?? 0) > 0) score += 0.1;
    if ((kn.technologies?.length ?? 0) > 0) score += 0.1;
    if ((kn.codeBlocks?.length ?? 0) > 0) score += 0.1;
    if ((kn.links?.length ?? 0) > 0) score += 0.05;
    if ((kn.attachments?.length ?? 0) > 0) score += 0.05;
  }

  // Summary available (optional AI layer).
  const sum = await db.aiSummaries
    .where("conversationId")
    .equals(conv.id)
    .first()
    .catch(() => null);
  if (sum) {
    score += 0.15;
    if ((sum.decisions?.length ?? 0) > 0) score += 0.05;
    if ((sum.importantCode?.length ?? 0) > 0) score += 0.05;
    if ((sum.actionItems?.length ?? 0) > 0) score += 0.03;
  }

  // Recency bump — recent memory is more likely wanted for continuation.
  const age = Date.now() - conv.updatedAt;
  if (age < DAY) score += 0.05;
  else if (age < 7 * DAY) score += 0.02;

  const final = clamp(score);
  if (cache.size >= MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(conv.id, { hash: conv.hash, score: final });
  return final;
}

export function invalidateReadiness(conversationId?: string): void {
  if (conversationId) cache.delete(conversationId);
  else cache.clear();
}
