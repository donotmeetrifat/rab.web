import type { AIProvider, AIModelInfo } from "../types";
import {
  ProviderError,
  buildEmbedResult,
  buildGenerateResult,
  makeCostEstimator,
  openaiChat,
  openaiEmbed,
  type ProviderConfig,
} from "./_shared";

const MODELS: AIModelInfo[] = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", context: 128000, inputPer1M: 0.15, outputPer1M: 0.6 },
  { id: "openai/gpt-4o", label: "GPT-4o", context: 128000, inputPer1M: 2.5, outputPer1M: 10 },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", context: 200000, inputPer1M: 3, outputPer1M: 15 },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", context: 1_000_000, inputPer1M: 0.1, outputPer1M: 0.4 },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", context: 128000, inputPer1M: 0.13, outputPer1M: 0.4 },
];

const BASE = "https://openrouter.ai/api/v1";

export function createOpenRouter(cfg: ProviderConfig): AIProvider {
  const base = cfg.baseUrl?.trim() || BASE;
  return {
    id: "openrouter",
    label: "OpenRouter",
    requiresKey: true,
    models: () => MODELS,
    estimateCost: makeCostEstimator(),
    async generate(req) {
      if (!cfg.apiKey) throw new ProviderError("Missing OpenRouter API key");
      const out = await openaiChat(base, cfg.apiKey, req, cfg.chatModel);
      return buildGenerateResult("openrouter", out.model, out.text, out.usage);
    },
    async embed(req) {
      if (!cfg.apiKey) throw new ProviderError("Missing OpenRouter API key");
      const out = await openaiEmbed(base, cfg.apiKey, req, cfg.embeddingModel);
      return buildEmbedResult("openrouter", out.model, out.vectors, out.inputTokens);
    },
    async validateKey() {
      if (!cfg.apiKey) return { ok: false, error: "No API key set" };
      try {
        const res = await fetch(`${base}/models`, {
          headers: { authorization: `Bearer ${cfg.apiKey}` },
        });
        if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "network error" };
      }
    },
  };
}
