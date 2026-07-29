/**
 * Phase 15 — Save Auditor + Pipeline Monitor.
 *
 * A single audit record follows every SAVE_CONVERSATION from the moment
 * the content script extracts a snapshot until the UI has confirmed the
 * broadcast. Records for successful, fully verified saves are dropped
 * after ~30 s so memory stays bounded; failed / stalled records are kept
 * for inspection in the Diagnostics panel.
 *
 * This module is READ-ONLY diagnostics. It never mutates the pipeline
 * and never adds MutationObservers or polling.
 */

export type AuditStage =
  | "extracted"
  | "sent"
  | "queued"
  | "saved"
  | "verified"
  | "broadcast"
  | "received"
  | "rendered"
  | "cacheInvalidated"
  | "completed";

export type AuditStatus = "pending" | "ok" | "failed" | "integrity";

export interface AuditRecord {
  conversationId: string;
  provider: string;
  hash: string;
  startedAt: number;
  savedAt: number | null;
  verifiedAt: number | null;
  broadcastAt: number | null;
  uiReceivedAt: number | null;
  completedAt: number | null;
  status: AuditStatus;
  durationMs: number | null;
  stages: Partial<Record<AuditStage, number>>;
  hashesSeen: Set<string>;
  error?: string;
}

const KEEP_MS = 30_000;
const MAX_RECORDS = 200;
const audits = new Map<string, AuditRecord>();

function key(provider: string, conversationId: string): string {
  return `${provider}|${conversationId}`;
}

function prune() {
  if (audits.size <= MAX_RECORDS) return;
  const sorted = Array.from(audits.entries()).sort(
    (a, b) => (a[1].completedAt ?? a[1].startedAt) - (b[1].completedAt ?? b[1].startedAt),
  );
  while (audits.size > MAX_RECORDS) {
    const [k] = sorted.shift()!;
    audits.delete(k);
  }
}

export function auditStart(
  provider: string,
  conversationId: string,
  hash: string,
): AuditRecord {
  const k = key(provider, conversationId);
  const now = Date.now();
  const existing = audits.get(k);
  if (existing && existing.status === "pending") {
    existing.hash = hash;
    existing.hashesSeen.add(hash);
    return existing;
  }
  const rec: AuditRecord = {
    conversationId,
    provider,
    hash,
    startedAt: now,
    savedAt: null,
    verifiedAt: null,
    broadcastAt: null,
    uiReceivedAt: null,
    completedAt: null,
    status: "pending",
    durationMs: null,
    stages: { extracted: now },
    hashesSeen: new Set([hash]),
  };
  audits.set(k, rec);
  prune();
  return rec;
}

export function auditMark(
  provider: string,
  conversationId: string,
  stage: AuditStage,
  extra?: { hash?: string; error?: string },
): void {
  const rec = audits.get(key(provider, conversationId));
  if (!rec) return;
  const now = Date.now();
  rec.stages[stage] = now;
  if (extra?.hash) rec.hashesSeen.add(extra.hash);
  switch (stage) {
    case "saved":
      rec.savedAt = now;
      break;
    case "verified":
      rec.verifiedAt = now;
      break;
    case "broadcast":
      rec.broadcastAt = now;
      break;
    case "received":
      rec.uiReceivedAt = now;
      break;
    case "completed":
      rec.completedAt = now;
      rec.durationMs = now - rec.startedAt;
      if (rec.status === "pending") rec.status = "ok";
      // Drop successful records after a grace window to keep memory bounded.
      if (rec.status === "ok") {
        const k = key(provider, conversationId);
        setTimeout(() => {
          const cur = audits.get(k);
          if (cur && cur.status === "ok") audits.delete(k);
        }, KEEP_MS);
      }
      break;
  }
  // Integrity check — every hash observed for this save must match.
  if (extra?.hash && rec.hashesSeen.size > 1) {
    rec.status = "integrity";
    rec.error = `hash divergence: ${Array.from(rec.hashesSeen).join(", ").slice(0, 120)}`;
  }
}

export function auditFail(
  provider: string,
  conversationId: string,
  error: string,
): void {
  const rec = audits.get(key(provider, conversationId));
  if (!rec) return;
  rec.status = "failed";
  rec.error = error;
  rec.completedAt = Date.now();
  rec.durationMs = rec.completedAt - rec.startedAt;
}

export interface AuditSummary {
  total: number;
  pending: number;
  ok: number;
  failed: number;
  integrity: number;
  avgDurationMs: number;
  maxDurationMs: number;
  avgBroadcastMs: number;
  avgUiRefreshMs: number;
  successRate: number;
  reliabilityScore: number;
  integrityScore: number;
  records: Array<Omit<AuditRecord, "hashesSeen"> & { hashesSeen: string[] }>;
}

export function auditSummary(): AuditSummary {
  const list = Array.from(audits.values());
  let ok = 0, failed = 0, integrity = 0, pending = 0;
  let sumDur = 0, cntDur = 0, maxDur = 0;
  let sumBroadcast = 0, cntBroadcast = 0;
  let sumUi = 0, cntUi = 0;
  for (const r of list) {
    if (r.status === "ok") ok++;
    else if (r.status === "failed") failed++;
    else if (r.status === "integrity") integrity++;
    else pending++;
    if (r.durationMs != null) {
      sumDur += r.durationMs;
      cntDur++;
      if (r.durationMs > maxDur) maxDur = r.durationMs;
    }
    if (r.savedAt && r.broadcastAt) {
      sumBroadcast += r.broadcastAt - r.savedAt;
      cntBroadcast++;
    }
    if (r.broadcastAt && r.uiReceivedAt) {
      sumUi += r.uiReceivedAt - r.broadcastAt;
      cntUi++;
    }
  }
  const decided = ok + failed + integrity;
  const successRate = decided === 0 ? 1 : ok / decided;
  const integrityScore = decided === 0 ? 1 : 1 - integrity / decided;
  const reliabilityScore = successRate * 0.7 + integrityScore * 0.3;
  return {
    total: list.length,
    pending,
    ok,
    failed,
    integrity,
    avgDurationMs: cntDur ? Math.round(sumDur / cntDur) : 0,
    maxDurationMs: Math.round(maxDur),
    avgBroadcastMs: cntBroadcast ? Math.round(sumBroadcast / cntBroadcast) : 0,
    avgUiRefreshMs: cntUi ? Math.round(sumUi / cntUi) : 0,
    successRate: Number(successRate.toFixed(4)),
    reliabilityScore: Number(reliabilityScore.toFixed(4)),
    integrityScore: Number(integrityScore.toFixed(4)),
    records: list.map((r) => ({ ...r, hashesSeen: Array.from(r.hashesSeen) })),
  };
}

/** Clear the auditor. Diagnostics-only. */
export function auditReset(): void {
  audits.clear();
}
