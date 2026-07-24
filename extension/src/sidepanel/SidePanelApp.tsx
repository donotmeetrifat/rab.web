import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Folder,
  Clock,
  Star,
  Trash2,
  Settings2,
  Pin,
  MoreHorizontal,
  Inbox,
  Filter,
  ArrowUpDown,
  Archive,
  X,
  Check,
  ChevronDown,
  MessagesSquare,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { MemoryRow } from "@/components/MemoryRow";
import { MemoryListSkeleton } from "@/components/Skeleton";
import { Dialog, useOutsideClick } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { useMemlace, type SidebarView } from "@/store/useMemlace";
import { useActiveTab } from "@/hooks/useActiveTab";
import { useThemeSync } from "@/hooks/useThemeSync";
import { providerMeta, PROVIDERS } from "@/lib/providers";
import { listTags } from "@/services/tags";
import { listConversations, deleteConversation } from "@/services/conversations";
import { ConversationList } from "@/components/conversations/ConversationList";
import { ConversationSearch } from "@/components/conversations/ConversationSearch";
import { ConversationDetail } from "@/components/conversations/ConversationDetail";
import type { Memory, Project, ProjectIcon, ProviderId, SortKey, StoredConversation, TagMeta } from "@/types";

const NAV: { id: SidebarView; label: string; icon: typeof Folder }[] = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "pinned", label: "Pinned", icon: Pin },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "archived", label: "Archived", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "alphabetical", label: "A → Z" },
  { id: "provider", label: "Provider" },
  { id: "pinned", label: "Pinned first" },
  { id: "favorites", label: "Favorites first" },
];

const PROJECT_COLORS = [
  "#2563EB", "#7C3AED", "#DB2777", "#DC2626", "#EA580C",
  "#CA8A04", "#16A34A", "#0EA5E9", "#0F766E", "#475569",
];

const PROJECT_ICONS: ProjectIcon[] = [
  "folder", "sparkles", "bookmark", "beaker", "brain",
  "code", "heart", "briefcase", "graduation", "rocket",
];

const PAGE_SIZE = 60;

export function SidePanelApp() {
  useThemeSync();
  const toast = useToast();

  const bootstrap = useMemlace((s) => s.bootstrap);
  const ready = useMemlace((s) => s.ready);
  const loading = useMemlace((s) => s.loading);
  const projects = useMemlace((s) => s.projects);
  const projectCounts = useMemlace((s) => s.projectCounts);
  const memories = useMemlace((s) => s.memories);
  const filters = useMemlace((s) => s.filters);
  const settings = useMemlace((s) => s.settings);
  const selection = useMemlace((s) => s.selection);

  const setView = useMemlace((s) => s.setView);
  const setFilters = useMemlace((s) => s.setFilters);
  const setSearch = useMemlace((s) => s.setSearch);
  const setSort = useMemlace((s) => s.setSort);
  const addProject = useMemlace((s) => s.addProject);
  const updateProjectAction = useMemlace((s) => s.updateProject);
  const addMemory = useMemlace((s) => s.addMemory);
  const editMemory = useMemlace((s) => s.editMemory);
  const duplicateMemory = useMemlace((s) => s.duplicateMemory);
  const moveMemories = useMemlace((s) => s.moveMemories);
  const togglePinProject = useMemlace((s) => s.togglePinProject);
  const toggleFavoriteProject = useMemlace((s) => s.toggleFavoriteProject);
  const deleteProject = useMemlace((s) => s.deleteProject);
  const toggleFavorite = useMemlace((s) => s.toggleFavorite);
  const togglePinMemory = useMemlace((s) => s.togglePinMemory);
  const trashMemory = useMemlace((s) => s.trashMemory);
  const restoreMemory = useMemlace((s) => s.restoreMemory);
  const archiveMemory = useMemlace((s) => s.archiveMemory);
  const unarchiveMemory = useMemlace((s) => s.unarchiveMemory);
  const deleteMemoryHard = useMemlace((s) => s.deleteMemoryHard);
  const bulkTrash = useMemlace((s) => s.bulkTrash);
  const bulkDeleteHard = useMemlace((s) => s.bulkDeleteHard);
  const emptyTrash = useMemlace((s) => s.emptyTrash);
  const toggleSelected = useMemlace((s) => s.toggleSelected);
  const selectMany = useMemlace((s) => s.selectMany);
  const clearSelection = useMemlace((s) => s.clearSelection);

  const active = useActiveTab();
  const provider = providerMeta(active.provider);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [projectMenuFor, setProjectMenuFor] = useState<string | null>(null);
  const [tags, setTags] = useState<TagMeta[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Dialogs
  const [projectDialog, setProjectDialog] = useState<null | { mode: "new" } | { mode: "edit"; project: Project }>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);

  // Conversations
  const [section, setSection] = useState<"memories" | "conversations">("memories");
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convQuery, setConvQuery] = useState("");
  const [selectedConv, setSelectedConv] = useState<StoredConversation | null>(null);

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const rows = await listConversations();
      setConversations(rows);
      setSelectedConv((prev) =>
        prev ? rows.find((r) => r.id === prev.id) ?? null : null,
      );
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadConversations();
  }, [ready, loadConversations]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!ready) return;
    void listTags().then(setTags);
  }, [ready, memories.length]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, settings.sort, memories.length]);

  const activeView = filters.view;
  const activeProject = projects.find((p) => p.id === filters.projectId) ?? null;

  const openOptions = () => chrome.runtime.openOptionsPage?.();

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
        toast.info("Nothing selected", "Highlight text on the AI page first.");
        return;
      }
      await addMemory({
        title: (tab.title ?? "Captured note").slice(0, 80),
        content: text,
        provider: active.provider,
        sourceUrl: tab.url ?? null,
        projectId: activeProject?.id ?? null,
      });
      toast.success("Memory saved");
    } catch (err) {
      toast.error("Capture failed", err instanceof Error ? err.message : undefined);
    }
  };

  const copyMemoryContent = async (id: string) => {
    const m = memories.find((x) => x.id === id);
    if (!m) return;
    try {
      await navigator.clipboard.writeText(m.content);
      toast.success("Copied to clipboard");
    } catch (err) {
      toast.error("Copy failed", err instanceof Error ? err.message : undefined);
    }
  };

  const doDuplicate = async (id: string) => {
    const m = await duplicateMemory(id);
    if (m) toast.success("Memory duplicated");
  };

  const doTrash = async (id: string) => {
    await trashMemory(id);
    toast.success("Moved to trash");
  };

  const doDeleteHard = async (id: string) => {
    if (!window.confirm("Permanently delete this memory?")) return;
    await deleteMemoryHard(id);
    toast.success("Memory deleted");
  };

  const headerTitle =
    activeView === "projects" && activeProject
      ? activeProject.name
      : NAV.find((n) => n.id === activeView)?.label ?? "Workspace";

  const visibleMemories = useMemo(() => memories.slice(0, visibleCount), [memories, visibleCount]);
  const selectedIds = useMemo(() => Array.from(selection), [selection]);
  const allSelected = selectedIds.length > 0 && selectedIds.length === memories.length;

  const toggleSelectAll = () => {
    if (allSelected) clearSelection();
    else selectMany(memories.map((m) => m.id));
  };

  return (
    <div className="grid h-dvh w-dvw grid-cols-[220px_1fr] bg-background text-foreground">
      <aside className="flex flex-col border-r border-border bg-surface min-w-0">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <Logo size={22} />
          <span className="text-[13px] font-semibold tracking-tight">Memlace</span>
          <button
            type="button"
            onClick={openOptions}
            aria-label="Settings"
            className="ml-auto h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        <nav className="p-2 space-y-0.5" aria-label="Primary">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              section === "memories" &&
              activeView === item.id &&
              (item.id !== "projects" || !filters.projectId);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection("memories");
                  setView(item.id);
                }}
                aria-current={isActive ? "page" : undefined}
                className={
                  "w-full flex items-center gap-2 px-2 h-8 rounded-md text-xs font-medium text-left transition-colors " +
                  (isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSection("conversations")}
            aria-current={section === "conversations" ? "page" : undefined}
            className={
              "w-full flex items-center gap-2 px-2 h-8 rounded-md text-xs font-medium text-left transition-colors " +
              (section === "conversations"
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-muted")
            }
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            Conversations
            {conversations.length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                {conversations.length}
              </span>
            )}
          </button>
        </nav>

        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Projects
          </span>
          <button
            type="button"
            onClick={() => setProjectDialog({ mode: "new" })}
            aria-label="New project"
            className="h-6 w-6 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto scroll-thin px-2 pb-3 space-y-0.5">
          {projects.length === 0 && (
            <li className="text-[11px] text-muted-foreground px-2 py-2">
              No projects yet. Create one to group memories.
            </li>
          )}
          {projects.map((p) => {
            const isActive = activeView === "projects" && filters.projectId === p.id;
            const count = projectCounts[p.id] ?? 0;
            return (
              <li key={p.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setView("projects", p.id)}
                  className={
                    "w-full flex items-center gap-2 pl-2 pr-8 h-8 rounded-md text-xs text-left transition-colors " +
                    (isActive ? "bg-primary/10 text-primary" : "text-foreground/85 hover:bg-muted")
                  }
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="truncate flex-1">{p.name}</span>
                  {p.favorite && <Star className="h-3 w-3 fill-amber-400 text-amber-500 shrink-0" />}
                  {p.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                  <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
                </button>
                <button
                  type="button"
                  aria-label="Project options"
                  aria-expanded={projectMenuFor === p.id}
                  onClick={() => setProjectMenuFor(projectMenuFor === p.id ? null : p.id)}
                  className="absolute right-1 top-1 h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                {projectMenuFor === p.id && (
                  <ProjectContextMenu
                    project={p}
                    onClose={() => setProjectMenuFor(null)}
                    onEdit={() => { setProjectDialog({ mode: "edit", project: p }); setProjectMenuFor(null); }}
                    onTogglePin={() => { togglePinProject(p.id); setProjectMenuFor(null); }}
                    onToggleFavorite={() => { toggleFavoriteProject(p.id); setProjectMenuFor(null); }}
                    onDelete={() => {
                      if (window.confirm(`Delete project "${p.name}"? Memories will be kept.`)) {
                        deleteProject(p.id);
                        toast.success("Project deleted");
                      }
                      setProjectMenuFor(null);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="flex flex-col min-w-0">
        {section === "conversations" ? (
          <div className="flex flex-col h-full min-h-0">
            <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <MessagesSquare className="h-4 w-4 text-primary" />
              <h1 className="text-sm font-semibold">Conversations</h1>
              <span className="ml-2 text-[10px] text-muted-foreground">
                {conversations.length} saved
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={loadConversations}>
                  Refresh
                </Button>
              </div>
            </header>
            <div className="px-4 pt-3">
              <ConversationSearch value={convQuery} onChange={setConvQuery} />
            </div>
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <div className="overflow-y-auto scroll-thin px-4 py-3">
                <ConversationList
                  conversations={filteredConversations}
                  loading={convLoading}
                  activeId={selectedConv?.id ?? null}
                  onOpen={(c) => setSelectedConv(c)}
                  query={convQuery || undefined}
                  onDelete={async (c) => {
                    if (!window.confirm(`Delete conversation “${c.title}”?`))
                      return;
                    await deleteConversation(c.id);
                    if (selectedConv?.id === c.id) setSelectedConv(null);
                    toast.success("Conversation deleted");
                    void loadConversations();
                  }}
                />
              </div>
              <aside className="hidden md:flex flex-col border-l border-border bg-surface min-w-0">
                {selectedConv ? (
                  <ConversationDetail
                    conversation={selectedConv}
                    onClose={() => setSelectedConv(null)}
                  />
                ) : (
                  <div className="flex-1 grid place-items-center text-xs text-muted-foreground px-6 text-center">
                    Select a conversation to view its messages here.
                  </div>
                )}
              </aside>
            </div>
          </div>
        ) : (
          <>
        <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <h1 className="text-sm font-semibold truncate">{headerTitle}</h1>
          {provider && (
            <span className="ml-2 text-[10px] text-muted-foreground">On {provider.name}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <SortMenu value={settings.sort} onChange={setSort} />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-label="Toggle filters"
              className={
                "h-8 px-2.5 rounded-md text-xs inline-flex items-center gap-1.5 border border-border " +
                (showFilters ? "bg-primary/10 text-primary border-primary/30" : "bg-surface hover:bg-muted")
              }
            >
              <Filter className="h-3.5 w-3.5" /> Filters
            </button>
            <Button size="sm" variant="secondary" onClick={captureFromPage}>
              <Plus className="h-3.5 w-3.5" />
              Capture
            </Button>
            {activeView === "trash" && memories.length > 0 && (
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (!window.confirm("Permanently delete all trashed memories?")) return;
                  const n = await emptyTrash();
                  toast.success(`Deleted ${n} memor${n === 1 ? "y" : "ies"}`);
                }}
              >
                Empty trash
              </Button>
            )}
          </div>
        </header>

        <div className="px-4 pt-3">
          <label className="relative block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <input
              type="search"
              placeholder="Search titles, content, tags, or provider…"
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search memories"
              className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-surface border border-border text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            />
          </label>
        </div>

        {showFilters && (
          <div className="px-4 pt-3 flex flex-wrap items-center gap-2 animate-fade-in">
            <select
              value={filters.provider}
              onChange={(e) => setFilters({ provider: e.target.value as ProviderId | "all" })}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
              aria-label="Filter by provider"
            >
              <option value="all">All providers</option>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={filters.tag ?? ""}
              onChange={(e) => setFilters({ tag: e.target.value || null })}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.name} value={t.name}>#{t.name} ({t.count})</option>
              ))}
            </select>
            <DateInput
              label="From"
              value={filters.dateFrom}
              onChange={(v) => setFilters({ dateFrom: v })}
            />
            <DateInput
              label="To"
              value={filters.dateTo}
              onChange={(v) => setFilters({ dateTo: v })}
            />
            {(filters.provider !== "all" || filters.tag || filters.dateFrom || filters.dateTo) && (
              <button
                type="button"
                onClick={() => setFilters({ provider: "all", tag: null, dateFrom: null, dateTo: null })}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs animate-fade-in">
            <span className="font-medium text-primary">{selectedIds.length} selected</span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-primary hover:underline"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setBulkMoveOpen(true)}>
                Move…
              </Button>
              {activeView === "trash" ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    if (!window.confirm(`Delete ${selectedIds.length} memories permanently?`)) return;
                    await bulkDeleteHard(selectedIds);
                    toast.success("Deleted");
                  }}
                >
                  Delete
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await bulkTrash(selectedIds);
                    toast.success("Moved to trash");
                  }}
                >
                  Trash
                </Button>
              )}
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear selection"
                className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="overflow-y-auto scroll-thin px-4 py-3">
            {!ready || loading ? (
              <MemoryListSkeleton rows={5} />
            ) : memories.length === 0 ? (
              <Empty
                icon={<Inbox className="h-5 w-5" />}
                title={
                  activeView === "trash"
                    ? "Trash is empty."
                    : activeView === "favorites"
                      ? "No favorites yet."
                      : activeView === "pinned"
                        ? "Nothing pinned yet."
                        : activeView === "archived"
                          ? "No archived memories."
                          : filters.search
                            ? "No matches."
                            : "No memories here yet."
                }
                description={
                  activeView === "trash"
                    ? "Deleted memories appear here until you empty the trash."
                    : "Capture text from any AI conversation and it will show up in your workspace."
                }
                action={
                  activeView !== "trash" && (
                    <Button variant="primary" onClick={captureFromPage}>
                      <Plus className="h-3.5 w-3.5" />
                      Capture selection
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <ul className="space-y-2 max-w-2xl" role="list">
                  {visibleMemories.map((m) => (
                    <MemoryRow
                      key={m.id}
                      memory={m}
                      selected={selection.has(m.id)}
                      onSelectChange={(id) => toggleSelected(id)}
                      onOpen={setSelected}
                      onToggleFavorite={activeView !== "trash" ? toggleFavorite : undefined}
                      onTogglePin={activeView !== "trash" ? togglePinMemory : undefined}
                      onTrash={activeView !== "trash" && activeView !== "archived" ? doTrash : undefined}
                      onRestore={activeView === "trash" ? restoreMemory : undefined}
                      onDelete={activeView === "trash" ? doDeleteHard : undefined}
                      onArchive={activeView !== "trash" && activeView !== "archived" ? archiveMemory : undefined}
                      onUnarchive={activeView === "archived" ? unarchiveMemory : undefined}
                      onDuplicate={activeView !== "trash" ? doDuplicate : undefined}
                      onCopy={copyMemoryContent}
                      onEdit={activeView !== "trash" ? (id) => {
                        const m2 = memories.find((x) => x.id === id);
                        if (m2) setEditingMemory(m2);
                      } : undefined}
                      onMove={activeView !== "trash" ? setMovingId : undefined}
                    />
                  ))}
                </ul>
                {visibleCount < memories.length && (
                  <div className="mt-3 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    >
                      Show {Math.min(PAGE_SIZE, memories.length - visibleCount)} more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="hidden md:flex flex-col border-l border-border bg-surface min-w-0">
            {selected ? (
              <>
                <div className="flex items-start gap-2 px-4 py-3 border-b border-border">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold truncate">{selected.title}</h2>
                    <p className="text-[11px] text-muted-foreground">
                      {providerMeta(selected.provider)?.name ?? "Other"} ·{" "}
                      {new Date(selected.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close details"
                    onClick={() => setSelected(null)}
                    className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto scroll-thin px-4 py-3">
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans text-foreground/90">
                    {selected.content}
                  </pre>
                </div>
                <div className="border-t border-border px-4 py-2 flex items-center gap-2 text-[11px]">
                  <Button size="sm" variant="ghost" onClick={() => copyMemoryContent(selected.id)}>
                    Copy
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingMemory(selected)}>
                    Edit
                  </Button>
                  {selected.sourceUrl && (
                    <a
                      href={selected.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto truncate text-primary hover:underline max-w-[180px]"
                    >
                      {selected.sourceUrl}
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 grid place-items-center text-xs text-muted-foreground px-6 text-center">
                Select a memory to see its full content here.
              </div>
            )}
          </aside>
        </div>
      </main>

      {projectDialog && (
        <ProjectDialog
          project={projectDialog.mode === "edit" ? projectDialog.project : null}
          onClose={() => setProjectDialog(null)}
          onCreate={async (input) => {
            await addProject(input);
            toast.success("Project created");
            setProjectDialog(null);
          }}
          onUpdate={async (id, patch) => {
            await updateProjectAction(id, patch);
            toast.success("Project updated");
            setProjectDialog(null);
          }}
        />
      )}

      {editingMemory && (
        <MemoryEditDialog
          memory={editingMemory}
          projects={projects}
          onClose={() => setEditingMemory(null)}
          onSave={async (patch) => {
            await editMemory(editingMemory.id, patch);
            toast.success("Memory updated");
            setEditingMemory(null);
          }}
        />
      )}

      {movingId && (
        <MoveDialog
          projects={projects}
          currentProjectId={memories.find((m) => m.id === movingId)?.projectId ?? null}
          onClose={() => setMovingId(null)}
          onMove={async (projectId) => {
            await moveMemories([movingId], projectId);
            toast.success("Memory moved");
            setMovingId(null);
          }}
        />
      )}

      {bulkMoveOpen && (
        <MoveDialog
          projects={projects}
          currentProjectId={null}
          onClose={() => setBulkMoveOpen(false)}
          onMove={async (projectId) => {
            await moveMemories(selectedIds, projectId);
            toast.success(`Moved ${selectedIds.length} memor${selectedIds.length === 1 ? "y" : "ies"}`);
            setBulkMoveOpen(false);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Sub components ---------------- */

function SortMenu({ value, onChange }: { value: SortKey; onChange: (s: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const { ref } = useOutsideClick<HTMLDivElement>(() => setOpen(false));
  const current = SORTS.find((s) => s.id === value) ?? SORTS[0];
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-8 px-2.5 rounded-md text-xs inline-flex items-center gap-1.5 border border-border bg-surface hover:bg-muted"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        {current.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-30 w-40 rounded-lg border border-border bg-surface shadow-xl py-1 text-xs animate-scale-in">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={s.id === value}
              onClick={() => { onChange(s.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted text-left"
            >
              {s.id === value ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="w-3.5" />}
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DateInput({
  label, value, onChange,
}: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const iso = value ? new Date(value).toISOString().slice(0, 10) : "";
  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      {label}
      <input
        type="date"
        value={iso}
        onChange={(e) => {
          const v = e.target.value ? new Date(e.target.value).getTime() : null;
          onChange(v);
        }}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
      />
    </label>
  );
}

function ProjectContextMenu({
  project, onClose, onEdit, onTogglePin, onToggleFavorite, onDelete,
}: {
  project: Project;
  onClose: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const { ref } = useOutsideClick<HTMLDivElement>(onClose);
  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-1 top-8 z-30 w-44 rounded-lg border border-border bg-surface shadow-xl py-1 text-xs animate-scale-in"
    >
      <button type="button" role="menuitem" onClick={onEdit} className="w-full text-left px-2.5 py-1.5 hover:bg-muted">
        Edit project…
      </button>
      <button type="button" role="menuitem" onClick={onTogglePin} className="w-full text-left px-2.5 py-1.5 hover:bg-muted">
        {project.pinned ? "Unpin" : "Pin"} project
      </button>
      <button type="button" role="menuitem" onClick={onToggleFavorite} className="w-full text-left px-2.5 py-1.5 hover:bg-muted">
        {project.favorite ? "Remove from favorites" : "Add to favorites"}
      </button>
      <div className="my-1 h-px bg-border" />
      <button type="button" role="menuitem" onClick={onDelete} className="w-full text-left px-2.5 py-1.5 hover:bg-muted text-red-600">
        Delete project
      </button>
    </div>
  );
}

function ProjectDialog({
  project, onClose, onCreate, onUpdate,
}: {
  project: Project | null;
  onClose: () => void;
  onCreate: (input: { name: string; color: string; icon: ProjectIcon }) => Promise<void> | void;
  onUpdate: (id: string, patch: { name: string; color: string; icon: ProjectIcon }) => Promise<void> | void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [icon, setIcon] = useState<ProjectIcon>(project?.icon ?? "folder");
  const isEdit = !!project;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? "Edit project" : "New project"}
      description={isEdit ? "Update the project details." : "Group related memories."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!name.trim()) return;
              const payload = { name, color, icon };
              isEdit ? onUpdate(project!.id, payload) : onCreate(payload);
            }}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium">Name</label>
          <input
            data-autofocus
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Color</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Choose color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={
                  "h-7 w-7 rounded-full border-2 transition " +
                  (color === c ? "border-foreground" : "border-transparent hover:border-foreground/30")
                }
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium">Icon</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PROJECT_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={icon === i}
                onClick={() => setIcon(i)}
                className={
                  "h-7 min-w-7 px-2 rounded-md border text-[11px] capitalize " +
                  (icon === i
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface hover:bg-muted")
                }
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function MemoryEditDialog({
  memory, projects, onClose, onSave,
}: {
  memory: Memory;
  projects: Project[];
  onClose: () => void;
  onSave: (patch: { title: string; content: string; tags: string[]; projectId: string | null }) => Promise<void> | void;
}) {
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [tags, setTags] = useState(memory.tags.join(", "));
  const [projectId, setProjectId] = useState<string | null>(memory.projectId);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit memory"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                title,
                content,
                tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
                projectId,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium">Title</label>
          <input
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Tags <span className="text-muted-foreground">(comma separated)</span></label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="research, product, todo"
              className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Project</label>
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function MoveDialog({
  projects, currentProjectId, onClose, onMove,
}: {
  projects: Project[];
  currentProjectId: string | null;
  onClose: () => void;
  onMove: (projectId: string | null) => Promise<void> | void;
}) {
  const [id, setId] = useState<string | null>(currentProjectId);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Move to project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onMove(id)}>Move</Button>
        </>
      }
    >
      <select
        value={id ?? ""}
        onChange={(e) => setId(e.target.value || null)}
        className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm"
        data-autofocus
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </Dialog>
  );
}
