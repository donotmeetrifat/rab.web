/**
 * KnowledgeEngine — public entry point that other modules call after a
 * conversation is saved / deleted. Deduplicates concurrent index runs
 * per conversation so rapid successive saves collapse to one pass.
 */
import type { StoredConversation, StoredConvMessage } from "@/types";
import {
  backfillKnowledge,
  indexConversation,
  removeKnowledgeForConversation,
  type IndexResult,
} from "./indexer";

const inflight = new Map<string, Promise<IndexResult>>();

export function onConversationSaved(
  conversation: StoredConversation,
  messages?: StoredConvMessage[],
): Promise<IndexResult> {
  const existing = inflight.get(conversation.id);
  if (existing) return existing;
  const run = indexConversation(conversation, messages).finally(() => {
    inflight.delete(conversation.id);
  });
  inflight.set(conversation.id, run);
  return run;
}

export function onConversationDeleted(conversationId: string): Promise<void> {
  return removeKnowledgeForConversation(conversationId);
}

/** Schedule a backfill on next idle tick — safe to call repeatedly. */
export function scheduleKnowledgeBackfill(): void {
  const run = () => {
    backfillKnowledge().catch((err) => {
      // Best-effort; the sidepanel Knowledge tab surfaces errors visibly.
      console.warn("[memlace] knowledge backfill failed", err);
    });
  };
  const w = globalThis as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 250);
  }
}

export { backfillKnowledge } from "./indexer";
