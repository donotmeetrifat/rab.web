import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  MessagesSquare,
  StickyNote,
  Folder,
  CornerDownLeft,
  Loader2,
  X,
} from "lucide-react";
import { Highlight } from "@/components/Highlight";
import { Empty } from "@/components/Empty";
import { useDebounced } from "@/hooks/useDebounced";
import { listMemories } from "@/services/memories";
import { searchConversations } from "@/services/conversations";
import { providerMeta } from "@/lib/providers";
import { useMemlace } from "@/store/useMemlace";
import type { Memory, Project, StoredConversation } from "@/types";

type Kind = "conversation" | "memory" | "project";

export interface CommandItem {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  snippet?: string;
  providerColor?: string;
  providerName?: string;
  url?: string | null;
  raw: StoredConversation | Memory | Project;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user chooses to open the workspace (sidepanel). */
  onOpenWorkspace?: () => void;
}

const GROUP_LIMIT = 5;

/**
 * Universal command palette. Local-first, searches memories, conversations,
 * and projects with instant results and keyboard navigation.
 */
export function CommandPalette({ open, onOpenChange, onOpenWorkspace }: Props) {
  const projects = useMemlace((s) => s.projects);

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 120);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [convSnippets, setConvSnippets] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /* ---------- data loading ---------- */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [mem, hits] = await Promise.all([
        listMemories({ view: "recent" }, "newest"),
        searchConversations({ query: debounced, sort: "newest" }),
      ]);
      if (cancelled) return;
      setMemories(mem);
      setConversations(hits.map((h) => h.conversation));
      const snip = new Map<string, string | null>();
      for (const h of hits) snip.set(h.conversation.id, h.snippet?.text ?? null);
      setConvSnippets(snip);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  /* ---------- filter + group ---------- */
  const items = useMemo<CommandItem[]>(() => {
    const q = debounced.trim().toLowerCase();

    const memMatches: CommandItem[] = memories
      .filter((m) => {
        if (!q) return true;
        return (
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .slice(0, GROUP_LIMIT)
      .map<CommandItem>((m) => {
        const meta = providerMeta(m.provider);
        return {
          id: `mem:${m.id}`,
          kind: "memory",
          title: m.title || "Untitled",
          subtitle: m.tags.slice(0, 3).join(" · ") || undefined,
          snippet: q ? extractSnippet(m.content, q) : m.content.slice(0, 100),
          providerColor: meta?.color,
          providerName: meta?.name,
          raw: m,
        };
      });

    const projMatches: CommandItem[] = projects
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .slice(0, GROUP_LIMIT)
      .map<CommandItem>((p) => ({
        id: `prj:${p.id}`,
        kind: "project",
        title: p.name,
        subtitle: p.pinned ? "Pinned" : undefined,
        providerColor: p.color,
        raw: p,
      }));

    const convMatches: CommandItem[] = conversations
      .slice(0, GROUP_LIMIT)
      .map<CommandItem>((c) => {
        const meta = providerMeta(c.provider);
        return {
          id: `cnv:${c.id}`,
          kind: "conversation",
          title: c.title,
          subtitle: meta?.name ?? c.provider,
          snippet: convSnippets.get(c.id) ?? undefined,
          providerColor: meta?.color,
          providerName: meta?.name,
          url: c.url,
          raw: c,
        };
      });

    // Order: Conversations, Memories, Projects.
    return [...convMatches, ...memMatches, ...projMatches];
  }, [memories, projects, conversations, convSnippets, debounced]);

  const grouped = useMemo(() => {
    const g: Record<Kind, CommandItem[]> = { conversation: [], memory: [], project: [] };
    for (const it of items) g[it.kind].push(it);
    return g;
  }, [items]);

  useEffect(() => {
    setCursor(0);
  }, [debounced, items.length]);

  /* ---------- selection ---------- */
  const activate = useCallback(
    (item: CommandItem) => {
      onOpenChange(false);
      if (item.kind === "conversation") {
        const conv = item.raw as StoredConversation;
        if (conv.url) {
          chrome.tabs?.create?.({ url: conv.url });
          return;
        }
      }
      // Memory / project / conversation with no URL — open workspace.
      onOpenWorkspace?.();
    },
    [onOpenChange, onOpenWorkspace],
  );

  /* ---------- keyboard nav ---------- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(items.length - 1, c + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCursor(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCursor(items.length - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = items[cursor];
        if (chosen) activate(chosen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, cursor, activate, onOpenChange]);

  // Scroll active item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Universal search"
      className="fixed inset-0 z-[2000] flex items-start justify-center pt-[8vh] px-4"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="relative w-full max-w-[540px] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-scale-in">
        {/* Search field */}
        <div className="flex items-center gap-2 border-b border-border px-3.5 h-12">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories, chats, projects…"
            aria-label="Universal search"
            aria-controls="cmdk-results"
            aria-activedescendant={items[cursor]?.id}
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none"
          />
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close search"
            className="ml-1 h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Results */}
        <ul
          id="cmdk-results"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="max-h-[52vh] overflow-y-auto scroll-thin py-1"
        >
          {items.length === 0 ? (
            <li className="p-5">
              <Empty
                icon={<Search className="h-5 w-5" />}
                title={debounced ? "No matches" : "Start typing to search"}
                description={
                  debounced
                    ? "Try a different keyword — search runs across memories, chats, and projects."
                    : "Instant search across everything Memlace has captured, locally."
                }
              />
            </li>
          ) : (
            (["conversation", "memory", "project"] as Kind[]).map((kind) => {
              const group = grouped[kind];
              if (group.length === 0) return null;
              return (
                <li key={kind} role="presentation">
                  <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {GROUP_LABEL[kind]}
                  </div>
                  <ul role="group">
                    {group.map((item) => {
                      const idx = items.indexOf(item);
                      const active = idx === cursor;
                      return (
                        <li
                          key={item.id}
                          id={item.id}
                          data-idx={idx}
                          role="option"
                          aria-selected={active}
                          onMouseMove={() => setCursor(idx)}
                          onClick={() => activate(item)}
                          className={
                            "mx-1.5 flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors " +
                            (active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted")
                          }
                        >
                          <KindIcon kind={item.kind} color={item.providerColor} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] font-medium text-foreground">
                                <Highlight text={item.title} query={debounced} />
                              </span>
                              {item.providerName && item.kind === "conversation" && (
                                <span
                                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
                                  style={{ background: item.providerColor ?? "#6B7280" }}
                                >
                                  {item.providerName}
                                </span>
                              )}
                            </div>
                            {(item.snippet || item.subtitle) && (
                              <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                                {item.snippet ? (
                                  <Highlight text={item.snippet} query={debounced} />
                                ) : (
                                  item.subtitle
                                )}
                              </div>
                            )}
                          </div>
                          {active && (
                            <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-background/70 px-3 py-1.5 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>navigate</span>
            <Kbd>↵</Kbd>
            <span>open</span>
            <Kbd>Esc</Kbd>
            <span>close</span>
          </span>
          <span>Local · Private</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

const GROUP_LABEL: Record<Kind, string> = {
  conversation: "Conversations",
  memory: "Memories",
  project: "Projects",
};

function KindIcon({ kind, color }: { kind: Kind; color?: string }) {
  const dot = color ?? "var(--color-primary, #2563EB)";
  const base = "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md";
  if (kind === "conversation") {
    return (
      <span className={base} style={{ background: `${dot}20`, color: dot }}>
        <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (kind === "memory") {
    return (
      <span className={base} style={{ background: `${dot}20`, color: dot }}>
        <StickyNote className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span className={base} style={{ background: `${dot}20`, color: dot }}>
      <Folder className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-surface px-1 font-sans text-[10px] text-foreground/80">
      {children}
    </kbd>
  );
}

function extractSnippet(source: string, q: string): string {
  const lower = source.toLowerCase();
  const at = lower.indexOf(q);
  if (at < 0) return source.slice(0, 120);
  const radius = 50;
  const start = Math.max(0, at - radius);
  const end = Math.min(source.length, at + q.length + radius);
  const body = source.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "… " : ""}${body}${end < source.length ? " …" : ""}`;
}
