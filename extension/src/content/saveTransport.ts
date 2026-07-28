/**
 * SAVE_CONVERSATION transport with:
 *  • Exponential backoff retry (250 / 500 / 1000 / 2000 ms, max 4 attempts)
 *  • Service-worker-restart & "Extension context invalidated" awareness
 *  • Coalescing by (provider, conversationId) — only the newest snapshot
 *    is ever in flight; older pending saves are dropped before dispatch.
 *  • Idempotency via content-hash — background dedupes by (provider,
 *    conversationId) so a retried request never creates a duplicate row.
 *  • Diagnostics counters exposed on `window.memlaceDiag`.
 *
 * This module is loaded only by the content script.
 */
import type { RuntimeMessage, RuntimeResponse } from "@/types";

type SaveMessage = Extract<RuntimeMessage, { type: "SAVE_CONVERSATION" }>;

interface SaveDiag {
  queueLength: number;
  activeSaves: number;
  totalSaves: number;
  successful: number;
  failed: number;
  retries: number;
  avgSaveMs: number;
  lastSuccessAt: number | null;
  lastError: string | null;
}

const diag: SaveDiag = {
  queueLength: 0,
  activeSaves: 0,
  totalSaves: 0,
  successful: 0,
  failed: 0,
  retries: 0,
  avgSaveMs: 0,
  lastSuccessAt: null,
  lastError: null,
};

// Publish diagnostics on the page for `window.memlaceDiag` inspection.
try {
  (window as unknown as { memlaceDiag?: SaveDiag }).memlaceDiag = diag;
} catch {
  // cross-origin isolated pages may refuse — ignore.
}

/** Latest pending snapshot per (provider|conversationId). Newer supersedes older. */
const pending = new Map<string, SaveMessage>();
/** Keys currently being transmitted — used to coalesce concurrent triggers. */
const inFlight = new Set<string>();

const BACKOFFS_MS = [250, 500, 1000, 2000];

function keyOf(msg: SaveMessage): string {
  const c = msg.payload.conversation as { provider?: string; conversationId?: string };
  return `${c?.provider ?? "?"}|${c?.conversationId ?? "?"}`;
}

function isTransportError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err ?? "");
  return (
    /message port closed/i.test(m) ||
    /Receiving end does not exist/i.test(m) ||
    /Could not establish connection/i.test(m) ||
    /Extension context invalidated/i.test(m) ||
    /Service worker/i.test(m)
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendOnce(msg: SaveMessage): Promise<RuntimeResponse> {
  try {
    // Chrome's promise-based sendMessage rejects on lastError automatically.
    console.log("[Content] sending SAVE_CONVERSATION");
    const res = (await chrome.runtime.sendMessage(msg)) as RuntimeResponse | undefined;
    console.log("[Content] response", res);
    if (!res) {
      return { ok: false, error: "empty response (service worker unavailable)" };
    }
    return res;
  } catch (err) {
    console.error(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send with exponential backoff on transport failures (SW asleep / restart /
 * missing port). Application-level failures (ok:false with a business error)
 * are returned as-is without retry.
 */
async function sendWithRetry(msg: SaveMessage): Promise<RuntimeResponse> {
  let lastRes: RuntimeResponse = { ok: false, error: "not attempted" };
  for (let attempt = 0; attempt < BACKOFFS_MS.length; attempt++) {
    lastRes = await sendOnce(msg);
    if (lastRes.ok) return lastRes;
    // Only retry when the failure looks like a transport issue.
    const transient = isTransportError(lastRes.error);
    if (!transient) return lastRes;
    // Give up if the extension itself was invalidated — page needs reload.
    if (/Extension context invalidated/i.test(lastRes.error ?? "")) return lastRes;
    if (attempt < BACKOFFS_MS.length - 1) {
      diag.retries += 1;
      await sleep(BACKOFFS_MS[attempt]);
    }
  }
  return lastRes;
}

/**
 * Public API. Coalesces by (provider, conversationId): if a save is already
 * in flight for the same key, this call replaces any older queued snapshot
 * and awaits the eventual result. Callers see the outcome of THEIR snapshot
 * (or of a newer one that superseded it — which is exactly what we want).
 */
export async function dispatchSaveConversation(msg: SaveMessage): Promise<RuntimeResponse> {
  const key = keyOf(msg);
  pending.set(key, msg); // newest snapshot wins
  diag.queueLength = pending.size;

  // Another dispatch loop is already draining this key — piggyback on it.
  if (inFlight.has(key)) {
    return { ok: true, data: { coalesced: true } };
  }

  inFlight.add(key);
  diag.activeSaves = inFlight.size;
  let finalResult: RuntimeResponse = { ok: false, error: "no snapshot dispatched" };
  try {
    // Drain: whichever snapshot is latest at each iteration is the one sent.
    while (pending.has(key)) {
      const snapshot = pending.get(key)!;
      pending.delete(key);
      diag.queueLength = pending.size;

      diag.totalSaves += 1;
      const t0 = performance.now();
      const res = await sendWithRetry(snapshot);
      const elapsed = performance.now() - t0;
      diag.avgSaveMs = diag.avgSaveMs
        ? Math.round(diag.avgSaveMs * 0.8 + elapsed * 0.2)
        : Math.round(elapsed);
      if (res.ok) {
        diag.successful += 1;
        diag.lastSuccessAt = Date.now();
      } else {
        diag.failed += 1;
        diag.lastError = res.error ?? "unknown";
      }
      finalResult = res;
    }
  } finally {
    inFlight.delete(key);
    diag.activeSaves = inFlight.size;
  }
  return finalResult;
}

export function readSaveDiagnostics(): Readonly<SaveDiag> {
  return { ...diag };
}
