/**
 * EmbeddingEngine — creates and searches per-conversation embeddings.
 *
 * We embed one summary-style document per conversation (title + short
 * summary + top topics + first N chars of transcript). One vector per
 * conversation keeps the DB small; message-level embeddings are computed
 * lazily by `semanticSearchMessages` only when the user opts in.
 *
 * Vectors are stored in Dexie. Search uses brute-force cosine similarity
 * — plenty fast for the low-thousands of conversations a Memlace user
 * will realistically save.
 */
import { db, uid } from "@/lib/db";
import { fnv1a } from "@/providers/base/hash";
import { getConversation, listConversationMessages, listConversations } from "@/services/conversations";
import { embed, getSettings, isAIEnabled } from "./AIManager";
import { getSummary } from "./SummaryEngine";
import { estimateTokens } from "./TokenCounter";
import type { AIEmbeddingRow } from "./types";

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function buildDocForConversation(
  conv: NonNullable<Awaited<ReturnType<typeof getConversation>>>,
  summaryText: string,
  transcript: string,
): string {
  return [
    `Title: ${conv.title}`,
    `Provider: ${conv.provider}`,
    summaryText && `Summary: ${summaryText}`,
    "",
    transcript.slice(0, 4000),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function embedConversation(conversationId: string, force = false): Promise<AIEmbeddingRow | null> {
  if (!(await isAIEnabled())) return null;
  const conv = await getConversation(conversationId);
  if (!conv) return null;

  const sum = await getSummary(conversationId);
  const messages = await listConversationMessages(conversationId);
  const transcript = messages
    .sort((a, b) => a.order - b.order)
    .map((m) => `${m.role}: ${(m.content || m.markdown || "").slice(0, 500)}`)
    .join("\n");
  const summaryText = [sum?.shortSummary, sum?.longSummary, (sum?.topics ?? []).join(", ")].filter(Boolean).join(" | ");
  const text = buildDocForConversation(conv, summaryText, transcript);
  const hash = fnv1a(text);

  const existing = await db.aiEmbeddings
    .where({ scope: "conversation", conversationId })
    .first();
  if (existing && !force && existing.hash === hash) return existing;

  const settings = await getSettings();
  const { vectors, model } = await embed({ input: text });
  const vector = vectors[0];
  if (!vector) return null;

  const row: AIEmbeddingRow = {
    id: existing?.id ?? uid("emb"),
    scope: "conversation",
    conversationId,
    chunkIndex: 0,
    text,
    vector,
    model,
    provider: settings.provider,
    hash,
    createdAt: Date.now(),
  };
  await db.aiEmbeddings.put(row);
  return row;
}

/** Embed every conversation that lacks an up-to-date vector. */
export async function embedAllConversations(
  onProgress?: (done: number, total: number) => void,
): Promise<{ embedded: number; skipped: number }> {
  const list = await listConversations();
  let embedded = 0, skipped = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i]!;
    const before = await db.aiEmbeddings.where({ scope: "conversation", conversationId: c.id }).first();
    const row = await embedConversation(c.id).catch(() => null);
    if (row && (!before || row.id !== before.id || row.hash !== before.hash)) embedded += 1;
    else skipped += 1;
    onProgress?.(i + 1, list.length);
  }
  return { embedded, skipped };
}

export interface SemanticHit {
  conversationId: string;
  title: string;
  similarity: number;
  text: string;
}

export async function semanticSearch(query: string, limit = 10): Promise<SemanticHit[]> {
  if (!query.trim()) return [];
  if (!(await isAIEnabled())) return [];
  const { vectors } = await embed({ input: query });
  const q = vectors[0];
  if (!q) return [];

  const rows = await db.aiEmbeddings.where("scope").equals("conversation").toArray();
  const scored: SemanticHit[] = [];
  const convs = new Map<string, string>();
  for (const c of await listConversations()) convs.set(c.id, c.title);

  for (const row of rows) {
    const sim = cosine(q, row.vector);
    scored.push({
      conversationId: row.conversationId,
      title: convs.get(row.conversationId) ?? "(untitled)",
      similarity: sim,
      text: row.text.slice(0, 200),
    });
  }
  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

/** Nearest neighbours to an existing conversation (used by MemoryEngine). */
export async function semanticNeighbors(conversationId: string, limit = 5): Promise<SemanticHit[]> {
  const anchor = await db.aiEmbeddings.where({ scope: "conversation", conversationId }).first();
  if (!anchor) return [];
  const rows = await db.aiEmbeddings.where("scope").equals("conversation").toArray();
  const convs = new Map<string, string>();
  for (const c of await listConversations()) convs.set(c.id, c.title);
  const out: SemanticHit[] = [];
  for (const r of rows) {
    if (r.conversationId === conversationId) continue;
    out.push({
      conversationId: r.conversationId,
      title: convs.get(r.conversationId) ?? "(untitled)",
      similarity: cosine(anchor.vector, r.vector),
      text: r.text.slice(0, 200),
    });
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

export async function embeddingStats(): Promise<{ vectors: number; tokens: number; model: string | null }> {
  const rows = await db.aiEmbeddings.toArray();
  const tokens = rows.reduce((n, r) => n + estimateTokens(r.text), 0);
  return { vectors: rows.length, tokens, model: rows[0]?.model ?? null };
}

export async function clearEmbeddings(): Promise<void> {
  await db.aiEmbeddings.clear();
}
