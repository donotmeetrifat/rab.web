/**
 * AIManager — routes to the currently-configured provider.
 *
 * All AI features (summary, tagging, embeddings, chat) call through
 * `getProvider()` here. Never construct a provider directly; going through
 * the manager guarantees we honour `settings.enabled` and always use the
 * user's latest key/model.
 */
import type {
  AIEmbedRequest,
  AIGenerateRequest,
  AIProvider,
  AIProviderId,
  AISettings,
} from "./types";
import {
  createAnthropic,
  createCustom,
  createGemini,
  createLMStudio,
  createOllama,
  createOpenAI,
  createOpenRouter,
  ProviderError,
} from "./AIProvider";
import { loadAISettings, subscribeAISettings } from "./AISettings";
import { isLocalProvider } from "./CostEstimator";

let cache: { settings: AISettings; provider: AIProvider } | null = null;
let sub: (() => void) | null = null;

function build(settings: AISettings): AIProvider {
  const cfg = {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    chatModel: settings.chatModel,
    embeddingModel: settings.embeddingModel,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  };
  switch (settings.provider) {
    case "openai": return createOpenAI(cfg);
    case "anthropic": return createAnthropic(cfg);
    case "gemini": return createGemini(cfg);
    case "openrouter": return createOpenRouter(cfg);
    case "ollama": return createOllama(cfg);
    case "lmstudio": return createLMStudio(cfg);
    case "custom": return createCustom(cfg);
  }
}

function ensureSubscription(): void {
  if (sub) return;
  sub = subscribeAISettings((s) => {
    cache = { settings: s, provider: build(s) };
  });
}

export async function getSettings(): Promise<AISettings> {
  ensureSubscription();
  if (cache) return cache.settings;
  const s = await loadAISettings();
  cache = { settings: s, provider: build(s) };
  return s;
}

export async function getProvider(): Promise<AIProvider> {
  ensureSubscription();
  if (cache) return cache.provider;
  const s = await loadAISettings();
  cache = { settings: s, provider: build(s) };
  return cache.provider;
}

export async function isAIEnabled(): Promise<boolean> {
  const s = await getSettings();
  if (!s.enabled) return false;
  if (isLocalProvider(s.provider) && !s.allowLocalModels) return false;
  const provider = await getProvider();
  return !provider.requiresKey || Boolean(s.apiKey);
}

export function assertEnabled(settings: AISettings): void {
  if (!settings.enabled) throw new ProviderError("AI is disabled in Memlace settings");
  if (isLocalProvider(settings.provider) && !settings.allowLocalModels) {
    throw new ProviderError("Local AI models are disabled in Memlace settings");
  }
}

/** Convenience helpers that guard on `enabled`. */
export async function generate(req: AIGenerateRequest) {
  const s = await getSettings();
  assertEnabled(s);
  const p = await getProvider();
  return p.generate({
    temperature: s.temperature,
    maxTokens: s.maxTokens,
    model: s.chatModel,
    ...req,
  });
}

export async function embed(req: AIEmbedRequest) {
  const s = await getSettings();
  assertEnabled(s);
  const p = await getProvider();
  return p.embed({ model: s.embeddingModel, ...req });
}

export async function validateKey(): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = await getProvider();
  return p.validateKey();
}

export function providerLabel(id: AIProviderId): string {
  switch (id) {
    case "openai": return "OpenAI";
    case "anthropic": return "Anthropic (Claude)";
    case "gemini": return "Google Gemini";
    case "openrouter": return "OpenRouter";
    case "ollama": return "Ollama (local)";
    case "lmstudio": return "LM Studio (local)";
    case "custom": return "Custom endpoint";
  }
}
