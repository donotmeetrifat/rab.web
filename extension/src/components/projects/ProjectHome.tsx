/**
 * ProjectHome — Phase 12.5 dashboard.
 *
 * One clean surface per project. Renders a live view-model produced by
 * `services/projectBrain.ts`; never triggers new writes or observers.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardCopy,
  Compass,
  Download,
  ExternalLink,
  Layers,
  Search,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import type { Project, StoredConversation } from "@/types";
import { providerMeta } from "@/lib/providers";
import { Button } from "@/components/Button";
import {
  getProjectBrain,
  renderProjectSummary,
  type ProjectBrain,
} from "@/services/projectBrain";
import { exportAll } from "@/services/memories";
import { useToast } from "@/components/Toast";

interface Props {
  project: Project;
  onOpenConversation?: (c: StoredConversation) => void;
  onSearchProject?: (query: string) => void;
  onAskMemlace?: () => void;
  onContinueAnywhere?: (c: StoredConversation) => void;
}

const STATUS_TONE: Record<ProjectBrain["status"], string> = {
  planning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "in-progress": "bg-primary/10 text-primary border-primary/30",
  testing: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "ready-to-deploy":
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  maintaining: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

export function ProjectHome({
  project,
  onOpenConversation,
  onSearchProject,
  onAskMemlace,
  onContinueAnywhere,
}: Props) {
  const toast = useToast();
  const [brain, setBrain] = useState<ProjectBrain | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProjectBrain(project)
      .then((b) => {
        if (!cancelled) setBrain(b);
      })
      .catch((err) => console.warn("[memlace] project brain failed", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project]);

  const latest = brain?.timeline[0]?.conversation ?? null;

  const copySummary = useCallback(async () => {
    if (!brain) return;
    try {
      await navigator.clipboard.writeText(renderProjectSummary(brain));
      toast.success("Project summary copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [brain, toast]);

  const exportProject = useCallback(async () => {
    if (!brain) return;
    try {
      const json = await exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memlace-${project.name.replace(/[^a-z0-9-_]+/gi, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    }
  }, [brain, project.name, toast]);

  return (
    <div className="flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-3xl px-5 py-5 space-y-6">
        {/* Header ---------------------------------------------------- */}
        <header className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-xl grid place-items-center text-white shrink-0"
              style={{ background: project.color }}
              aria-hidden
            >
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold truncate">{project.name}</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {brain
                  ? `${brain.counts.conversations} conversations · ${brain.counts.knowledgeItems} indexed · ${brain.counts.memories} notes`
                  : "Loading…"}
              </p>
            </div>
            {brain && (
              <span
                className={`shrink-0 text-[10px] font-medium px-2 py-1 rounded-full border ${STATUS_TONE[brain.status]}`}
              >
                {brain.statusLabel}
              </span>
            )}
          </div>

          {/* Quick actions — max five */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => latest && onContinueAnywhere?.(latest)}
              disabled={!latest}
              title={latest ? "Continue latest conversation" : "No conversation yet"}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Continue Anywhere
            </Button>
            <Button size="sm" variant="secondary" onClick={onAskMemlace}>
              <Sparkles className="h-3.5 w-3.5" />
              Ask Memlace
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSearchProject?.(project.name)}
            >
              <Search className="h-3.5 w-3.5" />
              Search Project
            </Button>
            <Button size="sm" variant="ghost" onClick={copySummary} disabled={!brain}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy Summary
            </Button>
            <Button size="sm" variant="ghost" onClick={exportProject} disabled={!brain}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </header>

        {loading && !brain && (
          <div className="text-xs text-muted-foreground">Assembling project brain…</div>
        )}

        {brain && (
          <>
            {/* Summary --------------------------------------------- */}
            <Section title="Summary" icon={<Compass className="h-3.5 w-3.5" />}>
              <ul className="space-y-1 text-[13px] leading-relaxed text-foreground/85">
                {brain.summary.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary/60 mt-1.5 h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Recent activity ------------------------------------- */}
            {latest && (
              <Section title="Recent Activity" icon={<Activity className="h-3.5 w-3.5" />}>
                <button
                  type="button"
                  onClick={() => onOpenConversation?.(latest)}
                  className="w-full text-left rounded-lg border border-border bg-surface px-3 py-2.5 hover:bg-muted transition"
                >
                  <div className="flex items-center gap-2">
                    <ProviderDot provider={latest.provider} />
                    <span className="text-xs font-medium truncate flex-1">
                      {latest.title || "Untitled"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(latest.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              </Section>
            )}

            {/* Knowledge ------------------------------------------- */}
            {(brain.knowledge.technologies.length > 0 ||
              brain.knowledge.topics.length > 0) && (
              <Section title="Knowledge" icon={<BookOpen className="h-3.5 w-3.5" />}>
                <div className="space-y-2">
                  {brain.knowledge.technologies.length > 0 && (
                    <ChipRow label="Tech" items={brain.knowledge.technologies} />
                  )}
                  {brain.knowledge.languages.length > 0 && (
                    <ChipRow label="Languages" items={brain.knowledge.languages} />
                  )}
                  {brain.knowledge.topics.length > 0 && (
                    <ChipRow label="Topics" items={brain.knowledge.topics} />
                  )}
                  {brain.knowledge.links.length > 0 && (
                    <ul className="pt-1 space-y-1">
                      {brain.knowledge.links.slice(0, 5).map((l, i) => (
                        <li key={i}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline truncate max-w-full"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{l.url}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Section>
            )}

            {/* Goals ----------------------------------------------- */}
            {brain.goals.length > 0 && (
              <Section title="Goals" icon={<Target className="h-3.5 w-3.5" />}>
                <ul className="space-y-1.5">
                  {brain.goals.map((g) => (
                    <li key={g.id} className="flex items-start gap-2 text-[13px]">
                      {g.status === "completed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                      ) : g.status === "abandoned" ? (
                        <XCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      )}
                      <span
                        className={
                          g.status === "completed"
                            ? "line-through text-muted-foreground"
                            : g.status === "abandoned"
                              ? "text-muted-foreground"
                              : ""
                        }
                      >
                        {g.label}
                      </span>
                      {g.status === "active" && (
                        <span className="ml-auto text-[10px] text-primary/80">Active</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Decisions ------------------------------------------- */}
            {brain.decisions.length > 0 && (
              <Section
                title="Important Decisions"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              >
                <ol className="relative border-l border-border/70 pl-4 space-y-3">
                  {brain.decisions.slice(0, 12).map((d) => {
                    const superseded = brain.decisions.some((x) => x.supersedes === d.id);
                    return (
                      <li key={d.id} className="relative">
                        <span
                          className={`absolute -left-[19px] top-1.5 h-2 w-2 rounded-full ${
                            d.polarity === "reject"
                              ? "bg-rose-500"
                              : d.polarity === "complete"
                                ? "bg-emerald-500"
                                : "bg-primary"
                          }`}
                          aria-hidden
                        />
                        <div className="text-[13px] leading-snug">
                          <span className="mr-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {d.polarity === "reject"
                              ? "Rejected"
                              : d.polarity === "complete"
                                ? "Done"
                                : d.polarity === "unresolved"
                                  ? "Open"
                                  : "Adopted"}
                          </span>
                          <span
                            className={
                              superseded ? "text-muted-foreground line-through" : ""
                            }
                          >
                            {d.statement}
                          </span>
                          {!superseded && d.polarity === "adopt" && (
                            <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(d.detectedAt).toLocaleDateString()}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Section>
            )}

            {/* Timeline -------------------------------------------- */}
            {brain.timeline.length > 0 && (
              <Section title="Timeline" icon={<Activity className="h-3.5 w-3.5" />}>
                <ol className="space-y-1.5">
                  {brain.timeline.slice(0, 12).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onOpenConversation?.(t.conversation)}
                        className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition"
                      >
                        <span className="text-[10px] tabular-nums text-muted-foreground w-14 shrink-0">
                          {new Date(t.ts).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <ProviderDot provider={t.conversation.provider} />
                        <span className="text-xs truncate flex-1">
                          {t.conversation.title || "Untitled"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {/* Related --------------------------------------------- */}
            {(brain.related.conversations.length > 0 ||
              brain.related.projects.length > 0) && (
              <Section title="Related Work" icon={<Layers className="h-3.5 w-3.5" />}>
                {brain.related.projects.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Projects
                    </div>
                    <ul className="flex flex-wrap gap-1.5">
                      {brain.related.projects.map(({ project: p, sharedTech }) => (
                        <li
                          key={p.id}
                          className="text-[11px] px-2 py-1 rounded-md border border-border bg-surface"
                          title={`Shared: ${sharedTech.join(", ")}`}
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
                            style={{ background: p.color }}
                          />
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {brain.related.conversations.length > 0 && (
                  <ul className="space-y-1">
                    {brain.related.conversations.slice(0, 5).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => onOpenConversation?.(c)}
                          className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition text-xs"
                        >
                          <ProviderDot provider={c.provider} />
                          <span className="truncate">{c.title || "Untitled"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {brain.counts.conversations === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-sm font-medium">This project remembers nothing yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Chat with any AI in your browser — Memlace will silently attach relevant
                  conversations here.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
        {label}
      </span>
      {items.slice(0, 14).map((t) => (
        <span
          key={t}
          className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ProviderDot({ provider }: { provider: StoredConversation["provider"] }) {
  const meta = providerMeta(provider);
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
      style={{ background: meta?.color || "var(--color-primary)" }}
      title={meta?.name}
      aria-hidden
    />
  );
}
