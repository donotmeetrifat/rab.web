/**
 * HomePanel — Phase 12.7 Smart Workspace surface.
 *
 * A calm, single-scroll home screen. No dashboards, no charts, no
 * notifications: just what to continue, what to finish, what today
 * looked like, and quiet cross-project hints. Everything is derived
 * from `smartWorkspace.getWorkspace()`.
 */
import { memo, useEffect, useMemo, useState } from "react";
import {
  Play,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle2,
  Loader2,
  Link2,
} from "lucide-react";
import {
  getWorkspace,
  humanAgo,
  type Workspace,
  type ContinueItem,
  type NeedsAttentionItem,
} from "@/services/smartWorkspace";
import { getConversation } from "@/services/conversations";
import { providerMeta } from "@/lib/providers";
import type { Project, StoredConversation } from "@/types";

interface HomePanelProps {
  projects: Project[];
  onOpenConversation: (conv: StoredConversation) => void;
  onOpenProject: (projectId: string) => void;
  onOpenSearch: () => void;
  onOpenAsk: () => void;
}

export function HomePanel(props: HomePanelProps) {
  const { onOpenConversation, onOpenProject, onOpenSearch, onOpenAsk, projects } = props;
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getWorkspace()
      .then((w) => {
        if (alive) setWs(w);
      })
      .catch(() => {
        /* silent — leave placeholder */
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p] as const)),
    [projects],
  );

  const openConv = async (convId: string) => {
    const conv = await getConversation(convId).catch(() => undefined);
    if (conv) onOpenConversation(conv);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h1 className="text-sm font-semibold">Home</h1>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {ws?.everythingSynced ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden />
              Everything synced
            </>
          ) : (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Syncing
            </>
          )}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6" role="main">
        {/* Next action */}
        {ws?.nextAction && (
          <section aria-label="Next suggested action" className="animate-fade-in">
            <button
              type="button"
              onClick={() =>
                ws.nextAction?.sourceConversationId
                  ? void openConv(ws.nextAction.sourceConversationId)
                  : ws.nextAction?.sourceProjectId
                    ? onOpenProject(ws.nextAction.sourceProjectId)
                    : undefined
              }
              className="group w-full text-left rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors p-3.5"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-primary font-semibold">
                <ArrowRight className="h-3 w-3" aria-hidden />
                Next suggested action
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground line-clamp-2">
                {ws.nextAction.text}
              </div>
            </button>
          </section>
        )}

        {/* Continue working */}
        <section aria-labelledby="hp-continue">
          <SectionHeader id="hp-continue" icon={Play} title="Continue working" />
          {loading ? (
            <SkeletonList rows={3} />
          ) : ws?.continueWorking.length ? (
            <ul className="space-y-1.5">
              {ws.continueWorking.map((item) => (
                <ContinueRow
                  key={item.id}
                  item={item}
                  onOpen={() => void openConv(item.conversationId)}
                />
              ))}
            </ul>
          ) : (
            <EmptyLine text="Nothing in progress yet — start a conversation on any AI." />
          )}
        </section>

        {/* Recent focus */}
        {ws?.recentFocus.length ? (
          <section aria-labelledby="hp-focus">
            <SectionHeader id="hp-focus" icon={Sparkles} title="Your recent focus" />
            <div className="flex flex-wrap gap-1.5">
              {ws.recentFocus.map((f) => (
                <span
                  key={f.label + f.kind}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 h-6 text-[11px] text-foreground/80"
                >
                  {f.label}
                  <span className="text-muted-foreground tabular-nums">·{f.count}</span>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* Needs attention */}
        {ws?.needsAttention.length ? (
          <section aria-labelledby="hp-attention">
            <SectionHeader id="hp-attention" icon={AlertTriangle} title="Needs attention" />
            <ul className="space-y-1.5">
              {ws.needsAttention.map((item) => (
                <AttentionRow
                  key={item.conversationId}
                  item={item}
                  onOpen={() => void openConv(item.conversationId)}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {/* Projects (ranked) */}
        {projects.length ? (
          <section aria-labelledby="hp-projects">
            <SectionHeader id="hp-projects" icon={ArrowRight} title="Projects" />
            <div className="grid grid-cols-2 gap-1.5">
              {(ws?.ranking ?? [])
                .slice(0, 6)
                .map((r) => projectById.get(r.id))
                .filter((p): p is Project => !!p)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenProject(p.id)}
                    className="group text-left rounded-lg border border-border bg-surface hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-3 py-2 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: p.color || "#5b8cff" }}
                        aria-hidden
                      />
                      <span className="text-xs font-medium truncate">{p.name}</span>
                    </div>
                  </button>
                ))}
              {(!ws?.ranking.length ? projects.slice(0, 6) : []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenProject(p.id)}
                  className="text-left rounded-lg border border-border bg-surface hover:bg-muted px-3 py-2"
                >
                  <span className="text-xs font-medium truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Cross-project connections */}
        {ws?.crossProject.length ? (
          <section aria-labelledby="hp-cross">
            <SectionHeader id="hp-cross" icon={Link2} title="Also appears in" />
            <ul className="space-y-1.5">
              {ws.crossProject.map((c) => (
                <li
                  key={c.topic}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                >
                  <span className="font-medium">{c.topic}</span>
                  <span className="text-muted-foreground"> — used in </span>
                  {c.projects.map((p, i) => (
                    <span key={p.id}>
                      <button
                        type="button"
                        onClick={() => onOpenProject(p.id)}
                        className="text-primary hover:underline"
                      >
                        {p.name}
                      </button>
                      {i < c.projects.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Quick search + Ask */}
        <section aria-label="Quick actions" className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex-1 h-9 rounded-lg border border-border bg-surface hover:bg-muted text-xs inline-flex items-center justify-center gap-1.5"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            Quick search
            <kbd className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={onOpenAsk}
            className="flex-1 h-9 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 text-xs inline-flex items-center justify-center gap-1.5 text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Ask Memlace
          </button>
        </section>

        {/* Daily digest */}
        {ws?.daily ? (
          <section aria-labelledby="hp-digest" className="pb-4">
            <SectionHeader id="hp-digest" icon={CheckCircle2} title="Today" />
            <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-xs text-foreground/80 space-y-1">
              <div>
                {ws.daily.conversationsToday} conversation
                {ws.daily.conversationsToday === 1 ? "" : "s"} · {ws.daily.projectsUpdated} project
                {ws.daily.projectsUpdated === 1 ? "" : "s"} updated
              </div>
              {ws.daily.goalsCompleted > 0 && (
                <div>
                  {ws.daily.goalsCompleted} goal{ws.daily.goalsCompleted === 1 ? "" : "s"} completed
                </div>
              )}
              {ws.daily.decisionsRecorded > 0 && (
                <div>
                  {ws.daily.decisionsRecorded} decision
                  {ws.daily.decisionsRecorded === 1 ? "" : "s"} recorded
                </div>
              )}
              {ws.daily.focusChips.length > 0 && (
                <div className="text-muted-foreground">
                  Focus: {ws.daily.focusChips.join(" · ")}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Row helpers
 * ------------------------------------------------------------------ */

const SectionHeader = memo(function SectionHeader({
  id,
  icon: Icon,
  title,
}: {
  id: string;
  icon: typeof Play;
  title: string;
}) {
  return (
    <h2
      id={id}
      className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {title}
    </h2>
  );
});

const ContinueRow = memo(function ContinueRow({
  item,
  onOpen,
}: {
  item: ContinueItem;
  onOpen: () => void;
}) {
  const p = providerMeta(item.provider);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group w-full text-left rounded-lg border border-border bg-surface hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-3 py-2.5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: p?.color ?? "#94a3b8" }}
            aria-hidden
          />
          <span className="text-xs font-medium truncate">{item.conversationTitle}</span>
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
            {humanAgo(item.lastActive)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          {item.projectName && (
            <span className="truncate">
              <span className="text-foreground/60">in</span> {item.projectName}
            </span>
          )}
          {item.progress && (
            <span className="truncate">
              {item.projectName ? "· " : ""}
              {item.progress}
            </span>
          )}
        </div>
        {item.nextAction && (
          <div className="mt-1 text-[11px] text-primary line-clamp-1">
            → {item.nextAction}
          </div>
        )}
      </button>
    </li>
  );
});

const AttentionRow = memo(function AttentionRow({
  item,
  onOpen,
}: {
  item: NeedsAttentionItem;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group w-full text-left rounded-lg border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 px-3 py-2.5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
          <span className="text-xs font-medium truncate">{item.title}</span>
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
            {humanAgo(item.lastActive)}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{item.hint}</div>
      </button>
    </li>
  );
});

function SkeletonList({ rows }: { rows: number }) {
  return (
    <ul className="space-y-1.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="h-14 rounded-lg border border-border bg-surface animate-pulse"
        />
      ))}
    </ul>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-muted-foreground rounded-lg border border-dashed border-border px-3 py-3">
      {text}
    </p>
  );
}
