/**
 * ContextContinuity — Phase 12.7.
 *
 * When a user reopens a project, restore the last thing they looked at:
 * last conversation, last search, last AI provider, and the last
 * "Continue Anywhere" target. Storage lives in chrome.storage.local so
 * it survives popup close but never leaves the device.
 */
import type { ContinuationProviderId } from "@/lib/continuation";
import type { ProviderId } from "@/types";

const KEY = "memlace:continuity";

export interface ProjectContinuity {
  lastConversationId?: string;
  lastSearch?: string;
  lastProvider?: ProviderId;
  lastContinueTarget?: ContinuationProviderId;
  lastTimelinePos?: number;
  updatedAt: number;
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

async function readAll(): Promise<Record<string, ProjectContinuity>> {
  const s = storage();
  if (s) {
    try {
      const out = await s.get(KEY);
      const raw = out?.[KEY];
      return raw && typeof raw === "object" ? (raw as Record<string, ProjectContinuity>) : {};
    } catch {
      return {};
    }
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProjectContinuity>) : {};
  } catch {
    return {};
  }
}

async function writeAll(map: Record<string, ProjectContinuity>): Promise<void> {
  const s = storage();
  if (s) {
    try {
      await s.set({ [KEY]: map });
      return;
    } catch {
      /* fallthrough */
    }
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function getContinuity(projectId: string): Promise<ProjectContinuity | null> {
  const all = await readAll();
  return all[projectId] ?? null;
}

export async function saveContinuity(
  projectId: string,
  patch: Partial<Omit<ProjectContinuity, "updatedAt">>,
): Promise<void> {
  const all = await readAll();
  const prev = all[projectId] ?? { updatedAt: 0 };
  all[projectId] = { ...prev, ...patch, updatedAt: Date.now() };
  await writeAll(all);
}

export async function clearContinuity(projectId?: string): Promise<void> {
  if (!projectId) {
    await writeAll({});
    return;
  }
  const all = await readAll();
  delete all[projectId];
  await writeAll(all);
}
