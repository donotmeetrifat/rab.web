/**
 * Memlace content script. Runs on every supported AI provider page.
 * Bootstraps the ProviderManager which loads the correct adapter, observes
 * DOM changes, and injects the "Save to Memlace" button.
 *
 * Storage happens in this same context (IndexedDB is available in content
 * scripts and shared across the extension), so saves are direct — no round
 * trip to the background worker required. The background is only notified
 * for optional notifications and popup badge updates.
 */
import type { RuntimeMessage, Settings } from "@/types";
import { ProviderManager, buildAdapters } from "@/providers";
import { saveConversation } from "@/services/conversations";
import { DEFAULT_SETTINGS, loadSettings, subscribeSettings } from "@/services/settings";

let currentSettings: Settings = DEFAULT_SETTINGS;
loadSettings().then((s) => { currentSettings = s; });
subscribeSettings((s) => { currentSettings = s; });

const manager = new ProviderManager(buildAdapters(), {
  isAutoSaveEnabled: () =>
    currentSettings.autoSaveConversations && !currentSettings.saveConversationsManualOnly,
  onConversationChanged: async ({ conversation, hash, reason }) => {
    // Respect manual-only guard for auto-triggered saves (initial + auto).
    if (reason !== "manual" && currentSettings.saveConversationsManualOnly) return;
    const { created } = await saveConversation(conversation, {
      hash,
      source: reason,
      saveImages: currentSettings.saveImages,
      saveAttachments: currentSettings.saveAttachments,
    });
    try {
      await chrome.runtime.sendMessage({
        type: "CONVERSATION_SAVED",
        payload: {
          provider: conversation.provider,
          title: conversation.title,
          created,
          source: reason,
        },
      } satisfies RuntimeMessage);
    } catch {
      // background may be idle — the save itself is what matters
    }
  },
});

manager.start();

// Lightweight selection-capture bridge (preserved from Phase 1.5).
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
