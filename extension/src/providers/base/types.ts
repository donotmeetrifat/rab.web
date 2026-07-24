import type { ProviderId } from "@/types";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface CapturedAttachment {
  kind: "image" | "file" | "link";
  name?: string;
  url?: string;
  mime?: string;
}

export interface CapturedMessage {
  /** Stable id from the provider DOM when available, else content-hashed. */
  id: string;
  role: MessageRole;
  /** Plain-text rendering (best-effort) — used for search & fallbacks. */
  content: string;
  /** Markdown rendering that preserves code fences, lists, tables. */
  markdown: string;
  attachments: CapturedAttachment[];
  images: string[];
  /** Free-form per-provider metadata (model, thinking, timestamp, …). */
  metadata: Record<string, unknown>;
  /** Position in the conversation (0-based). */
  order: number;
}

export interface CapturedConversation {
  provider: ProviderId;
  /** Provider-scoped conversation id (e.g. ChatGPT `/c/<uuid>`). */
  conversationId: string;
  title: string;
  url: string;
  model: string | null;
  messages: CapturedMessage[];
  capturedAt: number;
}

export interface ConversationHash {
  hash: string;
  messageCount: number;
}
