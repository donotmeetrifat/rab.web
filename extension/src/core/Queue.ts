/**
 * Memlace OS — Background Queue (Phase 13).
 *
 * One sequential queue for all expensive background work
 * (knowledge extraction, project detection, PIE learning loop, AI
 * enrichment). Retry-safe, deduplicated by task id, idle-aware.
 *
 * Not a general-purpose scheduler — this is intentionally simple so
 * the service worker stays under the 30 s idle timeout budget.
 */

type Task = {
  id: string;
  label: string;
  run: () => Promise<void>;
  retriesLeft: number;
};

const pending = new Map<string, Task>();
const order: string[] = [];
let running = false;
const stats = { enqueued: 0, ran: 0, failed: 0, retried: 0 };

export function enqueue(
  id: string,
  label: string,
  run: () => Promise<void>,
  opts: { retries?: number } = {},
): void {
  if (pending.has(id)) return; // dedupe
  pending.set(id, { id, label, run, retriesLeft: opts.retries ?? 2 });
  order.push(id);
  stats.enqueued++;
  void drain();
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (order.length) {
      const id = order.shift()!;
      const task = pending.get(id);
      if (!task) continue;
      pending.delete(id);
      try {
        await task.run();
        stats.ran++;
      } catch (err) {
        if (task.retriesLeft > 0) {
          stats.retried++;
          pending.set(task.id, { ...task, retriesLeft: task.retriesLeft - 1 });
          order.push(task.id);
        } else {
          stats.failed++;
          console.warn(`[memlace:queue] ${task.label} failed`, err);
        }
      }
      // Yield to keep UI responsive.
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    running = false;
  }
}

export function snapshot() {
  return { pending: order.length, ...stats };
}
