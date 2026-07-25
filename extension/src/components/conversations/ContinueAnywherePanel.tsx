import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  CONTINUATION_PROVIDERS,
  copyToClipboard,
  openProviderTab,
  type ContinuationProviderId,
} from "@/lib/continuation";
import type { StoredConversation, StoredConvMessage } from "@/types";
import { buildContextPackage, type ContextPackage } from "@/context";
import { recommend, type Recommendation } from "@/context/Recommender";
import {
  getContinueHistory,
  recordContinue,
  type ContinueHistoryEntry,
} from "@/services/continueHistory";
import { setPendingHandoff } from "@/lib/handoff";
import { useToast } from "@/components/Toast";

interface Props {
  open: boolean;
  conversation: StoredConversation;
  messages: StoredConvMessage[];
  onClose: () => void;
}

const PROVIDER_DOT: Record<ContinuationProviderId, string> = {
  chatgpt: "#10a37f",
  claude: "#d97757",
  gemini: "#4285f4",
  deepseek: "#4d6bfe",
  copilot: "#0078d4",
  perplexity: "#20b8cd",
  aistudio: "#8e75f0",
};

const SIZE_LABEL: Record<ContextPackage["size"], string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  full: "Full",
};

const INCLUDED_ROWS: {
  label: string;
  kinds: ContextPackage["items"][number]["kind"][];
}[] = [
  { label: "Conversation", kinds: ["current-conversation", "recent-message"] },
  { label: "Timeline", kinds: ["session", "related-conversation"] },
  { label: "Knowledge", kinds: ["knowledge"] },
  { label: "Code", kinds: ["code"] },
  { label: "Files", kinds: ["file"] },
  { label: "Important Decisions", kinds: ["decision"] },
  { label: "Goals", kinds: ["goal"] },
  { label: "Project", kinds: ["project"] },
];

interface BuildState {
  loading: boolean;
  pkg: ContextPackage | null;
  error: string | null;
  retried: boolean;
}

/**
 * ContinueAnywherePanel — the Phase 12.4 "signature feature" UI. A
 * single premium panel replaces the old dropdown + preview split. Users:
 *   1. See the recommended AI + the provider grid.
 *   2. Pick a target → context builds automatically (cached ≤200ms).
 *   3. Preview shows Included items + size bucket.
 *   4. Continue copies + opens + shows a handoff reminder on the target.
 *
 * All wording stays user-facing: no tokens, no scores, no stack traces.
 */
export function ContinueAnywherePanel({ open, conversation, messages, onClose }: Props) {
  const toast = useToast();
  const [selected, setSelected] = useState<ContinuationProviderId | null>(null);
  const [build, setBuild] = useState<BuildState>({
    loading: false,
    pkg: null,
    error: null,
    retried: false,
  });
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<ContinueHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const recommendation: Recommendation = useMemo(
    () => recommend({ conversation, messages }),
    [conversation, messages],
  );

  /* ----- Load history + auto-select recommendation on open ----- */
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    void getContinueHistory().then(setHistory);
    // Preselect the recommended provider so preview appears "instantly".
    if (!selected) setSelected(recommendation.target);
    // Focus the panel for keyboard users.
    setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      previouslyFocused.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ----- Build context whenever the selection changes ----- */
  const runBuild = useCallback(
    async (target: ContinuationProviderId, isRetry = false) => {
      setBuild({ loading: true, pkg: null, error: null, retried: isRetry });
      try {
        const pkg = await buildContextPackage({ conversation, target });
        setBuild({ loading: false, pkg, error: null, retried: isRetry });
      } catch (err) {
        // Auto-retry once per user-guarded requirement.
        if (!isRetry) {
          setTimeout(() => void runBuild(target, true), 120);
          return;
        }
        setBuild({
          loading: false,
          pkg: null,
          error:
            err instanceof Error
              ? "Couldn't prepare the context. Try again."
              : "Couldn't prepare the context. Try again.",
          retried: true,
        });
      }
    },
    [conversation],
  );

  useEffect(() => {
    if (!open || !selected) return;
    void runBuild(selected);
  }, [open, selected, runBuild]);

  /* ----- Keyboard: Esc closes, Enter continues, arrow keys move grid ----- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter" && !build.loading && build.pkg) {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === "BUTTON") return; // let button handle
        e.preventDefault();
        void handleContinue();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, build.loading, build.pkg]);

  const handleContinue = useCallback(async () => {
    if (!build.pkg || !selected) return;
    setPending(true);
    try {
      await copyToClipboard(build.pkg.prompt);
      await setPendingHandoff(selected);
      const adapter = CONTINUATION_PROVIDERS.find((p) => p.id === selected)!;
      openProviderTab(adapter.newChatUrl);
      await recordContinue({
        conversationId: conversation.id,
        conversationTitle: conversation.title || "Untitled",
        from: conversation.provider,
        to: selected,
        size: build.pkg.size,
      });
      toast.success(
        `Opened ${adapter.name}`,
        "Context copied. Press Ctrl+V in the prompt box.",
      );
      onClose();
      void import("@/services/onboarding").then((m) => m.markChecklist("continuedElsewhere"));
    } catch (err) {
      toast.error(
        "Continue failed",
        err instanceof Error ? err.message : "Could not copy or open the target.",
      );
    } finally {
      setPending(false);
    }
  }, [build.pkg, selected, conversation, toast, onClose]);

  if (!open) return null;

  const includedMap = new Set(build.pkg?.items.map((i) => i.kind) ?? []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Continue Anywhere"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-[94%] max-w-md rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 focus:outline-none"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Memlace
            </p>
            <h2 className="text-sm font-semibold text-foreground">Continue Anywhere</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="h-7 px-2 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground text-[11px] font-medium inline-flex gap-1"
              aria-label="Recent transfers"
              title="Recent transfers"
            >
              <Clock className="h-3.5 w-3.5" />
              Recent
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {showHistory ? (
          <HistoryList history={history} onClose={() => setShowHistory(false)} onReopen={(e) => {
            setSelected(e.to);
            setShowHistory(false);
          }} />
        ) : (
          <div className="px-4 py-3 space-y-3">
            {/* Recommendation */}
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-primary/80 font-semibold">
                  Recommended
                </p>
                <p className="text-xs text-foreground">
                  <span className="font-semibold">
                    {CONTINUATION_PROVIDERS.find((p) => p.id === recommendation.target)?.name}
                  </span>{" "}
                  · {recommendation.reason}
                </p>
              </div>
            </div>

            {/* Provider grid */}
            <div>
              <p className="text-[11px] font-semibold text-foreground/80 mb-1.5">Choose your AI</p>
              <div
                role="radiogroup"
                aria-label="Continue with"
                className="grid grid-cols-2 gap-1.5"
              >
                {CONTINUATION_PROVIDERS.map((p) => {
                  const active = selected === p.id;
                  const isRec = recommendation.target === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelected(p.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus:outline-none ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span
                        className="h-6 w-6 shrink-0 rounded-md grid place-items-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: PROVIDER_DOT[p.id] }}
                        aria-hidden
                      >
                        {p.name.charAt(0)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium text-foreground truncate">
                          {p.name}
                        </span>
                        {isRec && (
                          <span className="block text-[10px] text-primary truncate">
                            Recommended
                          </span>
                        )}
                      </span>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status / preview */}
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 min-h-[110px]">
              {build.loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Preparing context…
                </div>
              )}

              {!build.loading && build.error && (
                <div className="space-y-2 py-1">
                  <p className="text-xs text-destructive">{build.error}</p>
                  <button
                    type="button"
                    onClick={() => selected && void runBuild(selected)}
                    className="h-7 rounded-md border border-border bg-surface px-2.5 text-[11px] font-medium hover:bg-muted"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!build.loading && !build.error && build.pkg && (
                <>
                  <p className="text-[11px] font-semibold text-foreground/80 mb-1.5">
                    Ready to continue
                  </p>
                  <ul className="space-y-0.5">
                    {build.pkg.summary.slice(0, 5).map((line) => (
                      <li
                        key={line}
                        className="flex items-start gap-1.5 text-xs text-foreground"
                      >
                        <span className="text-primary mt-0.5">✓</span>
                        <span className="truncate">{line}</span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"
                    title="Memlace automatically optimises context for this AI."
                  >
                    <span>
                      Estimated context size:{" "}
                      <span className="text-foreground font-medium">
                        {SIZE_LABEL[build.pkg.size]}
                      </span>
                    </span>
                    {build.pkg.truncated && <span>Trimmed to fit</span>}
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {expanded ? "Hide included" : "Included"}
                  </button>

                  {expanded && (
                    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                      {INCLUDED_ROWS.map((row) => {
                        const has = row.kinds.some((k) => includedMap.has(k));
                        return (
                          <li
                            key={row.label}
                            className="flex items-center gap-1.5 text-[11px]"
                          >
                            {has ? (
                              <Check className="h-3 w-3 text-primary" />
                            ) : (
                              <span className="h-3 w-3 rounded-full border border-border" />
                            )}
                            <span
                              className={
                                has ? "text-foreground" : "text-muted-foreground/70"
                              }
                            >
                              {row.label}
                              {!has && (
                                <span className="ml-1 text-muted-foreground/60">
                                  · not available
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/60 bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg px-3 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={pending || build.loading || !build.pkg || !!build.error}
            className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-primary text-primary-foreground px-3.5 text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUpRight className="h-3.5 w-3.5" />
            )}
            Continue
          </button>
        </footer>
      </div>
    </div>
  );
}

function HistoryList({
  history,
  onReopen,
  onClose,
}: {
  history: ContinueHistoryEntry[];
  onReopen: (entry: ContinueHistoryEntry) => void;
  onClose: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
        No recent transfers yet.
        <div className="mt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-primary hover:underline"
          >
            Back
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="px-2 py-2 max-h-72 overflow-y-auto scroll-thin">
      <button
        type="button"
        onClick={onClose}
        className="w-full text-left px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>
      <ul className="mt-1 space-y-0.5">
        {history.map((e) => {
          const targetName =
            CONTINUATION_PROVIDERS.find((p) => p.id === e.to)?.name ?? e.to;
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onReopen(e)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50 focus:outline-none"
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-foreground truncate">
                    {e.from} → {targetName}
                  </span>
                  <span className="block text-[10px] text-muted-foreground truncate">
                    {e.conversationTitle}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {relativeTime(e.at)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
