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
  { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", context: 200000, inputPer1M: 0.8, outputPer1M: 4 },
  { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", context: 200000, inputPer1M: 3, outputPer1M: 15 },
  { id: "claude-3-opus-latest", label: "Claude 3 Opus", context: 200000, inputPer1M: 15, outputPer1M: 75 },
];

const BASE = "https://api.anthropic.com/v1";

export function createAnthropic(cfg: ProviderConfig): AIProvider {
  const base = cfg.baseUrl?.trim() || BASE;
  return {
    id: "anthropic",
    label: "Anthropic (Claude)",
    requiresKey: true,
    models: () => MODELS,
    estimateCost: makeCostEstimator(),
    async generate(req) {
      if (!cfg.apiKey) throw new ProviderError("Missing Anthropic API key");
      const model = req.model ?? cfg.chatModel;

      interface Resp {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      }

      const data = await httpJson<Resp>(`${base}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
          // Required to allow browser origins.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens ?? 1024,
          temperature: req.temperature ?? 0.3,
          system: req.system,
          messages: [{ role: "user", content: req.prompt }],
        }),
        signal: req.signal,
      });

      const text = (data.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      const inputTokens = data.usage?.input_tokens ?? estimateTokens(req.prompt + (req.system ?? ""));
      const outputTokens = data.usage?.output_tokens ?? estimateTokens(text);
      return buildGenerateResult("anthropic", model, text, { inputTokens, outputTokens });
    },
    async embed() {
      throw new ProviderError("Anthropic has no embeddings API — pick another provider for semantic search");
    },
    async validateKey() {
      if (!cfg.apiKey) return { ok: false, error: "No API key set" };
      try {
        // Lightweight ping — 1-token generation of "ok".
        const res = await fetch(`${base}/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": cfg.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: cfg.chatModel || "claude-3-5-haiku-latest",
            max_tokens: 1,
            messages: [{ role: "user", content: "ok" }],
          }),
        });
        if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "network error" };
      }
    },
  };
}
