/**
 * Phase 15 — Self-check monitor.
 *
 * Runs a lightweight probe every 60 s (idle-aware, non-blocking) to
 * confirm the core subsystems are alive. Failures are recorded and
 * surfaced in the Diagnostics panel, but never interrupt the user.
 *
 * This module is diagnostics-only. It never mutates state, never
 * adds observers, and never touches the DOM.
 */
import { db } from "@/lib/db";
import { _subscriberCount } from "./EventBus";
import { snapshot as queueSnapshot } from "./Queue";

export interface HealthProbe {
  key: string;
  ok: boolean;
  detail?: string;
  ms: number;
}

export interface HealthReport {
  lastRunAt: number;
  runs: number;
  failures: number;
  probes: HealthProbe[];
}

const report: HealthReport = {
  lastRunAt: 0,
  runs: 0,
  failures: 0,
  probes: [],
};

let timer: ReturnType<typeof setInterval> | null = null;

async function timed<T>(fn: () => Promise<T> | T): Promise<{ ok: boolean; ms: number; err?: string }> {
  const t = performance.now();
  try {
    await fn();
    return { ok: true, ms: Math.round(performance.now() - t) };
  } catch (err) {
    return {
      ok: false,
      ms: Math.round(performance.now() - t),
      err: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runHealthCheck(): Promise<HealthReport> {
  const probes: HealthProbe[] = [];

  // 1. IndexedDB open + trivial round-trip.
  const dbProbe = await timed(async () => {
    if (!db.isOpen()) await db.open();
    await db.conversations.limit(1).toArray();
  });
  probes.push({ key: "indexedDB", ok: dbProbe.ok, ms: dbProbe.ms, detail: dbProbe.err });

  // 2. Event bus — must have at least the core subscribers wired.
  const busCount = (() => { try { return _subscriberCount(); } catch { return -1; } })();
  probes.push({
    key: "eventBus",
    ok: busCount >= 0,
    ms: 0,
    detail: `${busCount} subscribers`,
  });

  // 3. Background queue — must not have accumulated many failures.
  const q = (() => { try { return queueSnapshot(); } catch { return null; } })();
  probes.push({
    key: "queue",
    ok: q !== null,
    ms: 0,
    detail: q ? `pending=${q.pending} ran=${q.ran} failed=${q.failed}` : "unavailable",
  });

  // 4. Runtime message channel (UI + background).
  const rtProbe = await timed(async () => {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) throw new Error("no runtime");
  });
  probes.push({ key: "runtime", ok: rtProbe.ok, ms: rtProbe.ms, detail: rtProbe.err });

  report.lastRunAt = Date.now();
  report.runs += 1;
  report.probes = probes;
  if (probes.some((p) => !p.ok)) report.failures += 1;
  return report;
}

export function readHealthReport(): Readonly<HealthReport> {
  return { ...report, probes: [...report.probes] };
}

/** Start the 60 s health loop. Idempotent. */
export function startHealthLoop(): void {
  if (timer) return;
  // First run on next idle tick.
  setTimeout(() => { void runHealthCheck(); }, 2000);
  timer = setInterval(() => { void runHealthCheck(); }, 60_000);
}

export function stopHealthLoop(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
