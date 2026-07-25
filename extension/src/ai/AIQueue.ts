/**
 * AIQueue — cooperative in-memory job queue.
 *
 * Runs one AI job at a time to avoid rate-limit storms and keep the popup
 * responsive. Jobs are subscribable so the AI Center UI can show live
 * progress. Failed jobs retry with exponential backoff up to
 * `maxAttempts`. Cancellation short-circuits with an AbortSignal.
 */
import { uid } from "@/lib/db";
import { getSettings } from "./AIManager";
import type { AIJob, AIJobKind, AIJobStatus, AIProviderId } from "./types";

type JobRunner<T> = (ctx: { signal: AbortSignal; onProgress: (n: number) => void }) => Promise<T>;

interface InternalJob<T = unknown> {
  job: AIJob;
  runner: JobRunner<T>;
  controller: AbortController;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

type Listener = (jobs: AIJob[]) => void;

class Queue {
  private jobs: InternalJob[] = [];
  private history: AIJob[] = [];
  private running = false;
  private listeners = new Set<Listener>();
  private readonly maxHistory = 100;

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  snapshot(): AIJob[] {
    return [...this.jobs.map((j) => j.job), ...this.history];
  }

  private emit(): void {
    const s = this.snapshot();
    for (const l of this.listeners) l(s);
  }

  async enqueue<T>(input: {
    kind: AIJobKind;
    label: string;
    conversationId?: string;
    estInputTokens?: number;
    estOutputTokens?: number;
    maxAttempts?: number;
    runner: JobRunner<T>;
  }): Promise<T> {
    const settings = await getSettings();
    const job: AIJob = {
      id: uid("aijob"),
      kind: input.kind,
      label: input.label,
      status: "queued",
      conversationId: input.conversationId,
      progress: 0,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 2,
      provider: settings.provider,
      model: input.kind === "embed" ? settings.embeddingModel : settings.chatModel,
      estInputTokens: input.estInputTokens ?? 0,
      estOutputTokens: input.estOutputTokens ?? 0,
      createdAt: Date.now(),
    };
    return new Promise<T>((resolve, reject) => {
      this.jobs.push({
        job,
        runner: input.runner as JobRunner<unknown>,
        controller: new AbortController(),
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.emit();
      void this.tick();
    });
  }

  cancel(id: string): boolean {
    const idx = this.jobs.findIndex((j) => j.job.id === id);
    if (idx === -1) return false;
    const j = this.jobs[idx]!;
    j.controller.abort();
    j.job.status = "cancelled";
    j.job.finishedAt = Date.now();
    j.reject(new Error("Cancelled"));
    this.history.unshift(j.job);
    this.jobs.splice(idx, 1);
    this.trimHistory();
    this.emit();
    return true;
  }

  clearHistory(): void {
    this.history = [];
    this.emit();
  }

  private trimHistory(): void {
    if (this.history.length > this.maxHistory) {
      this.history.length = this.maxHistory;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    const next = this.jobs[0];
    if (!next) return;
    this.running = true;
    next.job.status = "running";
    next.job.startedAt = Date.now();
    next.job.attempts += 1;
    this.emit();

    try {
      const value = await next.runner({
        signal: next.controller.signal,
        onProgress: (n) => {
          next.job.progress = Math.max(0, Math.min(1, n));
          this.emit();
        },
      });
      next.job.status = "done";
      next.job.progress = 1;
      next.job.finishedAt = Date.now();
      next.resolve(value);
      this.finalize(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cancelled = next.controller.signal.aborted;
      next.job.error = msg;
      if (!cancelled && next.job.attempts < next.job.maxAttempts) {
        // Requeue with backoff; keep at head so ordering is stable.
        next.job.status = "queued";
        this.running = false;
        const delay = 500 * 2 ** (next.job.attempts - 1);
        setTimeout(() => void this.tick(), delay);
        this.emit();
        return;
      }
      next.job.status = cancelled ? "cancelled" : "failed";
      next.job.finishedAt = Date.now();
      next.reject(err);
      this.finalize(next);
    }
  }

  private finalize(entry: InternalJob): void {
    this.jobs.shift();
    this.history.unshift(entry.job);
    this.trimHistory();
    this.running = false;
    this.emit();
    void this.tick();
  }

  totals(): { queued: number; running: number; done: number; failed: number; totalCostUSD: number } {
    const all = this.snapshot();
    return {
      queued: all.filter((j) => j.status === "queued").length,
      running: all.filter((j) => j.status === "running").length,
      done: all.filter((j) => j.status === "done").length,
      failed: all.filter((j) => j.status === "failed").length,
      totalCostUSD: all.reduce((n, j) => n + (j.costUSD ?? 0), 0),
    };
  }
}

export const aiQueue = new Queue();

export type { AIJob, AIJobKind, AIJobStatus, AIProviderId };
