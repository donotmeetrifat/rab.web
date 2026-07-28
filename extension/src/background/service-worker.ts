import type { RuntimeMessage, RuntimeResponse, SaveConversationResult } from "@/types";
import type { CapturedConversation } from "@/providers/base/types";
import "@/core/subscribers";
import { notify } from "@/services/notifications";
import { loadSettings } from "@/services/settings";
import { saveConversation } from "@/services/conversations";
import { db } from "@/lib/db";

console.log("[Memlace BG] started");
console.log("[Memlace BG] runtime", chrome.runtime.id, globalThis.location.origin);

// Global error listeners — a bug in one handler must never take the SW down.
self.addEventListener("error", (ev) => {
  console.error("[Memlace][bg] error", (ev as ErrorEvent).error ?? (ev as ErrorEvent).message);
});
self.addEventListener("unhandledrejection", (ev) => {
  console.error("[Memlace][bg] unhandledrejection", (ev as PromiseRejectionEvent).reason);
});

const CONTEXT_MENU_ID = "memlace-save-selection";
const PENDING_KEY = "memlace.pendingCapture";

/* -------------------------------------------------- */
/*  Install / lifecycle                               */
/* -------------------------------------------------- */

async function ensureContextMenu(): Promise<void> {
  try {
    await new Promise<void>((resolve) =>
      chrome.contextMenus.removeAll(() => resolve()),
    );
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Save selection to Memlace",
      contexts: ["selection"],
    });
  } catch {
    // ignore — context menus may not be available in all contexts
  }
}

async function configureSidePanel(): Promise<void> {
  try {
    await chrome.sidePanel.setPanelBehavior?.({ openPanelOnActionClick: false });
  } catch {
    // ignore — not supported everywhere
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureContextMenu();
  await configureSidePanel();
  if (details.reason === "install") {
    try {
      await chrome.storage.local.set({ "memlace.installedAt": Date.now() });
    } catch {
      // ignore
    }
    await notify({
      title: "Memlace installed",
      message: "Press Alt+Shift+P to open, or Alt+Shift+S to save a selection.",
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu().catch(() => undefined);
});

/* -------------------------------------------------- */
/*  Selection capture (context menu + shortcut)       */
/* -------------------------------------------------- */

async function stashCapture(payload: { text: string; url: string; title: string }): Promise<void> {
  try {
    await chrome.storage.local.set({ [PENDING_KEY]: payload });
  } catch {
    // ignore
  }
  const settings = await loadSettings().catch(() => null);
  if (settings?.notificationsEnabled !== false) {
    await notify({
      title: "Selection captured",
      message: payload.text.slice(0, 90) + (payload.text.length > 90 ? "…" : ""),
    });
  }
}

async function openSidePanelForTab(tabId: number | undefined): Promise<boolean> {
  if (!tabId || !chrome.sidePanel?.open) return false;
  try {
    await chrome.sidePanel.open({ tabId });
    return true;
  } catch {
    return false;
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  if (!info.selectionText || !tab?.id) return;
  await stashCapture({
    text: info.selectionText,
    url: tab.url ?? "",
    title: tab.title ?? "",
  });
  await openSidePanelForTab(tab.id);
});

/* -------------------------------------------------- */
/*  Commands (keyboard shortcuts)                     */
/* -------------------------------------------------- */

async function captureFromActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() ?? "",
    });
    const text = results[0]?.result ?? "";
    if (!text) {
      await notify({
        title: "Nothing selected",
        message: "Highlight text on the page first, then press the shortcut again.",
      });
      return;
    }
    await stashCapture({ text, url: tab.url ?? "", title: tab.title ?? "" });
    await openSidePanelForTab(tab.id);
  } catch (err) {
    await notify({
      title: "Capture failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

chrome.commands?.onCommand.addListener(async (command) => {
  if (command === "capture-selection") {
    await captureFromActiveTab();
  } else if (command === "open-side-panel") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await openSidePanelForTab(tab?.id);
  }
});

/* -------------------------------------------------- */
/*  Message bridge                                    */
/* -------------------------------------------------- */

chrome.runtime.onMessage.addListener(
  (msg: RuntimeMessage, sender, sendResponse: (r: RuntimeResponse) => void) => {
    console.log("[BG] received", msg.type);
    (async () => {
      try {
        switch (msg.type) {
          case "PING":
            sendResponse({ ok: true, data: "pong" });
            return;
          case "CAPTURE_SELECTION":
            await stashCapture(msg.payload);
            sendResponse({ ok: true });
            return;
          case "OPEN_SIDE_PANEL": {
            const tabId = sender.tab?.id;
            const opened = await openSidePanelForTab(tabId);
            sendResponse({ ok: opened, ...(opened ? {} : { error: "Could not open side panel" }) } as RuntimeResponse);
            return;
          }
          case "OPEN_POPUP": {
            try {
              await chrome.action.openPopup?.();
              sendResponse({ ok: true });
            } catch (err) {
              sendResponse({ ok: false, error: err instanceof Error ? err.message : "unavailable" });
            }
            return;
          }
          case "REQUEST_SELECTION_CAPTURE":
            await captureFromActiveTab();
            sendResponse({ ok: true });
            return;
          case "SAVE_CONVERSATION": {
            // ============================================================
            //  MV3 sole writer. Content scripts hand off CapturedConversation
            //  here; this is the ONLY place saveConversation() runs in the
            //  extension-origin IndexedDB.
            // ============================================================
            const t0 = performance.now();
            const captured = msg.payload.conversation as CapturedConversation;
            try {
              const { conversation, created, changed } = await saveConversation(captured, {
                hash: msg.payload.hash,
                source: msg.payload.source,
                saveImages: msg.payload.options?.saveImages,
                saveAttachments: msg.payload.options?.saveAttachments,
              });
              // Background is the sole verifier — content never reads the DB.
              const row = await db.conversations.get(conversation.id);
              const verified = Boolean(row);
              const durationMs = Math.round(performance.now() - t0);
              const result: SaveConversationResult = {
                ok: true,
                verified,
                conversationId: conversation.id,
                created,
                updated: !created && changed,
                provider: conversation.provider,
                hash: msg.payload.hash,
                durationMs,
              };
              console.log("[Memlace] Conversation saved", result);
              // Fire-and-forget user notification (no longer traveling
              // back through the content script's message channel).
              if (changed) {
                const settings = await loadSettings().catch(() => null);
                if (settings?.notificationsEnabled !== false) {
                  void notify({
                    title: created
                      ? `Saved from ${conversation.provider}`
                      : `Updated from ${conversation.provider}`,
                    message: conversation.title.slice(0, 100),
                  }).catch(() => undefined);
                }
              }
              // Broadcast MEMLACE_CONVERSATION_UPDATED to every open UI
              // surface. Fire-and-forget: broadcast MUST NOT block the ack.
              if (verified) {
                try {
                  void chrome.runtime
                    .sendMessage({
                      type: "MEMLACE_CONVERSATION_UPDATED",
                      payload: {
                        conversationId: conversation.id,
                        provider: conversation.provider,
                        projectId: conversation.projectId ?? null,
                        updatedAt: conversation.updatedAt,
                        created,
                        source: msg.payload.source,
                      },
                    } satisfies RuntimeMessage)
                    .catch(() => undefined);
                } catch { /* no receivers → ignore */ }
              }
              sendResponse({ ok: true, data: result });

            } catch (err) {
              console.error("[Memlace] SAVE_CONVERSATION failed", err);
              sendResponse({
                ok: false,
                error: err instanceof Error ? err.message : "save failed",
              });
            }
            return;
          }
          case "CONVERSATION_SAVED": {
            // Legacy path — kept for backward compatibility with older
            // content-script bundles still in the wild during rollout.
            // New pipeline notifies from SAVE_CONVERSATION directly.
            const settings = await loadSettings().catch(() => null);
            if (settings?.notificationsEnabled !== false) {
              await notify({
                title: msg.payload.created
                  ? `Saved from ${msg.payload.provider}`
                  : `Updated from ${msg.payload.provider}`,
                message: msg.payload.title.slice(0, 100),
              });
            }
            sendResponse({ ok: true });
            return;
          }
          case "GET_ACTIVE_PROVIDER": {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            sendResponse({
              ok: true,
              data: { url: tab?.url ?? null, title: tab?.title ?? null },
            });
            return;
          }
          default:
            sendResponse({ ok: false, error: "Unknown message type" });
        }
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    })();
    return true; // keep the channel open for async response
  },
);
