import type { AIProvider, AIModelInfo } from "../types";
import {
  ProviderError,
  buildEmbedResult,
  buildGenerateResult,
  estimateTokens,
  httpJson,
  makeCostEstimator,
  type ProviderConfig,
} from "./_shared";

const MODELS: AIModelInfo[] = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", context: 1_000_000, inputPer1M: 0.1, outputPer1M: 0.4 },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", context: 1_000_000, inputPer1M: 0.075, outputPer1M: 0.3 },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", context: 2_000_000, inputPer1M: 1.25, outputPer1M: 5 },
  { id: "text-embedding-004", label: "Gemini Embeddings", context: 2048, inputPer1M: 0, outputPer1M: 0, supportsEmbeddings: true },
];

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export function createGemini(cfg: ProviderConfig): AIProvider {
  const base = cfg.baseUrl?.trim() || BASE;
  return {
    id: "gemini",
    label: "Google Gemini",
    requiresKey: true,
    models: () => MODELS,
    estimateCost: makeCostEstimator(),
    async generate(req) {
      if (!cfg.apiKey) throw new ProviderError("Missing Google API key");
      const model = req.model ?? cfg.chatModel;

      interface Resp {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      }

      const contents = [
        ...(req.system ? [{ role: "user", parts: [{ text: `System instructions:\n${req.system}` }] }] : []),
        { role: "user", parts: [{ text: req.prompt }] },
      ];
      const data = await httpJson<Resp>(
        `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: req.temperature ?? 0.3,
              maxOutputTokens: req.maxTokens ?? 1024,
              responseMimeType: req.json ? "application/json" : undefined,
            },
          }),
          signal: req.signal,
        },
      );

      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("");
      const inputTokens = data.usageMetadata?.promptTokenCount ?? estimateTokens(req.prompt + (req.system ?? ""));
      const outputTokens = data.usageMetadata?.candidatesTokenCount ?? estimateTokens(text);
      return buildGenerateResult("gemini", model, text, { inputTokens, outputTokens });
    },
    async embed(req) {
      if (!cfg.apiKey) throw new ProviderError("Missing Google API key");
      const model = req.model ?? (cfg.embeddingModel || "text-embedding-004");
      const input = Array.isArray(req.input) ? req.input : [req.input];

      interface Resp {
        embeddings?: { values: number[] }[];
      }

      const data = await httpJson<Resp>(
        `${base}/models/${encodeURIComponent(model)}:batchEmbedContents?key=${encodeURIComponent(cfg.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requests: input.map((text) => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
            })),
          }),
          signal: req.signal,
        },
      );

      const vectors = (data.embeddings ?? []).map((e) => e.values);
      const inputTokens = input.reduce((n, s) => n + estimateTokens(s), 0);
      return buildEmbedResult("gemini", model, vectors, inputTokens);
    },
    async validateKey() {
      if (!cfg.apiKey) return { ok: false, error: "No API key set" };
      try {
        const res = await fetch(`${base}/models?key=${encodeURIComponent(cfg.apiKey)}`);
        if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "network error" };
      }
    },
  };
}
