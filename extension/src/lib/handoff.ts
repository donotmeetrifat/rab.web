/**
 * Provider handoff — writes a tiny "you just landed here, paste the
 * context" hint to chrome.storage.local, which BaseChatAdapter reads on
 * mount and renders as a small floating pill for a few seconds. Never
 * injects any large UI and never blocks the page.
 */
import type { ContinuationProviderId } from "@/lib/continuation";

const KEY = "memlace:pendingHandoff";
const TTL_MS = 90_000;

export interface PendingHandoff {
  target: ContinuationProviderId;
  at: number;
  message: string;
}

type LocalStore = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

function store(): LocalStore | null {
  const c = (globalThis as {
    chrome?: { storage?: { local?: LocalStore } };
  }).chrome;
  return c?.storage?.local ?? null;
}

export async function setPendingHandoff(target: ContinuationProviderId): Promise<void> {
  const s = store();
  const payload: PendingHandoff = {
    target,
    at: Date.now(),
    message: "Context is ready. Press Ctrl+V to continue.",
  };
  if (s) {
    try {
      await s.set({ [KEY]: payload });
    } catch {
      /* ignore */
    }
  }
}

export async function consumePendingHandoff(
  target: ContinuationProviderId,
): Promise<PendingHandoff | null> {
  const s = store();
  if (!s) return null;
  try {
    const out = await s.get(KEY);
    const raw = out?.[KEY] as PendingHandoff | undefined;
    if (!raw || raw.target !== target) return null;
    if (Date.now() - raw.at > TTL_MS) {
      await s.remove(KEY);
      return null;
    }
    await s.remove(KEY);
    return raw;
  } catch {
    return null;
  }
}
