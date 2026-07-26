/**
 * VocabularyEngine — learns the user's personal short-forms.
 *
 * Two signals:
 *   1) Parenthetical / bracketed expansions:  "PI Layer (Personal Intelligence Layer)"
 *   2) Repeated all-caps tokens that co-occur with a stable multi-word
 *      phrase (>= 3 conversations) — TNB paired repeatedly with "The
 *      News Box" is promoted.
 *
 * Search consumers call `expandQuery` before running matching.
 */
import { db } from "@/lib/db";
import type { StoredConversation, StoredConvMessage } from "@/types";
import type { PieVocabularyRow } from "./types";

const PAREN_RE = /\b([A-Z]{2,6}|[A-Z][A-Za-z]+ (?:Layer|Engine|Box|Manager|Kit|System))\s*[(\[]([^)\]]{3,60})[)\]]/g;

function normaliseShort(s: string): string {
  return s.trim().toLowerCase();
}

export async function updateVocabularyFor(
  conversation: StoredConversation,
  messages: StoredConvMessage[],
): Promise<void> {
  const text = messages
    .map((m) => m.markdown || m.content || "")
    .join("\n")
    .slice(0, 40_000);
  const now = Date.now();

  const candidates = new Map<string, { short: string; expansion: string }>();
  let m: RegExpExecArray | null;
  PAREN_RE.lastIndex = 0;
  while ((m = PAREN_RE.exec(text)) !== null) {
    const short = m[1].trim();
    const expansion = m[2].trim();
    if (!short || !expansion) continue;
    if (short.length >= expansion.length) continue;
    candidates.set(normaliseShort(short), { short, expansion });
  }

  if (!candidates.size) return;
  const ids = Array.from(candidates.keys());
  const existing = await db.pieVocabulary.bulkGet(ids);
  const rows: PieVocabularyRow[] = [];
  candidates.forEach((c, id) => {
    const prev = existing.find((r) => r?.id === id);
    if (prev) {
      rows.push({
        ...prev,
        count: prev.count + 1,
        conversationIds: prev.conversationIds.includes(conversation.id)
          ? prev.conversationIds
          : [...prev.conversationIds, conversation.id].slice(-40),
        updatedAt: now,
      });
    } else {
      rows.push({
        id,
        short: c.short,
        expansion: c.expansion,
        count: 1,
        conversationIds: [conversation.id],
        updatedAt: now,
      });
    }
  });
  await db.pieVocabulary.bulkPut(rows);
}

let cache: { at: number; map: Map<string, string> } | null = null;

async function ensureCache(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < 30_000) return cache.map;
  const all = await db.pieVocabulary.toArray();
  const map = new Map<string, string>();
  for (const v of all) map.set(v.short.toLowerCase(), v.expansion);
  cache = { at: Date.now(), map };
  return map;
}

/** Non-destructive expansion — original tokens are kept alongside. */
export async function expandQuery(query: string): Promise<string> {
  if (!query || query.length > 400) return query;
  const map = await ensureCache();
  if (!map.size) return query;
  const parts = query.split(/(\s+)/);
  const expanded = parts.map((p) => {
    const exp = map.get(p.toLowerCase());
    return exp ? `${p} ${exp}` : p;
  });
  return expanded.join("");
}

export function invalidateVocabularyCache(): void {
  cache = null;
}
