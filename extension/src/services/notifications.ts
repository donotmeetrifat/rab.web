/**
 * Wrappers around chrome.notifications with graceful fallback when the API
 * isn't available (e.g. inside a rendered page context or a test harness).
 */

export interface NotifyOptions {
  title: string;
  message: string;
  iconUrl?: string;
}

const DEFAULT_ICON = chrome.runtime?.getURL?.("icons/icon-128.png");

export async function notify(opts: NotifyOptions): Promise<string | null> {
  if (typeof chrome === "undefined" || !chrome.notifications?.create) return null;
  return new Promise((resolve) => {
    try {
      chrome.notifications.create(
        {
          type: "basic",
          iconUrl: opts.iconUrl ?? DEFAULT_ICON ?? "",
          title: opts.title,
          message: opts.message,
          priority: 1,
        },
        (id) => {
          const err = chrome.runtime.lastError;
          if (err) resolve(null);
          else resolve(id ?? null);
        },
      );
    } catch {
      resolve(null);
    }
  });
}
