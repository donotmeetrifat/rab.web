/**
 * Continue-Anywhere history — a tiny local-only log of the last 20
 * transfers so users can reopen a previous handoff. Stored in
 * chrome.storage.local (falls back to window.localStorage in dev) so it
 * survives popup close but never leaves the device.
 */
import type { ContinuationProviderId } from "@/lib/continuation";
import type { ProviderId } from "@/types";

const KEY = "memlace:continueHistory";
const MAX = 20;

export interface ContinueHistoryEntry {
  id: string;
  at: number;
  conversationId: string;
  conversationTitle: string;
  from: ProviderId;
  to: ContinuationProviderId;
  size: "small" | "medium" | "large" | "full";
}

type ChromeStorage = {
  local?: {
    get: (key: string) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
  };
};

function storage(): ChromeStorage["local"] | null {
  const c = (globalThis as { chrome?: { storage?: ChromeStorage } }).chrome;
  return c?.storage?.local ?? null;
}

async function readAll(): Promise<ContinueHistoryEntry[]> {
  const s = storage();
  if (s) {
    try {
      const out = await s.get(KEY);
      const raw = out?.[KEY];
      return Array.isArray(raw) ? (raw as ContinueHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ContinueHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(list: ContinueHistoryEntry[]): Promise<void> {
  const s = storage();
  if (s) {
    try {
      await s.set({ [KEY]: list });
      return;
    } catch {
      /* fallthrough */
    }
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export async function getContinueHistory(): Promise<ContinueHistoryEntry[]> {
  return readAll();
}

export async function recordContinue(
  entry: Omit<ContinueHistoryEntry, "id" | "at">,
): Promise<void> {
  const list = await readAll();
  const next: ContinueHistoryEntry = {
    ...entry,
    id: `hx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
  list.unshift(next);
  await writeAll(list.slice(0, MAX));
}

export async function clearContinueHistory(): Promise<void> {
  await writeAll([]);
}
