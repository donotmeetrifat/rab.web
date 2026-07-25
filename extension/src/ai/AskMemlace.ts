/**
 * AskMemlace — RAG over the user's own saved conversations.
 *
 * The user asks a natural-language question; we pull the top-K
 * conversations by semantic similarity, stuff their summaries + a short
 * transcript slice into the prompt, and ask the model to answer citing
 * conversation ids. Nothing leaves the machine except the prompt itself.
 */
import { getConversation, listConversationMessages } from "@/services/conversations";
import { getSettings } from "./AIManager";
import { runPrompt, serializeConversation } from "./PromptEngine";
import { search } from "./SemanticSearch";
import { getSummary } from "./SummaryEngine";
import { estimateTokens, truncateToTokens } from "./TokenCounter";
import type { AIProviderId } from "./types";

export interface AskCitation {
  conversationId: string;
  title: string;
  score: number;
}

export interface AskAnswer {
  question: string;
  answer: string;
  citations: AskCitation[];
  usage: { inputTokens: number; outputTokens: number };
  costUSD: number;
  provider: AIProviderId;
  model: string;
  cached: boolean;
}

const SYSTEM = `You are Memlace, an assistant with access only to the user's own saved AI conversations.
Rules:
- Answer strictly from the provided CONTEXT. Never invent facts.
- Cite sources inline as [id] using the conversation ids given in CONTEXT.
- If the answer isn't in CONTEXT, say so plainly and suggest what to search for.
- Never mention that you were given CONTEXT, and never claim to browse the internet.`;

async function buildContextBlock(convIds: string[], budget: number): Promise<string> {
  const chunks: string[] = [];
  let used = 0;
  for (const id of convIds) {
    const conv = await getConversation(id);
    if (!conv) continue;
    const sum = await getSummary(id);
    let block = `--- [${id}] ${conv.title} (${conv.provider}) ---\n`;
    if (sum?.shortSummary) block += `Summary: ${sum.shortSummary}\n`;
    if (sum?.takeaways?.length) block += `Takeaways: ${sum.takeaways.slice(0, 5).join(" • ")}\n`;
    const messages = await listConversationMessages(id);
    const perConv = Math.max(400, Math.floor((budget - used) / Math.max(1, convIds.length)));
    block += serializeConversation(conv, messages.slice(-6), { maxTokens: perConv });
    const cost = estimateTokens(block);
    if (used + cost > budget) break;
    used += cost;
    chunks.push(block);
  }
  return chunks.join("\n\n");
}

export async function askMemlace(
  question: string,
  opts: { topK?: number; signal?: AbortSignal } = {},
): Promise<AskAnswer> {
  const q = question.trim();
  if (!q) throw new Error("Empty question");
  const topK = Math.max(1, Math.min(8, opts.topK ?? 5));

  const hits = await search(q, topK);
  const citations: AskCitation[] = hits.map((h) => ({
    conversationId: h.conversationId,
    title: h.title,
    score: h.score,
  }));

  const settings = await getSettings();
  const context = await buildContextBlock(
    hits.map((h) => h.conversationId),
    Math.max(1000, settings.maxTokens * 6),
  );

  const prompt = `QUESTION:\n${q}\n\nCONTEXT (only source of truth):\n${truncateToTokens(context, 6000)}\n\nAnswer the question, citing [id] tokens for every claim.`;
  const result = await runPrompt({
    system: SYSTEM,
    prompt,
    temperature: 0.2,
    maxTokens: 900,
    signal: opts.signal,
  });

  return {
    question: q,
    answer: result.text.trim(),
    citations,
    usage: result.usage,
    costUSD: result.costUSD,
    provider: settings.provider,
    model: result.model,
    cached: result.cached,
  };
}
