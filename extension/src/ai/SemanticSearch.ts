/**
 * SemanticSearch — user-facing wrapper. Falls back to the offline
 * knowledge search when embeddings aren't available yet.
 */
import { semanticSearch, type SemanticHit } from "./EmbeddingEngine";
import { searchKnowledge } from "@/knowledge/search";
import { isAIEnabled } from "./AIManager";

export interface UnifiedHit {
  conversationId: string;
  title: string;
  score: number;
  source: "semantic" | "keyword";
  snippet?: string;
}

export async function search(query: string, limit = 15): Promise<UnifiedHit[]> {
  const q = query.trim();
  if (!q) return [];

  const results: UnifiedHit[] = [];
  if (await isAIEnabled()) {
    try {
      const sem = await semanticSearch(q, limit);
      for (const h of sem) {
        results.push({
          conversationId: h.conversationId,
          title: h.title,
          score: h.similarity,
          source: "semantic",
          snippet: h.text,
        });
      }
    } catch {
      // fall through to keyword-only
    }
  }

  // Always fold in keyword hits — semantic ranking sometimes misses exact
  // library names, and offline users get results either way.
  const kw = await searchKnowledge(q);
  const seen = new Set(results.map((r) => r.conversationId));
  for (const h of kw.slice(0, limit)) {
    if (seen.has(h.record.conversationId)) continue;
    results.push({
      conversationId: h.record.conversationId,
      title: h.record.title,
      score: h.score / 100,
      source: "keyword",
      snippet: h.matchedIn.join(" · "),
    });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export type { SemanticHit };
