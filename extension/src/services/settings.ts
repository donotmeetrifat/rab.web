import type { Settings } from "@/types";

const KEY = "memlace.settings";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  defaultProvider: "chatgpt",
  shortcutCapture: "Alt+Shift+S",
  shortcutOpenPopup: "Alt+M",
  telemetryEnabled: false,
  version: "0.1.0",
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  const value = stored[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
}

export async function saveSettings(next: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: next });
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
