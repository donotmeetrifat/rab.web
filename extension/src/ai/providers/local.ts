import type { AIProvider, AIModelInfo } from "../types";
import {
  ProviderError,
  buildEmbedResult,
  buildGenerateResult,
  estimateTokens,
  httpJson,
  makeCostEstimator,
  openaiChat,
  type ProviderConfig,
} from "./_shared";

const DEFAULT_MODELS: AIModelInfo[] = [
  { id: "llama3.2", label: "Llama 3.2 (local)", context: 128000, inputPer1M: 0, outputPer1M: 0 },
  { id: "qwen2.5", label: "Qwen 2.5 (local)", context: 32000, inputPer1M: 0, outputPer1M: 0 },
  { id: "nomic-embed-text", label: "nomic-embed-text (local)", context: 8192, inputPer1M: 0, outputPer1M: 0, supportsEmbeddings: true },
];

const DEFAULT_BASE = "http://localhost:11434";

export function createOllama(cfg: ProviderConfig): AIProvider {
  const base = (cfg.baseUrl?.trim() || DEFAULT_BASE).replace(/\/$/, "");
  return {
    id: "ollama",
    label: "Ollama (local)",
    requiresKey: false,
    models: () => DEFAULT_MODELS,
    estimateCost: makeCostEstimator(),
    async generate(req) {
      // Ollama exposes an OpenAI-compatible endpoint at /v1/chat/completions.
      const out = await openaiChat(`${base}/v1`, null, req, cfg.chatModel);
      return buildGenerateResult("ollama", out.model, out.text, out.usage);
    },
    async embed(req) {
      const model = req.model ?? (cfg.embeddingModel || "nomic-embed-text");
      const input = Array.isArray(req.input) ? req.input : [req.input];
      const vectors: number[][] = [];
      for (const text of input) {
        interface Resp { embedding: number[] }
        const data = await httpJson<Resp>(`${base}/api/embeddings`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, prompt: text }),
          signal: req.signal,
        });
        vectors.push(data.embedding);
      }
      const inputTokens = input.reduce((n, s) => n + estimateTokens(s), 0);
      return buildEmbedResult("ollama", model, vectors, inputTokens);
    },
    async validateKey() {
      try {
        const res = await fetch(`${base}/api/tags`);
        if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Cannot reach Ollama" };
      }
    },
  };
}

export function createLMStudio(cfg: ProviderConfig): AIProvider {
  const base = (cfg.baseUrl?.trim() || "http://localhost:1234/v1").replace(/\/$/, "");
  const openai = {
    generate: (req: Parameters<AIProvider["generate"]>[0]) => openaiChat(base, null, req, cfg.chatModel),
  };
  return {
    id: "lmstudio",
    label: "LM Studio (local)",
    requiresKey: false,
    models: () => DEFAULT_MODELS,
    estimateCost: makeCostEstimator(),
    async generate(req) {
      const out = await openai.generate(req);
      return buildGenerateResult("lmstudio", out.model, out.text, out.usage);
    },
    async embed(req) {
      const model = req.model ?? cfg.embeddingModel;
      const input = Array.isArray(req.input) ? req.input : [req.input];
      interface Resp { data?: { embedding: number[]; index: number }[] }
      const data = await httpJson<Resp>(`${base}/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, input }),
        signal: req.signal,
      });
      const vectors = (data.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
      const inputTokens = input.reduce((n, s) => n + estimateTokens(s), 0);
      return buildEmbedResult("lmstudio", model, vectors, inputTokens);
    },
    async validateKey() {
      try {
        const res = await fetch(`${base}/models`);
        if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Cannot reach LM Studio" };
      }
    },
  };
}

export function createCustom(cfg: ProviderConfig): AIProvider {
  const base = (cfg.baseUrl?.trim() || "").replace(/\/$/, "");
  if (!base) {
    // Return a stub that fails fast with a helpful message.
    return {
      id: "custom",
      label: "Custom endpoint",
      requiresKey: false,
      models: () => [],
      estimateCost: makeCostEstimator(),
      generate: async () => {
        throw new ProviderError("Set a Base URL for the custom provider first");
      },
      embed: async () => {
        throw new ProviderError("Set a Base URL for the custom provider first");
      },
      validateKey: async () => ({ ok: false, error: "No base URL configured" }),
    };
  }
  return {
    id: "custom",
    label: "Custom endpoint",
    requiresKey: false,
    models: () => DEFAULT_MODELS,
    estimateCost: makeCostEstimator(),
    async generate(req) {
      const out = await openaiChat(base, cfg.apiKey || null, req, cfg.chatModel);
      return buildGenerateResult("custom", out.model, out.text, out.usage);
    },
    async embed(req) {
      const model = req.model ?? cfg.embeddingModel;
      const input = Array.isArray(req.input) ? req.input : [req.input];
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
      interface Resp { data?: { embedding: number[]; index: number }[] }
      const data = await httpJson<Resp>(`${base}/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, input }),
        signal: req.signal,
      });
      const vectors = (data.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
      const inputTokens = input.reduce((n, s) => n + estimateTokens(s), 0);
      return buildEmbedResult("custom", model, vectors, inputTokens);
    },
    async validateKey() {
      try {
        const res = await fetch(`${base}/models`, {
          headers: cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : undefined,
        });
        if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "network error" };
      }
    },
  };
}
