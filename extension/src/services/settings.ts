import type { Settings } from "@/types";

const KEY = "memlace.settings";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  defaultProvider: "chatgpt",
  shortcutCapture: "Alt+Shift+S",
  shortcutOpenPopup: "Alt+Shift+P",
  telemetryEnabled: false,
  notificationsEnabled: true,
  sort: "newest",
  version: "0.2.0",
};

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get(KEY);
    const value = stored[KEY] as Partial<Settings> | undefined;
    return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(next: Settings): Promise<void> {
  try {
    await chrome.storage.local.set({ [KEY]: next });
  } catch {
    // storage full or unavailable — swallow so UI doesn't crash
  }
}

export async function resetSettings(): Promise<Settings> {
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export function subscribeSettings(cb: (s: Settings) => void): () => void {
  const listener = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area === "local" && changes[KEY]?.newValue) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Settings) });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
