/**
 * Memlace OS — internal Event Bus (Phase 13).
 *
 * Lightweight in-process pub/sub. Modules subscribe to events; the
 * Orchestrator emits them. No module should import another module's
 * side-effectful functions directly — always go through the bus.
 *
 * Design goals:
 *   - Zero deps, zero DOM, safe in service worker + UI contexts.
 *   - Sync fan-out; handlers may return promises but are not awaited by
 *     default (fire-and-forget). Use `emitAndWait` when ordering matters.
 *   - Handler errors are isolated — one bad subscriber never breaks the bus.
 */

import type { StoredConversation } from "@/types";

export interface MemlaceEvents {
  "conversation.saved": {
    conversation: StoredConversation;
    created: boolean;
    source: "manual" | "auto" | "initial";
  };
  "conversation.deleted": { id: string };
  "knowledge.updated": { conversationId?: string };
  "project.updated": { projectId?: string };
  "workspace.updated": Record<string, never>;
  "context.updated": { conversationId?: string };
  "goal.completed": { goalId: string };
  "decision.changed": { topic: string };
  "cache.invalidated": { scope: string };
  "search.reindexed": Record<string, never>;
}

type EventName = keyof MemlaceEvents;
type Handler<K extends EventName> = (payload: MemlaceEvents[K]) => void | Promise<void>;

const subscribers = new Map<EventName, Set<Handler<EventName>>>();

export function on<K extends EventName>(event: K, handler: Handler<K>): () => void {
  let set = subscribers.get(event);
  if (!set) {
    set = new Set();
    subscribers.set(event, set);
  }
  set.add(handler as Handler<EventName>);
  return () => {
    set!.delete(handler as Handler<EventName>);
  };
}

export function emit<K extends EventName>(event: K, payload: MemlaceEvents[K]): void {
  const set = subscribers.get(event);
  if (!set || set.size === 0) return;
  for (const h of set) {
    try {
      const r = (h as Handler<K>)(payload);
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch((err) =>
          console.warn(`[memlace:bus] ${event} handler rejected`, err),
        );
      }
    } catch (err) {
      console.warn(`[memlace:bus] ${event} handler threw`, err);
    }
  }
}

export async function emitAndWait<K extends EventName>(
  event: K,
  payload: MemlaceEvents[K],
): Promise<void> {
  const set = subscribers.get(event);
  if (!set || set.size === 0) return;
  await Promise.allSettled(
    Array.from(set).map((h) => {
      try {
        return Promise.resolve((h as Handler<K>)(payload));
      } catch (err) {
        return Promise.reject(err);
      }
    }),
  );
}

/** For diagnostics only. */
export function _subscriberCount(): number {
  let n = 0;
  for (const s of subscribers.values()) n += s.size;
  return n;
}
