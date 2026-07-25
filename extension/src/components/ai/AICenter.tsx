/**
 * AI Center — live queue view (pending / running / completed / failed) plus
 * aggregate token & cost estimate. Everything server-owned by AIQueue.
 */
import { useEffect, useState } from "react";
import { Play, X, RefreshCw, CheckCircle2, AlertCircle, Loader2, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { aiQueue } from "@/ai/AIQueue";
import type { AIJob, AIJobStatus } from "@/ai/AIQueue";
import { formatCost } from "@/ai/CostEstimator";
import { providerLabel } from "@/ai/AIManager";

const STATUS_ORDER: AIJobStatus[] = ["running", "queued", "failed", "cancelled", "done"];

export function AICenter() {
  const [jobs, setJobs] = useState<AIJob[]>([]);
  useEffect(() => aiQueue.subscribe(setJobs), []);

  const totals = aiQueue.totals();
  const grouped = new Map<AIJobStatus, AIJob[]>();
  for (const status of STATUS_ORDER) grouped.set(status, []);
  for (const j of jobs) grouped.get(j.status)?.push(j);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold">AI Center</h1>
          <span className="ml-2 text-[10px] text-muted-foreground">
            {totals.queued + totals.running} active · {totals.done} done · {totals.failed} failed
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Total est. cost: <b className="text-foreground">{formatCost(totals.totalCostUSD)}</b>
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
          <Stat label="Queued" value={totals.queued} tint="text-muted-foreground" />
          <Stat label="Running" value={totals.running} tint="text-primary" />
          <Stat label="Done" value={totals.done} tint="text-emerald-500" />
          <Stat label="Failed" value={totals.failed} tint="text-rose-500" />
        </div>
      </header>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="secondary" onClick={() => aiQueue.clearHistory()}>
          <Trash2 className="h-3.5 w-3.5" /> Clear history
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {jobs.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-12">
            No AI jobs yet. Enable AI in Settings, then run summarise, tag, or Ask Memlace.
          </div>
        )}
        {STATUS_ORDER.map((status) => {
          const list = grouped.get(status)!;
          if (list.length === 0) return null;
          return (
            <section key={status}>
              <h2 className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                {status} ({list.length})
              </h2>
              <ul className="space-y-1.5">
                {list.map((j) => (
                  <li key={j.id} className="rounded-lg border border-border bg-surface p-2.5">
                    <div className="flex items-start gap-2">
                      <StatusIcon status={j.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{j.label}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>{providerLabel(j.provider)} · {j.model}</span>
                          {j.estInputTokens > 0 && (
                            <span>~{j.estInputTokens.toLocaleString()} in / {j.estOutputTokens.toLocaleString()} out</span>
                          )}
                          {typeof j.costUSD === "number" && <span>{formatCost(j.costUSD)}</span>}
                          {j.attempts > 1 && <span>attempt {j.attempts}/{j.maxAttempts}</span>}
                        </div>
                        {j.status === "running" && (
                          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-[width]"
                              style={{ width: `${Math.round(j.progress * 100)}%` }}
                            />
                          </div>
                        )}
                        {j.error && (
                          <div className="mt-1 text-[10px] text-rose-500 line-clamp-2">{j.error}</div>
                        )}
                      </div>
                      {(j.status === "queued" || j.status === "running") && (
                        <button
                          type="button"
                          aria-label="Cancel job"
                          onClick={() => aiQueue.cancel(j.id)}
                          className="h-6 w-6 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${tint}`}>{value}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: AIJobStatus }) {
  switch (status) {
    case "queued": return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
    case "running": return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
    case "done": return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />;
    case "cancelled": return <RefreshCw className="h-4 w-4 text-amber-500 shrink-0" />;
  }
}
