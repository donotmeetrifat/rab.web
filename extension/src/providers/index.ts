import type { ProviderAdapter } from "./base/ProviderAdapter";
import { ChatGPTAdapter } from "./chatgpt";
import { ClaudeAdapter } from "./claude";
import { GeminiAdapter } from "./gemini";
import { DeepSeekAdapter } from "./deepseek";
import { PerplexityAdapter } from "./perplexity";
import { CopilotAdapter } from "./copilot";
import { AIStudioAdapter } from "./aistudio";

/** Order matters: first matching adapter wins. ChatGPT ships fully; others are
 *  placeholders until their DOM integration lands (Phase 2.x). */
export function buildAdapters(): ProviderAdapter[] {
  return [
    new ChatGPTAdapter(),
    new ClaudeAdapter(),
    new GeminiAdapter(),
    new DeepSeekAdapter(),
    new PerplexityAdapter(),
    new CopilotAdapter(),
    new AIStudioAdapter(),
  ];
}

export type { ProviderAdapter } from "./base/ProviderAdapter";
export type { CapturedConversation, CapturedMessage } from "./base/types";
export { ProviderManager } from "./base/ProviderManager";
export { hashConversation } from "./base/hash";
