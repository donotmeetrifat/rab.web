/**
 * Static price book (USD per 1M tokens). Prices are the publicly
 * advertised list rates at the time of writing; users can override by
 * pointing Memlace at a custom OpenAI-compatible endpoint.
 */
import type { AIProviderId } from "./types";

interface Price {
  input: number | null;
  output: number | null;
  embed?: number;
}

const PRICES: Record<string, Price> = {
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "text-embedding-3-small": { input: 0.02, output: 0, embed: 0.02 },
  "text-embedding-3-large": { input: 0.13, output: 0, embed: 0.13 },
  // Anthropic
  "claude-3-5-sonnet-latest": { input: 3, output: 15 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },
  "claude-3-opus-latest": { input: 15, output: 75 },
  // Gemini
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "text-embedding-004": { input: 0, output: 0, embed: 0 },
  // Local / self-hosted
  "__local__": { input: 0, output: 0, embed: 0 },
};

export function priceOf(model: string): Price {
  return PRICES[model] ?? { input: null, output: null };
}

export function estimateCostUSD(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = priceOf(model);
  const inCost = p.input == null ? 0 : (inputTokens / 1_000_000) * p.input;
  const outCost = p.output == null ? 0 : (outputTokens / 1_000_000) * p.output;
  return Number((inCost + outCost).toFixed(6));
}

export function estimateEmbedCostUSD(model: string, inputTokens: number): number {
  const p = priceOf(model);
  const rate = p.embed ?? p.input ?? 0;
  return Number(((inputTokens / 1_000_000) * (rate ?? 0)).toFixed(6));
}

export function formatCost(usd: number): string {
  if (usd === 0) return "Free";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function isLocalProvider(id: AIProviderId): boolean {
  return id === "ollama" || id === "lmstudio";
}
