/**
 * SummaryEngine — generates rich structured summaries and stores them in
 * the `aiSummaries` Dexie table keyed by conversation hash. Idempotent:
 * calling it twice on an unchanged conversation returns the cached row.
 */
import { db, uid } from "@/lib/db";
import { getConversation, getConversationMessages } from "@/services/conversations";
import { getSettings } from "./AIManager";
import { runPrompt, serializeConversation, tryParseJson } from "./PromptEngine";
import { estimateTokens } from "./TokenCounter";
import type { AIConversationSummary } from "./types";

const SYSTEM = `You analyse AI chat transcripts and return strict JSON only.
Never include commentary, code fences, or trailing prose.
Every field is optional — omit rather than fabricate.`;

const SCHEMA_HINT = `{
  "title": string,
  "shortSummary": string,      // 1 sentence
  "longSummary": string,       // 2-4 paragraphs
  "takeaways": string[],
  "decisions": string[],
  "actionItems": string[],
  "questionsAsked": string[],
  "questionsAnswered": string[],
  "technologies": string[],
  "languages": string[],
  "libraries": string[],
  "frameworks": string[],
  "databases": string[],
  "cloud": string[],
  "apis": string[],
  "importantUrls": string[],
  "importantFiles": string[],
  "importantCode": [{ "language": string, "code": string }],
  "difficulty": "beginner" | "intermediate" | "advanced",
  "topics": string[],
  "category": string,
  "smartTags": string[],
  "importanceScore": number,   // 0..1
  "learningScore": number      // 0..1
}`;

export interface SummarizeOptions {
  force?: boolean;
  signal?: AbortSignal;
  onProgress?: (n: number) => void;
}

export async function summarizeConversation(
  conversationId: string,
  opts: SummarizeOptions = {},
): Promise<AIConversationSummary | null> {
  const conv = await getConversation(conversationId);
  if (!conv) return null;

  const existing = await db.aiSummaries.where("conversationId").equals(conversationId).first();
  if (existing && !opts.force && existing.hash === conv.hash) return existing;

  const messages = await getConversationMessages(conversationId);
  const settings = await getSettings();
  opts.onProgress?.(0.1);

  const body = serializeConversation(conv, messages, { maxTokens: 6000 });
  const prompt = `Analyse the following AI chat transcript and return the JSON described in the schema. Schema:\n${SCHEMA_HINT}\n\nTranscript:\n${body}`;

  opts.onProgress?.(0.3);
  const result = await runPrompt({
    system: SYSTEM,
    prompt,
    temperature: 0.2,
    maxTokens: 1600,
    json: true,
    signal: opts.signal,
    skipCache: opts.force,
  });
  opts.onProgress?.(0.85);

  const parsed = tryParseJson<Partial<AIConversationSummary>>(result.text) ?? {};
  const row: AIConversationSummary = {
    id: existing?.id ?? uid("aisum"),
    conversationId,
    provider: settings.provider,
    model: result.model,
    hash: conv.hash,
    ...parsed,
    updatedAt: Date.now(),
  };
  await db.aiSummaries.put(row);
  opts.onProgress?.(1);
  return row;
}

export async function getSummary(conversationId: string): Promise<AIConversationSummary | null> {
  return (await db.aiSummaries.where("conversationId").equals(conversationId).first()) ?? null;
}

export async function listSummaries(): Promise<AIConversationSummary[]> {
  return db.aiSummaries.orderBy("updatedAt").reverse().toArray();
}

export async function deleteSummary(conversationId: string): Promise<void> {
  await db.aiSummaries.where("conversationId").equals(conversationId).delete();
}

export function estimateSummaryCost(charCount: number): { inputTokens: number; outputTokens: number } {
  const inputTokens = estimateTokens("x".repeat(Math.min(24000, charCount))) + 400;
  return { inputTokens, outputTokens: 800 };
}
