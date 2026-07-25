/**
 * Recommender — picks the best "Continue with…" target for the current
 * conversation. Pure heuristics, no AI: fast enough to run on every
 * panel open. Never forces a provider — the UI treats this as a hint.
 */
import type { ContinuationProviderId } from "@/lib/continuation";
import type { StoredConversation, StoredConvMessage } from "@/types";
import type { KnowledgeRecord } from "@/knowledge/types";

export interface Recommendation {
  target: ContinuationProviderId;
  reason: string;
}

interface Args {
  conversation: StoredConversation;
  messages: StoredConvMessage[];
  knowledge?: KnowledgeRecord | null;
}

const FRESHNESS_HINTS = /\b(latest|today|current|news|202[4-9]|pric(e|ing)|release|breaking|search the web|up[- ]to[- ]date)\b/i;
const CODE_HINTS = /```|\bfunction\b|\bclass\b|\bimport\s|npm\s|bun\s|error:|traceback|stack trace/i;
const ARCH_HINTS = /\b(architect|architecture|design pattern|trade[- ]off|scal(e|ing|ability)|structure|refactor|plan|approach|strategy)\b/i;
const LONGFORM_HINTS = /\b(essay|write up|draft|outline|documentation|readme|specification|spec\b)\b/i;

export function recommend({ conversation, messages, knowledge }: Args): Recommendation {
  // Sample the newest 6 messages — that's what "continuation" really means.
  const tail = messages.slice(-6).map((m) => m.markdown || m.content || "").join("\n");
  const hasCode = CODE_HINTS.test(tail) || (knowledge?.codeBlocks?.length ?? 0) > 0;
  const wantsFresh = FRESHNESS_HINTS.test(tail);
  const wantsArch = ARCH_HINTS.test(tail);
  const wantsLong = LONGFORM_HINTS.test(tail) || tail.length > 4000;

  if (wantsFresh) {
    return {
      target: "perplexity",
      reason: "Fresh web information is likely needed.",
    };
  }
  if (wantsArch || wantsLong) {
    return {
      target: "claude",
      reason: "Best for architecture and long-form thinking.",
    };
  }
  if (hasCode) {
    // Stay on ChatGPT for coding continuations by default.
    if (conversation.provider === "chatgpt") {
      return { target: "claude", reason: "A fresh perspective on the same code." };
    }
    return { target: "chatgpt", reason: "Best continuation for coding work." };
  }
  // Default: avoid recommending the same provider the user is already on.
  if (conversation.provider === "claude") {
    return { target: "chatgpt", reason: "A quick second opinion." };
  }
  return { target: "claude", reason: "Great all-round continuation." };
}
