/**
 * Memlace content script. Runs on every supported AI provider page.
 *
 * ============================================================
 *   MV3 ARCHITECTURE INVARIANT (Phase 14.3)
 * ============================================================
 * Content scripts run under the HOST PAGE'S ORIGIN (e.g.
 * chatgpt.com, claude.ai). IndexedDB is origin-scoped, so any
 * write from here lands in a database the extension UI cannot
 * see (the extension UI runs on chrome-extension://<id>).
 *
 * Therefore this file:
 *   • DOES observe the DOM and extract conversations.
 *   • DOES compute hashes and detect changes.
 *   • DOES ship the CapturedConversation to the background
 *     service worker via chrome.runtime.sendMessage.
 *   • DOES NOT import lib/db, services/conversations, or any
 *     module that writes IndexedDB directly.
 *   • DOES NOT verify persistence. The background is the sole
 *     writer and the sole verifier.
 *
 * Responsibility split:
 *   CONTENT  → observe · extract · send
 *   BACKGROUND → persist · verify · index · dispatch
 *   UI       → read-only
 * ============================================================
 */
import type { RuntimeMessage, SaveConversationAck, Settings } from "@/types";
import { ProviderManager, buildAdapters } from "@/providers";
import { DEFAULT_SETTINGS, loadSettings, subscribeSettings } from "@/services/settings";
import { traceStateFlow } from "@/providers/base/stateTrace";
import { dispatchSaveConversation } from "./saveTransport";

console.log("[Memlace Content] runtime", chrome.runtime.id, window.location.origin);

let currentSettings: Settings = DEFAULT_SETTINGS;
loadSettings().then((s) => { currentSettings = s; });
subscribeSettings((s) => { currentSettings = s; });

const manager = new ProviderManager(buildAdapters(), {
  isAutoSaveEnabled: () => currentSettings.autoSaveConversations,
  onConversationChanged: async ({ conversation, hash, reason }) => {
    traceStateFlow("content → SW SAVE_CONVERSATION dispatch", "content.onConversationChanged", {
      conversationId: conversation.conversationId,
      provider: conversation.provider,
      currentWatchState: "sending",
      previousWatchState: "extracting",
      detail: { reason, hash: hash.slice(0, 8) },
    });

    const response = await dispatchSaveConversation({
      type: "SAVE_CONVERSATION",
      payload: {
        conversation,
        source: reason,
        hash,
        options: {
          saveImages: currentSettings.saveImages,
          saveAttachments: currentSettings.saveAttachments,
        },
      },
    });

    if (!response.ok) {
      traceStateFlow("SW replied error", "content.onConversationChanged", {
        conversationId: conversation.conversationId,
        provider: conversation.provider,
        currentWatchState: "sending",
        previousWatchState: "sending",
        detail: response,
      });
      return { ok: false, stage: "backgroundSave", error: response.error } as const;
    }

    const ack = response.data as SaveConversationAck;
    traceStateFlow("SW replied ok", "content.onConversationChanged", {
      conversationId: ack.conversationId,
      provider: conversation.provider,
      currentWatchState: "sending",
      previousWatchState: "sending",
      detail: ack,
    });
    return { ok: true, verified: ack.verified, conversationId: ack.conversationId } as const;
  },
});

manager.start();

/* -------------------------------------------------- *
 * Lightweight selection-capture bridge (unchanged).
 * Also goes through the background — no direct writes.
 * -------------------------------------------------- */
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
