/**
 * Shared helpers for provider implementations.
 */
import { estimateCostUSD, estimateEmbedCostUSD, priceOf } from "../CostEstimator";
import { estimateTokens } from "../TokenCounter";
import type {
  AIEmbedRequest,
  AIEmbedResult,
  AIGenerateRequest,
  AIGenerateResult,
  AIModelInfo,
  AIProvider,
  AIProviderId,
} from "../types";

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  chatModel: string;
  embeddingModel: string;
  temperature: number;
  maxTokens: number;
}

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
    this.name = "ProviderError";
  }
}

export async function httpJson<T>(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.text();
      if (body) msg += ` — ${body.slice(0, 300)}`;
    } catch {
      /* ignore */
    }
    throw new ProviderError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export function makeCostEstimator(): AIProvider["estimateCost"] {
  return (model, i, o) => estimateCostUSD(model, i, o);
}

export function makeEmbedCostEstimator(model: string, inputTokens: number): number {
  return estimateEmbedCostUSD(model, inputTokens);
}

export { estimateTokens, priceOf };

/** Common OpenAI-compatible chat call — used by OpenAI, OpenRouter, Ollama, LM Studio, Custom. */
export async function openaiChat(
  baseUrl: string,
  apiKey: string | null,
  req: AIGenerateRequest,
  fallbackModel: string,
): Promise<{ text: string; model: string; usage: { inputTokens: number; outputTokens: number } }> {
  const model = req.model ?? fallbackModel;
  const messages: { role: string; content: string }[] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.prompt });
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 1024,
  };
  if (req.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  interface ChatResp {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  }

  const data = await httpJson<ChatResp>(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const text = data.choices?.[0]?.message?.content ?? "";
  const inputTokens = data.usage?.prompt_tokens ?? estimateTokens(req.prompt + (req.system ?? ""));
  const outputTokens = data.usage?.completion_tokens ?? estimateTokens(text);
  return { text, model, usage: { inputTokens, outputTokens } };
}

/** Common OpenAI-compatible embeddings call. */
export async function openaiEmbed(
  baseUrl: string,
  apiKey: string | null,
  req: AIEmbedRequest,
  fallbackModel: string,
): Promise<{ vectors: number[][]; model: string; inputTokens: number }> {
  const model = req.model ?? fallbackModel;
  const input = Array.isArray(req.input) ? req.input : [req.input];
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  interface EmbedResp {
    data?: { embedding: number[]; index: number }[];
    usage?: { prompt_tokens?: number };
  }

  const data = await httpJson<EmbedResp>(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, input }),
    signal: req.signal,
  });

  const vectors = (data.data ?? [])
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
  const inputTokens = data.usage?.prompt_tokens ?? input.reduce((n, s) => n + estimateTokens(s), 0);
  return { vectors, model, inputTokens };
}

export function buildGenerateResult(
  provider: AIProviderId,
  model: string,
  text: string,
  usage: { inputTokens: number; outputTokens: number },
): AIGenerateResult {
  const p = priceOf(model);
  const costUSD =
    p.input == null || p.output == null
      ? 0
      : estimateCostUSD(model, usage.inputTokens, usage.outputTokens);
  void provider;
  return { text, model, usage, costUSD };
}

export function buildEmbedResult(
  provider: AIProviderId,
  model: string,
  vectors: number[][],
  inputTokens: number,
): AIEmbedResult {
  void provider;
  const costUSD = estimateEmbedCostUSD(model, inputTokens);
  return { vectors, model, usage: { inputTokens }, costUSD };
}

export type { AIModelInfo };
