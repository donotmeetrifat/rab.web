import { memo, useMemo } from "react";
import { CalendarDays, X, ArrowUpDown, Filter } from "lucide-react";
import { PROVIDERS } from "@/lib/providers";
import type { ProviderId } from "@/types";
import type { ConvSort } from "@/services/conversations";

export interface ConvFiltersState {
  providers: ProviderId[];
  dateFrom: string; // yyyy-mm-dd (local) or ""
  dateTo: string;
  sort: ConvSort;
}

export const emptyConvFilters: ConvFiltersState = {
  providers: [],
  dateFrom: "",
  dateTo: "",
  sort: "newest",
};

export function toEpochRange(state: ConvFiltersState): {
  dateFrom: number | null;
  dateTo: number | null;
} {
  const from = state.dateFrom ? new Date(`${state.dateFrom}T00:00:00`).getTime() : null;
  const to = state.dateTo ? new Date(`${state.dateTo}T23:59:59.999`).getTime() : null;
  return {
    dateFrom: Number.isFinite(from as number) ? from : null,
    dateTo: Number.isFinite(to as number) ? to : null,
  };
}

const SORTS: { id: ConvSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "alphabetical", label: "A → Z" },
];

export const ConversationFilters = memo(function ConversationFilters({
  value,
  onChange,
  variant = "full",
}: {
  value: ConvFiltersState;
  onChange: (next: ConvFiltersState) => void;
  variant?: "full" | "compact";
}) {
  const activeCount = useMemo(
    () =>
      value.providers.length +
      (value.dateFrom ? 1 : 0) +
      (value.dateTo ? 1 : 0) +
      (value.sort !== "newest" ? 1 : 0),
    [value],
  );

  const toggleProvider = (id: ProviderId) => {
    const set = new Set(value.providers);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...value, providers: Array.from(set) });
  };

  const reset = () => onChange(emptyConvFilters);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 overflow-x-auto scroll-thin -mx-0.5 px-0.5 pb-0.5">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0"
          aria-hidden
        >
          <Filter className="h-3 w-3" />
          Providers
        </span>
        {PROVIDERS.map((p) => {
          const active = value.providers.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleProvider(p.id)}
              aria-pressed={active}
              className={
                "shrink-0 inline-flex items-center gap-1 rounded-full border px-2 h-6 text-[11px] font-medium transition-colors " +
                (active
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground hover:border-primary/30")
              }
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: p.color }}
                aria-hidden
              />
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ArrowUpDown className="h-3 w-3" aria-hidden />
          <span className="sr-only">Sort by</span>
          <select
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as ConvSort })}
            className="h-7 rounded-md border border-border bg-surface px-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {variant === "full" && (
          <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" aria-hidden />
            <span className="sr-only">From</span>
            <input
              type="date"
              value={value.dateFrom}
              max={value.dateTo || undefined}
              onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
              className="h-7 rounded-md border border-border bg-surface px-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
            <span aria-hidden>→</span>
            <span className="sr-only">To</span>
            <input
              type="date"
              value={value.dateTo}
              min={value.dateFrom || undefined}
              onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
              className="h-7 rounded-md border border-border bg-surface px-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
        )}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1 rounded-md h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-3 w-3" />
            Clear {activeCount}
          </button>
        )}
      </div>
    </div>
  );
});
