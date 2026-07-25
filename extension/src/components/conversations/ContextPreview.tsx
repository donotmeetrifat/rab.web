import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import type { ContextPackage } from "@/context";
import type { ContinuationProviderId } from "@/lib/continuation";

interface Props {
  open: boolean;
  target: ContinuationProviderId;
  targetName: string;
  loading: boolean;
  pkg: ContextPackage | null;
  onCancel: () => void;
  onContinue: () => void;
  error?: string | null;
}

const SIZE_LABEL: Record<ContextPackage["size"], string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  full: "Full",
};

/**
 * ContextPreview — the "one clean preview" surface between click and
 * launch. Beginners see the bulleted summary; power users can expand
 * to inspect every included item. Quality score is intentionally not
 * rendered.
 */
export function ContextPreview({
  open,
  target,
  targetName,
  loading,
  pkg,
  onCancel,
  onContinue,
  error,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && !loading && pkg) onContinue();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, pkg, onCancel, onContinue]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={`Continue with ${targetName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-[92%] max-w-sm rounded-2xl bg-surface border border-border shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Continue with
            </p>
            <p className="text-sm font-semibold text-foreground">{targetName}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-4 py-3 min-h-[120px]">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Preparing context…
            </div>
          )}

          {!loading && error && (
            <p className="text-xs text-destructive py-2">{error}</p>
          )}

          {!loading && !error && pkg && (
            <>
              <p className="text-[11px] font-semibold text-foreground/80 mb-1.5">Using</p>
              <ul className="space-y-1">
                {pkg.summary.map((line) => (
                  <li key={line} className="flex items-start gap-1.5 text-xs text-foreground">
                    <span className="text-primary mt-0.5">✓</span>
                    <span className="truncate">{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Estimated size:{" "}
                  <span className="text-foreground font-medium">{SIZE_LABEL[pkg.size]}</span>
                </span>
                {pkg.truncated && <span title="Older items trimmed to fit">Trimmed to fit</span>}
              </div>

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {expanded ? "Hide details" : "Inspect included items"}
              </button>

              {expanded && (
                <div className="mt-2 max-h-48 overflow-y-auto scroll-thin rounded-lg border border-border/60 bg-muted/40 p-2 space-y-1">
                  {pkg.items.map((it) => (
                    <div key={it.id} className="text-[11px] flex items-center gap-2">
                      <span className="uppercase text-[9px] text-muted-foreground w-16 shrink-0 tracking-wide">
                        {it.kind.replace("-", " ")}
                      </span>
                      <span className="truncate text-foreground/90">{it.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/60 bg-muted/30">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-lg px-3 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={loading || !pkg}
            className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-primary text-primary-foreground px-3 text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </footer>
      </div>
      <span className="sr-only">Target provider: {target}</span>
    </div>
  );
}
