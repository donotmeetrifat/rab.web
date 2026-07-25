/**
 * Persistent AI configuration. Kept in `chrome.storage.local` (not synced)
 * so API keys never leave the machine they were entered on. Keys are
 * stored in cleartext because Chrome does not expose a per-extension
 * secure vault — but the storage area is sandboxed to this extension.
 */
import { DEFAULT_AI_SETTINGS, type AISettings } from "./types";

const KEY = "memlace.ai.settings";

export async function loadAISettings(): Promise<AISettings> {
  try {
    const stored = await chrome.storage.local.get(KEY);
    const value = stored[KEY] as Partial<AISettings> | undefined;
    return { ...DEFAULT_AI_SETTINGS, ...(value ?? {}) };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export async function saveAISettings(next: AISettings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: next });
}

export async function updateAISettings(patch: Partial<AISettings>): Promise<AISettings> {
  const cur = await loadAISettings();
  const next = { ...cur, ...patch };
  await saveAISettings(next);
  return next;
}

export async function clearAIKey(): Promise<AISettings> {
  return updateAISettings({ apiKey: "" });
}

export function subscribeAISettings(cb: (s: AISettings) => void): () => void {
  const listener = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area === "local" && changes[KEY]) {
      cb({ ...DEFAULT_AI_SETTINGS, ...(changes[KEY].newValue as Partial<AISettings> ?? {}) });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
