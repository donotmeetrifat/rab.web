/**
 * Re-exports the AIProvider interface and provider factory functions.
 * Kept as a thin barrel so consumers can `import { AIProvider } from "@/ai/AIProvider"`.
 */
export type {
  AIProvider,
  AIProviderId,
  AIModelInfo,
  AIGenerateRequest,
  AIGenerateResult,
  AIEmbedRequest,
  AIEmbedResult,
} from "./types";
export { createOpenAI } from "./providers/openai";
export { createAnthropic } from "./providers/anthropic";
export { createGemini } from "./providers/gemini";
export { createOpenRouter } from "./providers/openrouter";
export { createOllama, createLMStudio, createCustom } from "./providers/local";
export { ProviderError } from "./providers/_shared";
