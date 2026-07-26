/**
 * Ask Memlace 2.0 — Personal Intelligence Assistant.
 *
 * Local-first: every answer is built from the user's saved memory by
 * AnswerEngine — never fabricated, never round-tripped to the cloud
 * unless the user has explicitly enabled a provider (in which case
 * askMemlace() still runs after the local answer as an enrichment
 * pass, opt-in).
 *
 * Deliberately not a chatbot UI: answers are Answer Cards, followed by
 * sources, related questions, and a compact Memory Explorer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Sparkles,
  MessageSquare,
  ExternalLink,
  Loader2,
  Folder,
  Lightbulb,
  Code2,
  StickyNote,
  ChevronRight,
  Clock,
  Send,
  Compass,
} from "lucide-react";
import { Button } from "@/components/Button";
import {
  answerQuestion,
  loadExplorer,
  type Answer,
  type AnswerSource,
  type ExplorerFacets,
} from "@/ai/AnswerEngine";
import { askMemlace, type AskAnswer } from "@/ai/AskMemlace";
import { isAIEnabled, providerLabel } from "@/ai/AIManager";
import { formatCost } from "@/ai/CostEstimator";
import { aiQueue } from "@/ai/AIQueue";
import { providerMeta } from "@/lib/providers";

interface Turn {
  id: string;
  question: string;
  answer?: Answer;
  enrichment?: AskAnswer;
  enriching?: boolean;
  error?: string;
  pending: boolean;
}

interface Props {
  onOpenConversation?: (id: string) => void;
  onOpenProject?: (id: string) => void;
  scopedProjectId?: string | null;
  scopedProjectName?: string | null;
}

const ICONS = {
  conv: MessageSquare,
  decision: Lightbulb,
  project: Folder,
  code: Code2,
  note: StickyNote,
} as const;

export function AskMemlacePanel({
  onOpenConversation,
  onOpenProject,
  scopedProjectId,
  scopedProjectName,
}: Props) {
  const [aiOn, setAiOn] = useState(false);
  const [enrichOn, setEnrichOn] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [explorer, setExplorer] = useState<ExplorerFacets | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void isAIEnabled().then(setAiOn);
  }, []);
  useEffect(() => {
    void loadExplorer().then(setExplorer);
  }, [turns.length]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const ask = async (rawQ: string) => {
    const q = rawQ.trim();
    if (!q) return;
    const id = `t_${Date.now()}`;
    setTurns((t) => [...t, { id, question: q, pending: true }]);
    setInput("");

    // 1. Local answer — always runs, always fast.
    try {
      const ans = await answerQuestion(q, {
        scopedToProjectId: scopedProjectId ?? undefined,
      });
      setTurns((t) =>
        t.map((x) => (x.id === id ? { ...x, answer: ans, pending: false } : x)),
      );

      // 2. Optional enrichment — only when the user opted in.
      if (aiOn && enrichOn && ans.confidence !== "none") {
        setTurns((t) => t.map((x) => (x.id === id ? { ...x, enriching: true } : x)));
        try {
          const enriched = await aiQueue.enqueue({
            kind: "ask",
            label: `Ask: ${q.slice(0, 60)}`,
            estInputTokens: 3000,
            estOutputTokens: 500,
            runner: ({ signal }) => askMemlace(q, { signal }),
          });
          setTurns((t) =>
            t.map((x) =>
              x.id === id ? { ...x, enrichment: enriched, enriching: false } : x,
            ),
          );
        } catch (err) {
          setTurns((t) =>
            t.map((x) => (x.id === id ? { ...x, enriching: false } : x)),
          );
          void err;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTurns((t) =>
        t.map((x) => (x.id === id ? { ...x, error: msg, pending: false } : x)),
      );
    }
  };

  const placeholder = scopedProjectName
    ? `Ask about ${scopedProjectName}…`
    : "Ask your memory anything…";

  const suggestions = useMemo(
    () =>
      scopedProjectName
        ? [
            `What did we decide in ${scopedProjectName}?`,
            `Show recent ${scopedProjectName} code`,
            `When did I last work on ${scopedProjectName}?`,
          ]
        : [
            "What did I decide about authentication?",
            "Show every Supabase RLS discussion",
            "Which AI helped me solve the JWT bug?",
            "Show all my React projects",
          ],
    [scopedProjectName],
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold">Ask Memlace</h1>
          {scopedProjectName && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Folder className="h-3 w-3" />
              {scopedProjectName}
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">
            Searches your saved memory · never the open web
          </span>
        </div>
        {aiOn && (
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={enrichOn}
              onChange={(e) => setEnrichOn(e.target.checked)}
              className="h-3 w-3 accent-primary"
            />
            Ask my AI provider to summarise the answer (optional, uses tokens)
          </label>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {turns.length === 0 && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground/90">
                <Search className="h-3.5 w-3.5 text-primary" />
                Try asking
              </div>
              <ul className="mt-2 space-y-1">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => void ask(s)}
                      className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <span className="text-muted-foreground">›</span>{" "}
                      <span className="text-foreground/90">{s}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {explorer && <MemoryExplorer facets={explorer} onOpenProject={onOpenProject} onAsk={ask} />}
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2 text-sm">
              <div className="text-[10px] uppercase tracking-widest text-primary/80 mb-0.5">
                Question
              </div>
              {t.question}
            </div>

            {t.pending && (
              <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Searching your memory…
              </div>
            )}

            {t.answer && (
              <AnswerCard
                answer={t.answer}
                enrichment={t.enrichment}
                enriching={t.enriching}
                onOpenConversation={onOpenConversation}
                onOpenProject={onOpenProject}
                onFollowUp={ask}
              />
            )}

            {t.error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-sm text-rose-500">
                {t.error}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="border-t border-border p-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-9 rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label="Ask a question"
        />
        <Button type="submit" variant="primary" disabled={!input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Answer Card
 * ------------------------------------------------------------------ */

function AnswerCard({
  answer,
  enrichment,
  enriching,
  onOpenConversation,
  onOpenProject,
  onFollowUp,
}: {
  answer: Answer;
  enrichment?: AskAnswer;
  enriching?: boolean;
  onOpenConversation?: (id: string) => void;
  onOpenProject?: (id: string) => void;
  onFollowUp: (q: string) => void;
}) {
  const [showSources, setShowSources] = useState(false);

  const confChip: Record<Answer["confidence"], string> = {
    none: "bg-muted text-muted-foreground",
    low: "bg-amber-500/10 text-amber-600",
    medium: "bg-primary/10 text-primary",
    high: "bg-emerald-500/10 text-emerald-600",
  };

  return (
    <article className="rounded-2xl border border-border bg-background overflow-hidden">
      <header className="px-3 pt-3 pb-2 flex items-start gap-2">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <span>Memlace · local memory</span>
            <span className={`px-1.5 rounded ${confChip[answer.confidence]}`}>
              {answer.confidence}
            </span>
            <span className="ml-auto tabular-nums">{answer.tookMs}ms</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground">
            {answer.headline}
          </h3>
          {answer.detail && (
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              {answer.detail}
            </p>
          )}
        </div>
      </header>

      {answer.bullets.length > 0 && (
        <div className="px-3 pb-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Based on
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {answer.bullets.map((b, i) => {
              const Icon = ICONS[b.icon];
              return (
                <li
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]"
                >
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  {b.text}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {answer.codeSnippets.length > 0 && (
        <div className="mx-3 mb-2 rounded-lg border border-border bg-muted/40">
          <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Code2 className="h-3 w-3" /> Code from your memory
          </div>
          <ul className="divide-y divide-border">
            {answer.codeSnippets.slice(0, 3).map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onOpenConversation?.(s.conversationId)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">{s.language ?? "code"}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="truncate">{s.conversationTitle}</span>
                  </div>
                  <pre className="mt-0.5 text-[11px] leading-snug text-foreground/85 whitespace-pre-wrap break-words font-mono">
                    {s.preview}
                  </pre>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer.latestActivity && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() =>
              onOpenConversation?.(answer.latestActivity!.conversationId)
            }
            className="w-full flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] hover:bg-muted"
          >
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Latest activity:</span>
            <span className="truncate flex-1 text-left text-foreground">
              {answer.latestActivity.conversationTitle}
            </span>
            <ProviderTag id={answer.latestActivity.provider} />
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {enriching && (
        <div className="px-3 pb-2 text-[11px] text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Asking your AI to refine…
        </div>
      )}
      {enrichment && (
        <div className="mx-3 mb-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-widest text-primary/80 mb-1 flex items-center justify-between gap-2">
            <span>
              AI refinement · {providerLabel(enrichment.provider)} ·{" "}
              {enrichment.model}
            </span>
            <span>{enrichment.cached ? "cached" : formatCost(enrichment.costUSD)}</span>
          </div>
          <div className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/90">
            {enrichment.answer}
          </div>
        </div>
      )}

      {answer.related.length > 0 && (
        <div className="px-3 pb-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Related
          </div>
          <ul className="flex flex-wrap gap-1">
            {answer.related.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => onFollowUp(`Show ${r} discussions`)}
                  className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] hover:bg-muted"
                >
                  {r}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer.followUps.length > 0 && (
        <div className="px-3 pb-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Ask next
          </div>
          <ul className="space-y-1">
            {answer.followUps.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => onFollowUp(f)}
                  className="w-full text-left rounded-lg border border-border bg-surface px-2 py-1 text-[12px] hover:bg-muted flex items-center gap-1"
                >
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  {f}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer.sources.length > 0 && (
        <details
          className="border-t border-border"
          open={showSources}
          onToggle={(e) => setShowSources((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-3 py-2 text-[11px] text-muted-foreground hover:bg-muted flex items-center gap-2">
            <ChevronRight
              className={`h-3 w-3 transition-transform ${showSources ? "rotate-90" : ""}`}
            />
            {answer.sources.length}{" "}
            {answer.sources.length === 1 ? "source" : "sources"} · click to open
          </summary>
          <ul className="px-1 pb-2">
            {answer.sources.map((s) => (
              <SourceRow
                key={`${s.kind}-${s.id}`}
                s={s}
                onOpenConversation={onOpenConversation}
                onOpenProject={onOpenProject}
              />
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function SourceRow({
  s,
  onOpenConversation,
  onOpenProject,
}: {
  s: AnswerSource;
  onOpenConversation?: (id: string) => void;
  onOpenProject?: (id: string) => void;
}) {
  const Icon =
    s.kind === "conversation"
      ? MessageSquare
      : s.kind === "project"
        ? Folder
        : s.kind === "decision"
          ? Lightbulb
          : s.kind === "code"
            ? Code2
            : StickyNote;

  const clickable =
    (s.kind === "conversation" && onOpenConversation) ||
    (s.kind === "code" && onOpenConversation) ||
    (s.kind === "project" && onOpenProject);

  const handle = () => {
    if (s.kind === "conversation") onOpenConversation?.(s.id);
    else if (s.kind === "code")
      onOpenConversation?.(s.id.split("#")[0]);
    else if (s.kind === "project") onOpenProject?.(s.id);
  };

  return (
    <li>
      <button
        type="button"
        disabled={!clickable}
        onClick={handle}
        className="w-full flex items-center gap-2 rounded-md px-2 py-1 text-xs text-left hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="truncate flex-1 text-foreground/90">{s.label}</span>
        {s.meta && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {s.meta}
          </span>
        )}
        {s.provider && <ProviderTag id={s.provider} />}
        {clickable && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
      </button>
    </li>
  );
}

function ProviderTag({ id }: { id: string }) {
  const meta = providerMeta(id as never);
  if (!meta) return null;
  return <span className="text-[10px] text-muted-foreground">{meta.name}</span>;
}


/* ------------------------------------------------------------------ *
 * Memory Explorer — cheap facet cloud rendered on the empty state.
 * ------------------------------------------------------------------ */

function MemoryExplorer({
  facets,
  onOpenProject,
  onAsk,
}: {
  facets: ExplorerFacets;
  onOpenProject?: (id: string) => void;
  onAsk: (q: string) => void;
}) {
  const hasAny =
    facets.projects.length ||
    facets.technologies.length ||
    facets.recent.length ||
    facets.pinned.length;
  if (!hasAny) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground/90">
        <Compass className="h-3.5 w-3.5 text-primary" />
        Explore your memory
      </div>

      {facets.projects.length > 0 && (
        <FacetGroup title="Projects">
          {facets.projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenProject?.(p.id)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted"
            >
              <Folder className="h-3 w-3 text-primary" />
              {p.name}
              <span className="text-muted-foreground">· {p.count}</span>
            </button>
          ))}
        </FacetGroup>
      )}

      {facets.technologies.length > 0 && (
        <FacetGroup title="Technologies">
          {facets.technologies.map((t) => (
            <FacetChip
              key={t.name}
              onClick={() => onAsk(`Show every ${t.name} discussion`)}
              label={t.name}
              count={t.count}
            />
          ))}
        </FacetGroup>
      )}

      {facets.frameworks.length > 0 && (
        <FacetGroup title="Frameworks">
          {facets.frameworks.map((t) => (
            <FacetChip
              key={t.name}
              onClick={() => onAsk(`Show every ${t.name} discussion`)}
              label={t.name}
              count={t.count}
            />
          ))}
        </FacetGroup>
      )}

      {facets.languages.length > 0 && (
        <FacetGroup title="Languages">
          {facets.languages.map((t) => (
            <FacetChip
              key={t.name}
              onClick={() => onAsk(`Show ${t.name} code snippets`)}
              label={t.name}
              count={t.count}
            />
          ))}
        </FacetGroup>
      )}

      {facets.topics.length > 0 && (
        <FacetGroup title="Topics">
          {facets.topics.map((t) => (
            <FacetChip
              key={t.name}
              onClick={() => onAsk(`What did I discuss about ${t.name}?`)}
              label={t.name}
              count={t.count}
            />
          ))}
        </FacetGroup>
      )}
    </section>
  );
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FacetChip({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {label}
      <span className="text-muted-foreground">· {count}</span>
    </button>
  );
}
