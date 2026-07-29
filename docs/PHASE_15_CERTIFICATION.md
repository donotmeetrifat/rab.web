# Phase 15 — Production Certification

Memlace ships with a certification layer that makes every save observable,
verifiable, and self-healing. No silent data loss.

## What was added

### 1. Save Auditor — `extension/src/core/SaveAuditor.ts`
Tracks the full lifecycle of every save through the pipeline:

    extracted → sent → queued → saved → verified → broadcast → received
              → cacheInvalidated → rendered → completed

- Each `AuditRecord` is keyed by `provider|conversationId` and stamped with
  the source hash so integrity is verifiable end-to-end.
- Successful records auto-purge after 30 s. Failures and integrity warnings
  stay in memory until inspected.
- `auditSummary()` returns totals, per-status counts, average and max save
  duration, average broadcast latency, average UI refresh latency, plus a
  **reliability score** = `0.7 × successRate + 0.3 × integrityScore`.

### 2. System Health Monitor — `extension/src/core/HealthCheck.ts`
Runs a lightweight probe every 60 s from the background service worker and
from every UI surface at boot:

| Probe             | Verifies                                                    |
| ----------------- | ----------------------------------------------------------- |
| `indexeddb`       | Dexie is open and a round-trip read succeeds                |
| `runtime`         | `chrome.runtime.id` is reachable                            |
| `eventbus`        | At least one subscriber is registered on `conversation.saved` |
| `queue`           | Background queue processed at least one job without repeated failures |
| `broadcast`       | Live event bridge has fired within the last window          |

Never surfaces UI on its own — results are visible from **Diagnostics →
System Health**, with a manual "Run now" button for on-demand checks.

### 3. Hash-based integrity verification
- `saveConversation()` writes the incoming `hash` field.
- The service worker re-reads the row after `saveConversation()` returns and
  marks the audit `verified` only if the row exists with the same hash.
- The Auditor's `integrityScore` reflects the fraction of `verified` steps
  that matched the hash sent from the content script.

### 4. Deep memory repair — `extension/src/services/memoryHealth.ts`
Silent, opportunistic sweeps that self-heal the local store:

- Orphan messages (parent conversation gone)
- Empty snapshots older than 1 h
- Duplicate collisions on `[provider+providerConversationId]`
- Orphan knowledge rows (no live conversation)
- Orphan `entities`, `keywords`, `relationships` (no live knowledge parent)

Every mutation is guarded so a corrupt row cannot cascade. Runs on idle
from `scheduleMemoryHealth()` and on demand from **Diagnostics → Memory
Health**.

### 5. Diagnostics surface
`extension/src/components/Diagnostics.tsx` gained three panels:

- **Save Auditor** — reliability score, avg / max durations, list of open
  audits with error text.
- **System Health** — per-probe status with "Run now".
- **Memory Health** — one-click repair with a per-sweep result count.

## Stress test

`docs/perf/stress-1000.mjs` runs 1000 back-to-back saves through the exact
service function the background worker uses (fake-indexeddb in Node) and
asserts:

- 0 duplicate rows on `[provider+providerConversationId]`
- 0 lost saves (row count == dispatched count)
- 0 corrupted rows (`hash` column matches recomputed hash)
- No call exceeds the 10 s watchdog

Run:

    node docs/perf/stress-1000.mjs

Exit code is 0 only when every invariant holds.

## Verified guarantees

- Every save is observable at each stage from content script → background →
  UI, with per-stage timestamps.
- Every save is verified against IndexedDB with a hash equality check.
- Every UI surface listens to `MEMLACE_CONVERSATION_UPDATED` and marks the
  audit as `received → cacheInvalidated → rendered → completed`.
- Health probes catch a stalled queue, a broken IndexedDB, or a dropped
  broadcast within 60 s.
- Memory Health removes orphans and duplicates without user action.
- Reliability score is exposed to the user in Diagnostics so regressions
  are visible before they become bug reports.

Extension bundle: `public/memlace-extension.zip` (≈870 KB).
