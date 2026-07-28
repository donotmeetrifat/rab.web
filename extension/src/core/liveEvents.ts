/**
 * Phase 14.4 — Live UI event bridge.
 *
 * The background service worker broadcasts MEMLACE_CONVERSATION_UPDATED
 * after every successful save. Every UI surface (popup, side panel,
 * options) installs this bridge ONCE via bootstrap. On receipt, it:
 *
 *   1. Invalidates the affected cache scopes (workspace, projects,
 *      context, answers, search, knowledge, timeline).
 *   2. Emits the internal `conversation.saved`-equivalent event so
 *      subscribers (Smart Workspace, Project Brain, etc.) refresh
 *      through the existing bus wiring.
 *   3. Refreshes the central zustand store so the visible list updates
 *      without React reload or window reopen.
 *
 * Diagnostics counters are exposed for the Live Event Monitor.
 */
import type { RuntimeMessage } from "@/types";
import { invalidate } from "./Cache";
import { emit } from "./EventBus";

export interface LiveEventDiag {
  lastEvent: string | null;
  lastEventAt: number | null;
  lastConversationId: string | null;
  lastProvider: string | null;
  lastRefreshAt: number | null;
  lastBroadcastAt: number | null;
  cacheInvalidations: number;
  eventCount: number;
  subscribers: number;
}

const diag: LiveEventDiag = {
  lastEvent: null,
  lastEventAt: null,
  lastConversationId: null,
  lastProvider: null,
  lastRefreshAt: null,
  lastBroadcastAt: null,
  cacheInvalidations: 0,
  eventCount: 0,
  subscribers: 0,
};

type Listener = (msg: Extract<RuntimeMessage, { type: "MEMLACE_CONVERSATION_UPDATED" }>) => void;
const listeners = new Set<Listener>();
let installed = false;

export function readLiveEventDiag(): Readonly<LiveEventDiag> {
  return { ...diag, subscribers: listeners.size };
}

export function subscribeLiveEvents(listener: Listener): () => void {
  listeners.add(listener);
  diag.subscribers = listeners.size;
  return () => {
    listeners.delete(listener);
    diag.subscribers = listeners.size;
  };
}

/** Idempotent — safe to call from every surface bootstrap. */
export function installLiveEventBridge(): void {
  if (installed) return;
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
  installed = true;

  chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
    if (!msg || msg.type !== "MEMLACE_CONVERSATION_UPDATED") return;
    const payload = msg.payload;
    diag.eventCount += 1;
    diag.lastEvent = msg.type;
    diag.lastEventAt = Date.now();
    diag.lastBroadcastAt = payload.updatedAt;
    diag.lastConversationId = payload.conversationId;
    diag.lastProvider = payload.provider;

    // Invalidate only the affected scopes — never a full wipe.
    const scopes = ["workspace", "projects", "context", "answers", "search", "knowledge", "timeline"];
    for (const scope of scopes) {
      try { invalidate(scope); diag.cacheInvalidations += 1; } catch { /* noop */ }
    }

    // Fan out to the internal bus so existing subscribers (project brain,
    // smart workspace, onboarding, etc.) refresh through the same wiring.
    try {
      emit("conversation.saved", {
        // Minimal shape — subscribers rely on `created`/`source` only.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        conversation: { id: payload.conversationId, provider: payload.provider, projectId: payload.projectId } as any,
        created: payload.created,
        source: payload.source,
      });
    } catch { /* noop */ }

    // Notify local subscribers (store refresh + component listeners).
    for (const l of listeners) {
      try { l(msg); } catch (err) { console.warn("[Memlace][liveEvents] listener threw", err); }
    }
    diag.lastRefreshAt = Date.now();
  });
}
