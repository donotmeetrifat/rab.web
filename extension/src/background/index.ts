import type { RuntimeMessage, RuntimeResponse } from "@/types";
import { notify } from "@/services/notifications";
import { loadSettings } from "@/services/settings";

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
