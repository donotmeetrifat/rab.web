/**
 * Universal Context Engine — shared internal model.
 *
 * The engine turns a saved conversation (plus its neighbours, project,
 * knowledge, decisions and goals) into a single provider-agnostic
 * ContextPackage. Provider adapters render this package into their
 * preferred prompt format; the core engine stays provider-free.
 */
import type { ProviderId, StoredConversation } from "@/types";

export type ContextItemKind =
  | "current-conversation"
  | "recent-message"
  | "decision"
  | "goal"
  | "code"
  | "knowledge"
  | "summary"
  | "related-conversation"
  | "session"
  | "project"
  | "file"
  | "constraint";

/**
 * A single unit the compressor may keep or drop. `priority` is the
 * *intrinsic* importance (0..100); the compressor combines it with
 * recency and per-provider budgets to decide inclusion.
 */
export interface ContextItem {
  id: string;
  kind: ContextItemKind;
  /** Short human label — used in the preview UI only. */
  label: string;
  /** Prompt-ready text that will be inlined into the final package. */
  text: string;
  /** 0..100. Higher wins under budget pressure. */
  priority: number;
  /** ms since epoch — used as a tie-breaker for equal priority. */
  updatedAt: number;
  /** Optional provenance for the preview drawer. */
  sourceConversationId?: string;
  meta?: Record<string, string | number | boolean>;
}

export interface ExtractedDecision {
  id: string;
  conversationId: string;
  /** Normalized short sentence, e.g. "Use Supabase for auth". */
  statement: string;
  polarity: "adopt" | "reject" | "complete" | "unresolved";
  /** Original message id where the decision was first seen. */
  messageId: string;
  /** Higher = more confident. */
  confidence: number;
  /** ms since epoch. */
  detectedAt: number;
  /** ID this decision supersedes, if any. */
  supersedes?: string;
}

export interface DetectedGoal {
  id: string;
  conversationId: string;
  /** Short imperative label, e.g. "Deploy to Vercel". */
  label: string;
  status: "active" | "completed" | "abandoned";
  updatedAt: number;
  confidence: number;
}

export type ContextSizeBucket = "small" | "medium" | "large" | "full";

/** Output of the engine — provider-agnostic. */
export interface ContextPackage {
  /** Stable id — hash of the ingredient set. Used for cache lookups. */
  id: string;
  conversationId: string;
  /** Provider we're targeting. */
  target: ProviderId;
  /** Items in inclusion order (already compressed). */
  items: ContextItem[];
  /** Preview-friendly summary bullets ("3 recent chats", …). */
  summary: string[];
  /** Approximate character cost of the rendered prompt. */
  chars: number;
  /** Rough size bucket for the preview UI. */
  size: ContextSizeBucket;
  /** Whether the compressor dropped anything to fit budget. */
  truncated: boolean;
  /** Ingredients considered vs kept (informational). */
  counts: {
    consideredMessages: number;
    keptMessages: number;
    decisions: number;
    goals: number;
    codeBlocks: number;
    relatedConversations: number;
  };
  /** Internal quality score (0..1). Not shown in UI. */
  qualityScore: number;
  /** Rendered prompt for the target provider. */
  prompt: string;
  builtAt: number;
}

export interface BuildContextInput {
  conversation: StoredConversation;
  target: ProviderId;
  /** Optional override — otherwise inferred from target adapter limits. */
  charBudget?: number;
}
