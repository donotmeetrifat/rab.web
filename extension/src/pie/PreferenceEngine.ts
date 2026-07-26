/**
 * PreferenceEngine — passively learns long-term preferences from every
 * saved conversation. Uses exponential recency decay so a preference the
 * user stopped using two months ago naturally sinks below the fresh one.
 */
import { db } from "@/lib/db";
import type { KnowledgeRecord } from "@/knowledge/types";
import type { StoredConversation, StoredConvMessage } from "@/types";
import type { PiePreferenceRow } from "./types";

const HALFLIFE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

function decayFactor(from: number, to: number): number {
  const days = Math.max(0, (to - from) / MS_PER_DAY);
  return Math.pow(0.5, days / HALFLIFE_DAYS);
}

function bump(
  bucket: Map<string, { kind: PiePreferenceRow["kind"]; value: string; hits: number }>,
  kind: PiePreferenceRow["kind"],
  raw: string,
  hits = 1,
) {
  const value = raw.trim().toLowerCase();
  if (!value) return;
  const id = `${kind}:${value}`;
  const cur = bucket.get(id);
  if (cur) cur.hits += hits;
  else bucket.set(id, { kind, value, hits });
}

const RESPONSE_FORMAT_PATTERNS: Array<[RegExp, string]> = [
  [/\bstep[- ]by[- ]step\b/i, "step-by-step"],
  [/\bin bullet points?\b/i, "bulleted"],
  [/\btable\b/i, "tables"],
  [/\bwith code\b|\bshow (?:me )?the code\b/i, "code-first"],
  [/\bconcise|\bshort\b|\btl;dr\b/i, "concise"],
  [/\bexplain in detail|\bdeep dive\b/i, "detailed"],
];
const STYLE_PATTERNS: Array<[RegExp, string]> = [
  [/\btypescript strict\b|\bstrict mode\b/i, "typescript-strict"],
  [/\bfunctional\b/i, "functional"],
  [/\boop\b|\bclass-based\b/i, "object-oriented"],
  [/\btailwind\b/i, "tailwind"],
  [/\bshadcn\b/i, "shadcn"],
  [/\bmarkdown docs?\b|\breadme\b/i, "markdown-docs"],
];

export async function updatePreferencesFor(
  conversation: StoredConversation,
  knowledge: KnowledgeRecord | null,
  messages: StoredConvMessage[],
): Promise<void> {
  const now = Date.now();
  const bucket = new Map<string, { kind: PiePreferenceRow["kind"]; value: string; hits: number }>();

  bump(bucket, "provider", conversation.provider, 2);

  if (knowledge) {
    for (const lang of knowledge.languages) bump(bucket, "language", lang, 2);
    for (const tech of knowledge.technologies) bump(bucket, "framework", tech, 1);
    for (const topic of knowledge.topics) bump(bucket, "topic", topic, 1);
    for (const e of knowledge.entityDetails) {
      if (e.type === "database") bump(bucket, "database", e.name);
      else if (e.type === "cloud") bump(bucket, "cloud", e.name);
      else if (e.type === "ai") bump(bucket, "ai", e.name);
    }
  }

  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.markdown || m.content || "")
    .join("\n")
    .slice(0, 20_000);

  for (const [re, tag] of RESPONSE_FORMAT_PATTERNS) {
    if (re.test(userText)) bump(bucket, "responseFormat", tag);
  }
  for (const [re, tag] of STYLE_PATTERNS) {
    if (re.test(userText)) bump(bucket, "style", tag);
  }

  if (!bucket.size) return;

  const ids = Array.from(bucket.keys());
  const existing = await db.piePreferences.bulkGet(ids);
  const rows: PiePreferenceRow[] = [];
  bucket.forEach((incoming, id) => {
    const prev = existing.find((r) => r?.id === id);
    if (prev) {
      const decayed = prev.score * decayFactor(prev.updatedAt, now);
      const nextConvs = prev.conversationIds.includes(conversation.id)
        ? prev.conversationIds
        : [...prev.conversationIds, conversation.id].slice(-50);
      rows.push({
        ...prev,
        score: decayed + incoming.hits,
        count: prev.count + incoming.hits,
        conversationIds: nextConvs,
        lastSeen: now,
        updatedAt: now,
      });
    } else {
      rows.push({
        id,
        kind: incoming.kind,
        value: incoming.value,
        score: incoming.hits,
        count: incoming.hits,
        conversationIds: [conversation.id],
        firstSeen: now,
        lastSeen: now,
        updatedAt: now,
      });
    }
  });
  await db.piePreferences.bulkPut(rows);
}

export async function topPreferences(
  kind: PiePreferenceRow["kind"],
  limit = 5,
): Promise<PiePreferenceRow[]> {
  const all = await db.piePreferences.where("kind").equals(kind).toArray();
  return all.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function preferredProvider(): Promise<string | null> {
  const rows = await topPreferences("provider", 1);
  return rows[0]?.value ?? null;
}
