import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Settings2,
  PanelRight,
  Plus,
  Sparkles,
  Pin,
  FolderOpen,
  Keyboard,
  MessagesSquare,
  StickyNote,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { MemoryRow } from "@/components/MemoryRow";
import { MemoryListSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useMemlace } from "@/store/useMemlace";
import { useActiveTab } from "@/hooks/useActiveTab";
import { useThemeSync } from "@/hooks/useThemeSync";
import { providerMeta } from "@/lib/providers";
import { listMemories } from "@/services/memories";
import { listConversations, deleteConversation } from "@/services/conversations";
import { ConversationList } from "@/components/conversations/ConversationList";
import { ConversationSearch } from "@/components/conversations/ConversationSearch";
import type { Memory, StoredConversation } from "@/types";

const PENDING_KEY = "memlace.pendingCapture";
type Tab = "memories" | "conversations";

export function PopupApp() {
  useThemeSync();
  const toast = useToast();

  const bootstrap = useMemlace((s) => s.bootstrap);
  const ready = useMemlace((s) => s.ready);
  const projects = useMemlace((s) => s.projects);
  const addMemory = useMemlace((s) => s.addMemory);
  const toggleFavorite = useMemlace((s) => s.toggleFavorite);
  const togglePinMemory = useMemlace((s) => s.togglePinMemory);
  const trashMemory = useMemlace((s) => s.trashMemory);

  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<Memory[]>([]);
  const [recent, setRecent] = useState<Memory[]>([]);
  const [pending, setPending] = useState<{ text: string; url: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const active = useActiveTab();
  const provider = providerMeta(active.provider);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const loadLists = useCallback(async () => {
    setBusy(true);
    try {
      const [fav, all] = await Promise.all([
        listMemories({ view: "favorites" }, "newest"),
        listMemories({ view: "recent" }, "newest"),
      ]);
      setPinned(fav.slice(0, 3));
      setRecent(all.slice(0, 8));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadLists();
  }, [ready, loadLists, projects.length]);

  useEffect(() => {
    chrome.storage.local.get(PENDING_KEY).then((v) => {
      const p = v[PENDING_KEY] as typeof pending | undefined;
      if (p && p.text) setPending(p);
    });
    const onChange = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: chrome.storage.AreaName,
    ) => {
      if (area !== "local" || !changes[PENDING_KEY]) return;
      const next = changes[PENDING_KEY].newValue as typeof pending | undefined;
      setPending(next?.text ? next : null);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return recent;
    return recent.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [recent, query]);

  const openSidePanel = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
      }
    } catch (err) {
      toast.error("Could not open side panel", err instanceof Error ? err.message : undefined);
    }
  };

  const openOptions = () => chrome.runtime?.openOptionsPage?.();

  const savePendingCapture = async () => {
    if (!pending) return;
    try {
      const title = pending.title?.slice(0, 80) || pending.text.slice(0, 60);
      await addMemory({
        title,
        content: pending.text,
        provider: active.provider,
        sourceUrl: pending.url || null,
      });
      await chrome.storage.local.remove(PENDING_KEY);
      setPending(null);
      toast.success("Memory saved", "Available across popup and side panel.");
      void loadLists();
    } catch (err) {
      toast.error("Save failed", err instanceof Error ? err.message : undefined);
    }
  };

  const dismissPending = async () => {
    await chrome.storage.local.remove(PENDING_KEY);
    setPending(null);
  };

  const captureFromPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString().trim() ?? "",
      });
      const text = results[0]?.result ?? "";
      if (!text) {
        toast.info("Nothing selected", "Highlight text on the page first.");
        return;
      }
      await addMemory({
        title: (tab.title ?? "Captured note").slice(0, 80),
        content: text,
        provider: active.provider,
        sourceUrl: tab.url ?? null,
      });
      toast.success("Memory saved");
      void loadLists();
    } catch (err) {
      toast.error("Capture failed", err instanceof Error ? err.message : undefined);
    }
  };

  const pinnedProjects = projects.filter((p) => p.pinned).slice(0, 4);
  const recentProjects = projects.filter((p) => !p.pinned).slice(0, 4);

  return (
    <div className="flex h-[560px] w-[380px] flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Logo size={22} />
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-tight">Memlace</span>
          <span className="text-[10px] text-muted-foreground">
            {provider ? `On ${provider.name}` : "Local · Private"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={openSidePanel}
            aria-label="Open side panel"
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <PanelRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={openOptions}
            aria-label="Open settings"
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="px-3 pt-2.5">
        <label className="relative block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            type="search"
            placeholder="Search memories, projects, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search memories"
            className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-surface border border-border text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          />
        </label>
      </div>

      {pending && (
        <div className="mx-3 mt-2.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5 animate-fade-in">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> New capture ready
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{pending.text}</p>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" variant="primary" onClick={savePendingCapture}>Save memory</Button>
            <Button size="sm" variant="ghost" onClick={dismissPending}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-thin px-3 py-2.5 space-y-4">
        {(pinnedProjects.length + recentProjects.length > 0) && (
          <section aria-labelledby="popup-projects">
            <div className="flex items-center justify-between mb-1.5">
              <h3 id="popup-projects" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Projects
              </h3>
              <button
                type="button"
                onClick={openSidePanel}
                className="text-[11px] text-primary hover:underline"
              >
                View all
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-1.5">
              {[...pinnedProjects, ...recentProjects].slice(0, 4).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={openSidePanel}
                    className="w-full flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs hover:border-primary/40 text-left"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="truncate flex-1">{p.name}</span>
                    {p.pinned && <Pin className="h-3 w-3 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pinned.length > 0 && (
          <section aria-labelledby="popup-pinned">
            <h3 id="popup-pinned" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Favorites
            </h3>
            <ul className="space-y-1.5">
              {pinned.map((m) => (
                <MemoryRow
                  key={m.id}
                  memory={m}
                  onToggleFavorite={toggleFavorite}
                  onTogglePin={togglePinMemory}
                  onTrash={trashMemory}
                />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="popup-recent">
          <div className="flex items-center justify-between mb-1.5">
            <h3 id="popup-recent" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {query ? "Results" : "Recent"}
            </h3>
            <Button size="sm" variant="ghost" onClick={captureFromPage}>
              <Plus className="h-3 w-3" />
              Capture
            </Button>
          </div>
          {busy && !recent.length ? (
            <MemoryListSkeleton rows={4} />
          ) : filtered.length === 0 ? (
            <Empty
              icon={<FolderOpen className="h-5 w-5" />}
              title={query ? "No matches" : "No memories yet."}
              description={
                query
                  ? "Try a different search term or open the workspace."
                  : "Select text on any AI page and press Alt+Shift+S — or right-click to save."
              }
              action={
                !query && (
                  <Button size="sm" variant="primary" onClick={openSidePanel}>
                    Open workspace
                  </Button>
                )
              }
            />
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((m) => (
                <MemoryRow
                  key={m.id}
                  memory={m}
                  onToggleFavorite={toggleFavorite}
                  onTogglePin={togglePinMemory}
                  onTrash={trashMemory}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Keyboard className="h-3 w-3" />
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Alt+Shift+S</kbd>
          capture
        </span>
        <span>Local · Private</span>
      </footer>
    </div>
  );
}
