/**
 * Chrome / Edge / Firefox platform adapter.
 *
 * Concrete implementation of @memlace/core's PlatformAdapters
 * contract using MV3 browser APIs. Wired into the extension by
 * `@/core/subscribers`, which imports this module at boot.
 */

import { installPlatform, hasPlatform } from "@memlace/core/adapters";
import type {
  StorageAdapter,
  ClipboardAdapter,
  NotificationAdapter,
  NavigationAdapter,
  BrowserBridgeAdapter,
} from "@memlace/core/adapters";

const storage: StorageAdapter = {
  async get<T>(key: string): Promise<T | undefined> {
    const res = await chrome.storage.local.get(key);
    return res[key] as T | undefined;
  },
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
  async delete(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },
  async keys(prefix?: string): Promise<string[]> {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all);
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  },
};

const clipboard: ClipboardAdapter = {
  async writeText(text: string): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  },
  async readText(): Promise<string> {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      return navigator.clipboard.readText();
    }
    return "";
  },
};

const notifications: NotificationAdapter = {
  async notify({ title, body, iconUrl }): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.notifications) return;
    await new Promise<void>((resolve) => {
      chrome.notifications.create(
        {
          type: "basic",
          title,
          message: body ?? "",
          iconUrl: iconUrl ?? "icons/icon-128.png",
        },
        () => resolve(),
      );
    });
  },
};

const navigation: NavigationAdapter = {
  async openExternal(url: string): Promise<void> {
    await chrome.tabs.create({ url });
  },
};

const browser: BrowserBridgeAdapter = {
  canObserveWebPages: () => true,
};

export function installChromePlatform(): void {
  if (hasPlatform()) return;
  installPlatform({
    storage,
    clipboard,
    notifications,
    navigation,
    browser,
    platformId: "chrome-extension",
  });
}
