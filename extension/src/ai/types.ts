/**
 * Shared AI Intelligence Layer types (Phase 8).
 *
 * Everything AI is optional and off by default. When disabled, no module in
 * this folder makes network requests. When enabled, all traffic goes
 * directly from the user's browser to the provider they configured — never
 * to a Memlace server.
 */

export type AIProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "ollama"
  | "lmstudio"
  | "custom";

export interface AIModelInfo {
  id: string;
  label: string;
  context: number;
  /** USD per 1M input tokens. `null` = free / self-hosted. */
  inputPer1M: number | null;
  /** USD per 1M output tokens. */
  outputPer1M: number | null;
  supportsEmbeddings?: boolean;
}

export interface AIGenerateRequest {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  /** JSON-mode hint — providers that support it will bias to strict JSON. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface AIGenerateResult {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  costUSD: number;
}

export interface AIEmbedRequest {
  input: string | string[];
  model?: string;
  signal?: AbortSignal;
}

export interface AIEmbedResult {
  vectors: number[][];
  model: string;
  usage: { inputTokens: number };
  costUSD: number;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly label: string;
  readonly requiresKey: boolean;
  models(): AIModelInfo[];
  generate(req: AIGenerateRequest): Promise<AIGenerateResult>;
  embed(req: AIEmbedRequest): Promise<AIEmbedResult>;
  estimateCost(model: string, inputTokens: number, outputTokens: number): number;
  validateKey(): Promise<{ ok: true } | { ok: false; error: string }>;
}

/* --------------------------------- settings -------------------------------- */

export interface AISettings {
  enabled: boolean;
  provider: AIProviderId;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  temperature: number;
  maxTokens: number;
  allowLocalModels: boolean;
  /** Auto-run summary/title/tag on newly saved conversations. */
  autoEnrich: boolean;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: "openai",
  apiKey: "",
  baseUrl: "",
  chatModel: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  temperature: 0.3,
  maxTokens: 1024,
  allowLocalModels: false,
  autoEnrich: false,
};

/* ----------------------------------- jobs ---------------------------------- */

export type AIJobKind =
  | "title"
  | "summary"
  | "tags"
  | "memory"
  | "embed"
  | "ask"
  | "custom";

export type AIJobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export interface AIJob {
  id: string;
  kind: AIJobKind;
  label: string;
  status: AIJobStatus;
  conversationId?: string;
  progress: number;
  attempts: number;
  maxAttempts: number;
  error?: string;
  provider: AIProviderId;
  model: string;
  estInputTokens: number;
  estOutputTokens: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
  costUSD?: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

/* --------------------------------- results --------------------------------- */

export interface AIConversationSummary {
  id: string;
  conversationId: string;
  provider: AIProviderId;
  model: string;
  hash: string;
  title?: string;
  shortSummary?: string;
  longSummary?: string;
  takeaways?: string[];
  decisions?: string[];
  actionItems?: string[];
  questionsAsked?: string[];
  questionsAnswered?: string[];
  technologies?: string[];
  languages?: string[];
  libraries?: string[];
  frameworks?: string[];
  databases?: string[];
  cloud?: string[];
  apis?: string[];
  importantUrls?: string[];
  importantFiles?: string[];
  importantCode?: { language?: string; code: string }[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  topics?: string[];
  category?: string;
  smartTags?: string[];
  importanceScore?: number;
  learningScore?: number;
  updatedAt: number;
}

export interface AIEmbeddingRow {
  id: string;
  scope: "conversation" | "message" | "chunk";
  conversationId: string;
  messageId?: string;
  chunkIndex: number;
  text: string;
  vector: number[];
  model: string;
  provider: AIProviderId;
  hash: string;
  createdAt: number;
}

export interface AIPromptCacheRow {
  /** sha1(prompt+system+model+temperature). */
  hash: string;
  provider: AIProviderId;
  model: string;
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  costUSD: number;
  createdAt: number;
}

export interface AIUsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
}
