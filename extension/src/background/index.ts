import type { RuntimeMessage, RuntimeResponse } from "@/types";

const CONTEXT_MENU_ID = "memlace-save-selection";

async function ensureContextMenu() {
  await new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(() => resolve());
  });
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Save selection to Memlace",
    contexts: ["selection"],
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureContextMenu();
  if (chrome.sidePanel?.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    } catch {
      // ignore — some browsers may not allow this
    }
  }
  if (details.reason === "install") {
    await chrome.storage.local.set({ "memlace.installedAt": Date.now() });
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu().catch(() => undefined);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  if (!info.selectionText || !tab?.id) return;
  const payload = {
    text: info.selectionText,
    url: tab.url ?? "",
    title: tab.title ?? "",
  };
  await chrome.storage.local.set({ "memlace.pendingCapture": payload });
  if (chrome.sidePanel?.open) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch {
      // fall back to popup
    }
  }
});

chrome.runtime.onMessage.addListener(
  (msg: RuntimeMessage, sender, sendResponse: (r: RuntimeResponse) => void) => {
    (async () => {
      try {
        switch (msg.type) {
          case "PING":
            sendResponse({ ok: true, data: "pong" });
            return;
          case "CAPTURE_SELECTION": {
            await chrome.storage.local.set({ "memlace.pendingCapture": msg.payload });
            sendResponse({ ok: true });
            return;
          }
          case "OPEN_SIDE_PANEL": {
            const tabId = sender.tab?.id;
            if (tabId && chrome.sidePanel?.open) {
              await chrome.sidePanel.open({ tabId });
            }
            sendResponse({ ok: true });
            return;
          }
          case "GET_ACTIVE_PROVIDER": {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            sendResponse({ ok: true, data: { url: tab?.url ?? null, title: tab?.title ?? null } });
            return;
          }
          default:
            sendResponse({ ok: false, error: "Unknown message type" });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    })();
    return true; // keep channel open for async response
  },
);
