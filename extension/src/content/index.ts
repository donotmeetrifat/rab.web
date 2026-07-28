/**
 * Memlace content script. Runs on every supported AI provider page.
 *
 * Invisible Auto Memory: the ProviderManager watches the active conversation,
 * waits for the AI response to finish streaming (quiet DOM window), hashes
 * the result, and persists to IndexedDB automatically. The user never
 * presses Save — a tiny status pill on the page reflects Watching / Syncing
 * / Synced / Error.
 *
 * Storage happens in this content-script context (IndexedDB is available
 * here and shared across the extension), so saves are direct and durable
 * as soon as the transaction commits — surviving browser crashes. The
 * background worker is only notified for optional toast notifications.
 */
import type { RuntimeMessage, Settings } from "@/types";
import { ProviderManager, buildAdapters } from "@/providers";
import { saveConversation } from "@/services/conversations";
import { DEFAULT_SETTINGS, loadSettings, subscribeSettings } from "@/services/settings";
import { db } from "@/lib/db";
import { traceStateFlow } from "@/providers/base/stateTrace";

let currentSettings: Settings = DEFAULT_SETTINGS;
loadSettings().then((s) => { currentSettings = s; });
subscribeSettings((s) => { currentSettings = s; });

const manager = new ProviderManager(buildAdapters(), {
  isAutoSaveEnabled: () => currentSettings.autoSaveConversations,
  onConversationChanged: async ({ conversation, hash, reason }) => {
    traceStateFlow("onConversationChanged() entered", "content.onConversationChanged", {
      conversationId: conversation.conversationId,
      provider: conversation.provider,
      currentWatchState: "saving",
      previousWatchState: "saving",
      detail: { reason },
    });
    try {
      const { conversation: stored, created } = await saveConversation(conversation, {
        hash,
        source: reason,
        saveImages: currentSettings.saveImages,
        saveAttachments: currentSettings.saveAttachments,
      });
      traceStateFlow("saveConversation() returned", "content.onConversationChanged", {
        conversationId: stored.id,
        provider: conversation.provider,
        currentWatchState: "saving",
        previousWatchState: "saving",
        detail: { created },
      });

      // Verify the row actually landed in IndexedDB before reporting Synced.
      const verified = Boolean(await db.conversations.get(stored.id));
      traceStateFlow("Caller verification read completed", "content.onConversationChanged", {
        conversationId: stored.id,
        provider: conversation.provider,
        currentWatchState: "saving",
        previousWatchState: "saving",
        detail: { rowExists: verified },
      });

      // Fire-and-forget background notification. Must NEVER be awaited —
      // the SW's CONVERSATION_SAVED handler calls chrome.notifications,
      // which can stall during a cold service-worker spin-up and would
      // otherwise pin the status pill on "Saving" indefinitely. The
      // primary save is already durable in IndexedDB at this point.
      try {
        void chrome.runtime
          .sendMessage({
            type: "CONVERSATION_SAVED",
            payload: {
              provider: conversation.provider,
              title: conversation.title,
              created,
              source: reason,
            },
          } satisfies RuntimeMessage)
          .catch(() => undefined);
      } catch {
        /* background idle — ignore */
      }

      return { ok: true, verified, conversationId: stored.id } as const;
    } catch (error) {
      traceStateFlow("CATCH: onConversationChanged() failed", "content.onConversationChanged", {
        conversationId: conversation.conversationId,
        provider: conversation.provider,
        currentWatchState: "saving",
        previousWatchState: "saving",
        detail: error,
      });
      console.error("[Memlace] Save stage failed", error);
      return { ok: false, stage: "saveConversation", error } as const;
    }
  },
});

manager.start();

// Lightweight selection-capture bridge (kept — this saves highlighted
// snippets as Memories, a separate feature from conversation auto-save).
function currentSelection(): string {
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : "";
}
window.addEventListener("keydown", (event) => {
  if (event.altKey && event.shiftKey && event.code === "KeyS") {
    const text = currentSelection();
    if (!text) return;
    event.preventDefault();
    chrome.runtime
      .sendMessage({
        type: "CAPTURE_SELECTION",
        payload: { text, url: location.href, title: document.title },
      } satisfies RuntimeMessage)
      .catch(() => undefined);
  }
});

window.addEventListener("beforeunload", () => manager.cleanup());
