import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Code2,
  Sparkles,
  Link2,
  Hash,
  Layers,
  RefreshCw,
  Search,
  FileCode2,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { Highlight } from "@/components/Highlight";
import { providerMeta } from "@/lib/providers";
import {
  buildAggregate,
  listKnowledge,
  searchKnowledge,
  findRelatedConversations,
  backfillKnowledge,
  type KnowledgeAggregate,
  type KnowledgeRecord,
  type KnowledgeSearchHit,
} from "@/knowledge";
import { useDebounced } from "@/hooks/useDebounced";
import { useToast } from "@/components/Toast";

export function KnowledgePanel({
  onOpenConversation,
}: {
  onOpenConversation?: (conversationId: string) => void;
}) {
  const toast = useToast();
  const [aggregate, setAggregate] = useState<KnowledgeAggregate | null>(null);
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([]);
  const [selected, setSelected] = useState<KnowledgeRecord | null>(null);
  const [related, setRelated] = useState<
    { record: KnowledgeRecord; sharedTechnologies: string[]; score: number }[]
  >([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const debounced = useDebounced(query, 160);

  const refresh = async () => {
    setLoading(true);
    try {
      const [agg, rows] = await Promise.all([buildAggregate(), listKnowledge()]);
      setAggregate(agg);
      setRecords(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await searchKnowledge(debounced);
      if (!cancelled) setHits(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, records.length]);

  useEffect(() => {
    if (!selected) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    findRelatedConversations(selected.id).then((r) => {
      if (!cancelled) setRelated(r);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const displayed = useMemo(() => hits.map((h) => h.record), [hits]);
  const hitMeta = useMemo(() => {
    const map = new Map<string, KnowledgeSearchHit>();
    for (const h of hits) map.set(h.record.id, h);
    return map;
  }, [hits]);

  const runReindex = async () => {
    setReindexing(true);
    try {
      const { scanned, indexed } = await backfillKnowledge();
      toast.success(
        "Knowledge refreshed",
        `${indexed} of ${scanned} conversation${scanned === 1 ? "" : "s"} re-indexed.`,
      );
      await refresh();
    } catch (err) {
      toast.error("Re-index failed", err instanceof Error ? err.message : undefined);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Brain className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Knowledge</h1>
        <span className="ml-2 text-[10px] text-muted-foreground">
          {aggregate ? `${aggregate.totalConversations} indexed` : "Loading…"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={runReindex} disabled={reindexing}>
            <RefreshCw className={"h-3.5 w-3.5 " + (reindexing ? "animate-spin" : "")} />
            {reindexing ? "Indexing…" : "Re-index"}
          </Button>
        </div>
      </header>

      <div className="px-4 pt-3">
        <label className="relative block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search technologies, keywords, code…"
            aria-label="Search knowledge"
            className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-surface border border-border text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          />
        </label>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="overflow-y-auto scroll-thin px-4 py-3 space-y-4">
          {aggregate && !debounced && (
            <StatsGrid aggregate={aggregate} />
          )}
          {aggregate && !debounced && (
            <FacetSection aggregate={aggregate} />
          )}
          <section aria-labelledby="kn-list">
            <h3
              id="kn-list"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2"
            >
              {debounced ? `Results (${displayed.length})` : "All conversations"}
            </h3>
            {loading ? (
              <p className="text-xs text-muted-foreground">Building knowledge…</p>
            ) : displayed.length === 0 ? (
              <Empty
                icon={<Sparkles className="h-5 w-5" />}
                title={debounced ? "No knowledge matches." : "No knowledge yet."}
                description={
                  debounced
                    ? "Try a technology, framework, or keyword."
                    : "Save a conversation and Memlace will index it here automatically."
                }
              />
            ) : (
              <ul className="space-y-2">
                {displayed.map((r) => (
                  <li key={r.id}>
                    <KnowledgeRow
                      record={r}
                      query={debounced}
                      hit={hitMeta.get(r.id)}
                      active={selected?.id === r.id}
                      onSelect={() => setSelected(r)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="hidden md:flex flex-col border-l border-border bg-surface min-w-0">
          {selected ? (
            <KnowledgeDetail
              record={selected}
              related={related}
              onOpenConversation={onOpenConversation}
              onSelectRelated={(r) => setSelected(r)}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-xs text-muted-foreground px-6 text-center">
              Select a conversation to inspect its extracted knowledge.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatsGrid({ aggregate }: { aggregate: KnowledgeAggregate }) {
  const cards = [
    { label: "Conversations", value: aggregate.totalConversations, icon: Layers },
    { label: "Code blocks", value: aggregate.totalCodeBlocks, icon: Code2 },
    { label: "Links", value: aggregate.totalLinks, icon: Link2 },
    { label: "Words", value: aggregate.totalWords.toLocaleString(), icon: FileCode2 },
  ];
  return (
    <section aria-label="Knowledge overview" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-lg border border-border bg-surface p-3 flex items-start gap-2"
          >
            <Icon className="h-4 w-4 text-primary mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {c.label}
              </div>
              <div className="text-lg font-semibold tabular-nums">{c.value}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function FacetSection({ aggregate }: { aggregate: KnowledgeAggregate }) {
  const groups: { title: string; items: { name: string; count: number }[] }[] = [
    { title: "Technologies", items: aggregate.technologies.slice(0, 12) },
    { title: "Languages", items: aggregate.languages.slice(0, 10) },
    { title: "Frameworks", items: aggregate.frameworks.slice(0, 10) },
    { title: "Topics", items: aggregate.topics.slice(0, 10) },
  ];
  return (
    <section aria-label="Knowledge facets" className="space-y-3">
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <div key={g.title}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              {g.title}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {g.items.map((it) => (
                <li
                  key={it.name}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]"
                >
                  <span>{it.name}</span>
                  <span className="text-muted-foreground tabular-nums">{it.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
      {aggregate.topKeywords.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Top keywords
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {aggregate.topKeywords.slice(0, 18).map((k) => (
              <li
                key={k.term}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Hash className="h-2.5 w-2.5" />
                {k.term}
                <span className="tabular-nums">{k.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function KnowledgeRow({
  record,
  query,
  hit,
  active,
  onSelect,
}: {
  record: KnowledgeRecord;
  query: string;
  hit: KnowledgeSearchHit | undefined;
  active: boolean;
  onSelect: () => void;
}) {
  const provider = providerMeta(record.provider);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={
        "w-full text-left rounded-lg border p-3 transition-colors " +
        (active
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-surface hover:border-primary/30")
      }
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ background: provider?.color ?? "#94a3b8" }}
          aria-hidden
        />
        <h4 className="text-sm font-medium truncate flex-1">
          <Highlight text={record.title} query={query} />
        </h4>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {record.stats.messageCount} msg · {record.stats.codeBlockCount} code
        </span>
      </div>
      {record.technologies.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {record.technologies.slice(0, 8).map((t) => (
            <li
              key={t}
              className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px]"
            >
              <Highlight text={t} query={query} />
            </li>
          ))}
          {record.technologies.length > 8 && (
            <li className="text-[10px] text-muted-foreground">
              +{record.technologies.length - 8}
            </li>
          )}
        </ul>
      )}
      {hit && hit.matchedIn.length > 0 && (
        <div className="mt-1.5 text-[10px] text-primary/80">
          Matched in: {hit.matchedIn.join(", ")}
        </div>
      )}
    </button>
  );
}

function KnowledgeDetail({
  record,
  related,
  onOpenConversation,
  onSelectRelated,
}: {
  record: KnowledgeRecord;
  related: { record: KnowledgeRecord; sharedTechnologies: string[]; score: number }[];
  onOpenConversation?: (id: string) => void;
  onSelectRelated: (r: KnowledgeRecord) => void;
}) {
  const provider = providerMeta(record.provider);
  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: provider?.color ?? "#94a3b8" }}
          />
          {provider?.name ?? record.provider}
        </div>
        <h2 className="text-sm font-semibold leading-snug">{record.title}</h2>
        {onOpenConversation && (
          <button
            type="button"
            onClick={() => onOpenConversation(record.conversationId)}
            className="text-[11px] text-primary hover:underline"
          >
            Open conversation →
          </button>
        )}
      </header>

      <section className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Messages" value={record.stats.messageCount} />
        <Metric label="Reading" value={`${record.stats.readingMinutes} min`} />
        <Metric label="Words" value={record.stats.wordCount.toLocaleString()} />
        <Metric label="Code blocks" value={record.stats.codeBlockCount} />
        <Metric label="Links" value={record.stats.linkCount} />
        <Metric label="Attachments" value={record.stats.attachmentCount} />
      </section>

      {record.entityDetails.length > 0 && (
        <DetailList
          title="Entities"
          items={record.entityDetails.map((e) => ({
            label: `${e.name}`,
            hint: e.type,
            count: e.count,
          }))}
        />
      )}
      {record.keywordDetails.length > 0 && (
        <DetailList
          title="Top keywords"
          items={record.keywordDetails.slice(0, 20).map((k) => ({
            label: k.term,
            count: k.count,
          }))}
        />
      )}

      {record.codeBlocks.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Code snippets ({record.codeBlocks.length})
          </h3>
          <ul className="space-y-1.5">
            {record.codeBlocks.slice(0, 8).map((cb) => (
              <li
                key={cb.order}
                className="rounded-md border border-border bg-muted/40 p-2 text-[11px] font-mono"
              >
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                  <Code2 className="h-3 w-3" />
                  <span>{cb.language ?? "text"}</span>
                  {cb.filename && <span className="truncate">· {cb.filename}</span>}
                  <span className="ml-auto tabular-nums">{cb.lineCount} lines</span>
                </div>
                <div className="truncate">{cb.preview || "(empty)"}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {record.links.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Links ({record.links.length})
          </h3>
          <ul className="space-y-1">
            {record.links.slice(0, 10).map((l) => (
              <li key={l.url} className="text-[11px] truncate">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {l.host}
                </a>
                <span className="ml-1 text-muted-foreground">· {l.kind}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Related conversations
          </h3>
          <ul className="space-y-1.5">
            {related.map((r) => (
              <li key={r.record.id}>
                <button
                  type="button"
                  onClick={() => onSelectRelated(r.record)}
                  className="w-full text-left rounded-md border border-border bg-surface p-2 hover:border-primary/30"
                >
                  <div className="text-xs font-medium truncate">{r.record.title}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
                    Shared: {r.sharedTechnologies.join(", ") || "topics"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function DetailList({
  title,
  items,
}: {
  title: string;
  items: { label: string; hint?: string; count?: number }[];
}) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li
            key={`${it.label}-${it.hint ?? ""}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]"
          >
            <span>{it.label}</span>
            {it.hint && <span className="text-muted-foreground">({it.hint})</span>}
            {typeof it.count === "number" && (
              <span className="text-muted-foreground tabular-nums">{it.count}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
