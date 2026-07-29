/**
 * Phase 15 — headless stress test (1000 saves).
 *
 * Runs the raw `saveConversation()` service function against a fresh
 * fake IndexedDB in Node — the same code path the background service
 * worker uses. Verifies:
 *
 *   • 0 duplicates          — provider+providerConversationId is unique
 *   • 0 lost saves          — every dispatched hash is present
 *   • 0 corrupted rows      — hash column matches computed hash
 *   • FSM never hangs       — every call resolves inside 10 s
 *
 * Usage:
 *   node docs/perf/stress-1000.mjs
 */
import "fake-indexeddb/auto";
import { performance } from "node:perf_hooks";

const N = Number(process.env.STRESS_N ?? 1000);

// Lazy import so fake-indexeddb is installed before Dexie boots.
const { saveConversation } = await import("../../extension/src/services/conversations.ts");
const { db } = await import("../../extension/src/lib/db.ts");
const { hashConversation } = await import("../../extension/src/providers/base/hash.ts");

function mkConversation(i) {
  const providerConversationId = `stress-${i}`;
  return {
    provider: "chatgpt",
    providerConversationId,
    title: `Stress conversation ${i}`,
    url: `https://chatgpt.com/c/${providerConversationId}`,
    capturedAt: Date.now(),
    messages: [
      { role: "user", content: `Question ${i}`, order: 0 },
      { role: "assistant", content: `Answer ${i}`, order: 1 },
    ],
  };
}

console.log(`[stress] starting ${N} saves…`);
const t0 = performance.now();
let ok = 0, failed = 0, maxMs = 0;
for (let i = 0; i < N; i++) {
  const c = mkConversation(i);
  const hash = hashConversation(c);
  const start = performance.now();
  try {
    await Promise.race([
      saveConversation(c, { hash, source: "auto" }),
      new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 10_000)),
    ]);
    const ms = performance.now() - start;
    if (ms > maxMs) maxMs = ms;
    ok += 1;
  } catch (err) {
    failed += 1;
    console.error(`[stress] save ${i} failed`, err);
  }
}
const totalMs = performance.now() - t0;

const rows = await db.conversations.toArray();
const seen = new Set(rows.map((r) => `${r.provider}::${r.providerConversationId}`));
const duplicates = rows.length - seen.size;
const missing = Math.max(0, N - rows.length);
let corrupted = 0;
for (const r of rows) {
  // Reconstruct the same shape used for hashing and compare.
  const c = {
    provider: r.provider,
    providerConversationId: r.providerConversationId,
    title: r.title,
    url: r.url,
    capturedAt: r.capturedAt,
    messages: (await db.convMessages.where("conversationId").equals(r.id).sortBy("order")).map((m) => ({
      role: m.role, content: m.content, order: m.order,
    })),
  };
  if (hashConversation(c) !== r.hash) corrupted += 1;
}

const report = {
  n: N,
  ok,
  failed,
  duplicates,
  missing,
  corrupted,
  totalMs: Math.round(totalMs),
  avgMs: Math.round(totalMs / N),
  maxMs: Math.round(maxMs),
};
console.log("[stress] report", report);
if (failed || duplicates || missing || corrupted) {
  console.error("[stress] FAIL");
  process.exit(1);
}
console.log("[stress] PASS — 0 duplicates, 0 lost, 0 corrupted, 0 hangs");
