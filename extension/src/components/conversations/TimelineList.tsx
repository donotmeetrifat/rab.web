import { memo, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { StoredConversation } from "@/types";
import type { ConvSnippet } from "@/services/conversations";
import { ConversationCard } from "./ConversationCard";
import { ConversationEmptyState } from "./ConversationEmptyState";
import { MemoryListSkeleton } from "@/components/Skeleton";
import { buildTimeline, type TimelineBucket } from "@/services/timeline";
import type { ReactNode } from "react";

/**
 * TimelineList — renders conversations as continuous memory, grouped
 * into Today / Yesterday / This Week / This Month / Earlier, with
 * clusters of closely-related saves surfaced as expandable "sessions".
 *
 * Prop shape matches ConversationList so callers can swap freely. When
 * a search query is active the caller should keep using ConversationList
 * (flat, ranked by relevance) — timeline is the default browse view.
 */
export function TimelineList({
  conversations,
  loading,
  activeId,
  onOpen,
  onDelete,
  compact = false,
  emptyAction,
  query,
  snippets,
}: {
  conversations: StoredConversation[];
  loading?: boolean;
  activeId?: string | null;
  onOpen?: (c: StoredConversation) => void;
  onDelete?: (c: StoredConversation) => void;
  compact?: boolean;
  emptyAction?: ReactNode;
  query?: string;
  snippets?: Map<string, ConvSnippet | null>;
}) {
  const [buckets, setBuckets] = useState<TimelineBucket[]>([]);
  const [built, setBuilt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void buildTimeline(conversations).then((b) => {
      if (!cancelled) {
        setBuckets(b);
        setBuilt(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [conversations]);

  if (loading && conversations.length === 0) {
    return <MemoryListSkeleton rows={compact ? 3 : 5} />;
  }
  if (conversations.length === 0) {
    return <ConversationEmptyState query={query} action={emptyAction} />;
  }
  if (!built) {
    return <MemoryListSkeleton rows={compact ? 3 : 5} />;
  }

  return (
    <div className="space-y-4">
      {buckets.map((b) => (
        <Bucket
          key={b.id}
          bucket={b}
          activeId={activeId}
          onOpen={onOpen}
          onDelete={onDelete}
          compact={compact}
          query={query}
          snippets={snippets}
        />
      ))}
    </div>
  );
}

const Bucket = memo(function Bucket({
  bucket,
  activeId,
  onOpen,
  onDelete,
  compact,
  query,
  snippets,
}: {
  bucket: TimelineBucket;
  activeId?: string | null;
  onOpen?: (c: StoredConversation) => void;
  onDelete?: (c: StoredConversation) => void;
  compact?: boolean;
  query?: string;
  snippets?: Map<string, ConvSnippet | null>;
}) {
  return (
    <section aria-label={bucket.label}>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {bucket.label}
        <span className="ml-1.5 font-normal opacity-70 tabular-nums">
          {bucket.count}
        </span>
      </h3>
      <div className="space-y-2">
        {bucket.sessions.map((s) =>
          s.conversations.length >= 2 ? (
            <Session
              key={s.id}
              session={s}
              activeId={activeId}
              onOpen={onOpen}
              onDelete={onDelete}
              compact={compact}
              query={query}
              snippets={snippets}
            />
          ) : (
            <ul key={s.id} className="space-y-1.5" role="list">
              <ConversationCard
                conversation={s.conversations[0]}
                active={activeId === s.conversations[0].id}
                onOpen={onOpen}
                onDelete={onDelete}
                compact={compact}
                query={query}
                snippet={snippets?.get(s.conversations[0].id) ?? null}
              />
            </ul>
          ),
        )}
      </div>
    </section>
  );
});

function Session({
  session,
  activeId,
  onOpen,
  onDelete,
  compact,
  query,
  snippets,
}: {
  session: import("@/services/timeline").MemorySession;
  activeId?: string | null;
  onOpen?: (c: StoredConversation) => void;
  onDelete?: (c: StoredConversation) => void;
  compact?: boolean;
  query?: string;
  snippets?: Map<string, ConvSnippet | null>;
}) {
  const [open, setOpen] = useState(true);
  const providers = useMemo(() => {
    const set = new Set<string>();
    for (const c of session.conversations) set.add(c.provider);
    return set.size;
  }, [session]);
  const timeRange = useMemo(() => formatRange(session.startedAt, session.endedAt), [
    session.startedAt,
    session.endedAt,
  ]);

  return (
    <div className="rounded-lg border border-border/70 bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg"
      >
        <ChevronRight
          className={"h-3 w-3 transition-transform " + (open ? "rotate-90" : "")}
          aria-hidden
        />
        <span className="font-medium text-foreground/80">{session.label}</span>
        <span className="opacity-70">· {timeRange}</span>
        <span className="ml-auto tabular-nums">
          {session.conversations.length} chats
          {providers > 1 && ` · ${providers} AIs`}
        </span>
      </button>
      {open && (
        <ul className="space-y-1.5 px-1.5 pb-1.5" role="list">
          {session.conversations.map((c) => (
            <ConversationCard
              key={c.id}
              conversation={c}
              active={activeId === c.id}
              onOpen={onOpen}
              onDelete={onDelete}
              compact={compact}
              query={query}
              snippet={snippets?.get(c.id) ?? null}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function formatRange(startedAt: number, endedAt: number): string {
  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const a = fmt(startedAt);
  const b = fmt(endedAt);
  return a === b ? a : `${a} – ${b}`;
}
