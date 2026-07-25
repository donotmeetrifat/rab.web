/**
 * TagEngine — derives smart, human tags for a conversation. Prefers the
 * summary row's `smartTags`/`topics` (avoids another AI call). Persists
 * suggestions as Memory-style tag rows so they show up in the tag cloud.
 */
import { db } from "@/lib/db";
import { getSummary, summarizeConversation } from "./SummaryEngine";

const STOP = new Set([
  "the", "and", "for", "with", "this", "that", "your", "from", "have", "chat",
]);

function normalize(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9+.#-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export async function generateTags(
  conversationId: string,
  opts: { limit?: number; force?: boolean } = {},
): Promise<string[]> {
  const limit = opts.limit ?? 8;
  const sum = (await getSummary(conversationId)) ?? (await summarizeConversation(conversationId, { force: opts.force }));
  if (!sum) return [];

  const raw = [
    ...(sum.smartTags ?? []),
    ...(sum.topics ?? []),
    ...(sum.technologies ?? []),
    ...(sum.languages ?? []),
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const n = normalize(t);
    if (!n || STOP.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= limit) break;
  }
  if (out.length && sum) {
    await db.aiSummaries.update(sum.id, { smartTags: out, updatedAt: Date.now() });
  }
  return out;
}
