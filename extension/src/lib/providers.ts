import type { ProviderId } from "@/types";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  hostname: RegExp;
  color: string;
  url: string;
}

export const PROVIDERS: ProviderMeta[] = [
  { id: "chatgpt", name: "ChatGPT", hostname: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, color: "#10a37f", url: "https://chatgpt.com/" },
  { id: "claude", name: "Claude", hostname: /(^|\.)claude\.ai$/, color: "#d97757", url: "https://claude.ai/new" },
  { id: "gemini", name: "Gemini", hostname: /(^|\.)gemini\.google\.com$/, color: "#4285f4", url: "https://gemini.google.com/app" },
  { id: "aistudio", name: "AI Studio", hostname: /(^|\.)aistudio\.google\.com$/, color: "#8ab4f8", url: "https://aistudio.google.com/" },
  { id: "perplexity", name: "Perplexity", hostname: /(^|\.)perplexity\.ai$/, color: "#20b8cd", url: "https://www.perplexity.ai/" },
  { id: "copilot", name: "Copilot", hostname: /(^|\.)copilot\.microsoft\.com$/, color: "#0078d4", url: "https://copilot.microsoft.com/" },
  { id: "deepseek", name: "DeepSeek", hostname: /(^|\.)chat\.deepseek\.com$/, color: "#4d6bfe", url: "https://chat.deepseek.com/" },
];

export function detectProvider(url: string | undefined | null): ProviderId {
  if (!url) return "other";
  try {
    const { hostname } = new URL(url);
    return PROVIDERS.find((p) => p.hostname.test(hostname))?.id ?? "other";
  } catch {
    return "other";
  }
}

export function providerMeta(id: ProviderId): ProviderMeta | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}
