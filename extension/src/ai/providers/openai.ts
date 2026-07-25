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
  { id: "gpt-4o-mini", label: "GPT-4o mini", context: 128000, inputPer1M: 0.15, outputPer1M: 0.6 },
  { id: "gpt-4o", label: "GPT-4o", context: 128000, inputPer1M: 2.5, outputPer1M: 10 },
  { id: "gpt-4.1", label: "GPT-4.1", context: 1_000_000, inputPer1M: 2, outputPer1M: 8 },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", context: 1_000_000, inputPer1M: 0.4, outputPer1M: 1.6 },
  { id: "gpt-4.1-nano", label: "GPT-4.1 nano", context: 1_000_000, inputPer1M: 0.1, outputPer1M: 0.4 },
  { id: "o3-mini", label: "o3-mini (reasoning)", context: 200000, inputPer1M: 1.1, outputPer1M: 4.4 },
  { id: "text-embedding-3-small", label: "Embeddings (small)", context: 8192, inputPer1M: 0.02, outputPer1M: 0, supportsEmbeddings: true },
  { id: "text-embedding-3-large", label: "Embeddings (large)", context: 8192, inputPer1M: 0.13, outputPer1M: 0, supportsEmbeddings: true },
];

const BASE = "https://api.openai.com/v1";

export function createOpenAI(cfg: ProviderConfig): AIProvider {
  const base = cfg.baseUrl?.trim() || BASE;
  return {
    id: "openai",
    label: "OpenAI",
    requiresKey: true,
    models: () => MODELS,
    estimateCost: makeCostEstimator(),
    async generate(req) {
      if (!cfg.apiKey) throw new ProviderError("Missing OpenAI API key");
      const out = await openaiChat(base, cfg.apiKey, req, cfg.chatModel);
      return buildGenerateResult("openai", out.model, out.text, out.usage);
    },
    async embed(req) {
      if (!cfg.apiKey) throw new ProviderError("Missing OpenAI API key");
      const out = await openaiEmbed(base, cfg.apiKey, req, cfg.embeddingModel);
      return buildEmbedResult("openai", out.model, out.vectors, out.inputTokens);
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
