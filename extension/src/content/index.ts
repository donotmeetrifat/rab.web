// Memlace content script — runs on supported AI provider pages.
// Keeps a lightweight bridge so the extension can capture the current
// selection or page title/URL on demand. No DOM mutations by default.

import type { RuntimeMessage } from "@/types";

function currentSelection(): string {
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : "";
}

async function sendCapture(text: string) {
  const message: RuntimeMessage = {
    type: "CAPTURE_SELECTION",
    payload: {
      text,
      url: window.location.href,
      title: document.title,
    },
  };
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // background may not be ready; safely ignored
  }
}

// Keyboard shortcut: Alt+Shift+S captures the current selection.
window.addEventListener("keydown", (event) => {
  if (event.altKey && event.shiftKey && event.code === "KeyS") {
    const text = currentSelection();
    if (text.length > 0) {
      event.preventDefault();
      sendCapture(text);
    }
  }
});

// Respond to on-demand requests from the extension.
chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type === "GET_ACTIVE_PROVIDER") {
    sendResponse({
      ok: true,
      data: {
        url: window.location.href,
        title: document.title,
        selection: currentSelection(),
      },
    });
    return true;
  }
  return false;
});

export {};
