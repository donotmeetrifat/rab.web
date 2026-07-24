import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { MemoryRow } from "@/components/MemoryRow";
import { useMemlace, type SidebarView } from "@/store/useMemlace";
import { useActiveTab } from "@/hooks/useActiveTab";
import { providerMeta } from "@/lib/providers";
import type { Memory } from "@/types";

const NAV: { id: SidebarView; label: string; icon: typeof Folder }[] = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "trash", label: "Trash", icon: Trash2 },
];

export function SidePanelApp() {
  const bootstrap = useMemlace((s) => s.bootstrap);
  const ready = useMemlace((s) => s.ready);
  const projects = useMemlace((s) => s.projects);
  const memories = useMemlace((s) => s.memories);
  const activeView = useMemlace((s) => s.activeView);
  const activeProjectId = useMemlace((s) => s.activeProjectId);
  const search = useMemlace((s) => s.search);
  const setView = useMemlace((s) => s.setView);
  const setSearch = useMemlace((s) => s.setSearch);
  const addProject = useMemlace((s) => s.addProject);
  const addMemory = useMemlace((s) => s.addMemory);
  const togglePinProject = useMemlace((s) => s.togglePinProject);
  const deleteProject = useMemlace((s) => s.deleteProject);
  const toggleFavorite = useMemlace((s) => s.toggleFavorite);
  const trashMemory = useMemlace((s) => s.trashMemory);
  const restoreMemory = useMemlace((s) => s.restoreMemory);
  const deleteMemoryHard = useMemlace((s) => s.deleteMemoryHard);
  const emptyTrash = useMemlace((s) => s.emptyTrash);

  const active = useActiveTab();
  const provider = providerMeta(active.provider);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [projectMenuFor, setProjectMenuFor] = useState<string | null>(null);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return memories;
    return memories.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [memories, search]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const openOptions = () => chrome.runtime.openOptionsPage?.();

  const newProject = async () => {
    const name = window.prompt("Project name");
    if (!name) return;
    const p = await addProject(name);
    await setView("projects", p.id);
  };

  const captureFromPage = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() ?? "",
    });
    const text = results[0]?.result ?? "";
    if (!text) {
      window.alert("Select text on the page first, then click Capture.");
      return;
    }
    await addMemory({
      title: (tab.title ?? "Captured note").slice(0, 80),
      content: text,
      provider: active.provider,
      sourceUrl: tab.url ?? null,
      projectId: activeProject?.id ?? null,
    });
  };

  const headerTitle =
    activeView === "projects" && activeProject
      ? activeProject.name
      : NAV.find((n) => n.id === activeView)?.label ?? "Workspace";

  return (
    <div className="grid h-dvh w-dvw grid-cols-[220px_1fr] bg-background text-foreground">
      <aside className="flex flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <Logo size={22} />
          <span className="text-[13px] font-semibold tracking-tight">Memlace</span>
          <button
            type="button"
            onClick={openOptions}
            aria-label="Settings"
            className="ml-auto h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        <nav className="p-2 space-y-0.5" aria-label="Primary">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id && (item.id !== "projects" || !activeProjectId);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={
                  "w-full flex items-center gap-2 px-2 h-8 rounded-md text-xs font-medium text-left transition-colors " +
                  (active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Projects
          </span>
          <button
            type="button"
            onClick={newProject}
            aria-label="New project"
            className="h-6 w-6 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
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
            const isActive = activeView === "projects" && activeProjectId === p.id;
            return (
              <li key={p.id} className="relative">
                <button
                  type="button"
                  onClick={() => setView("projects", p.id)}
                  className={
                    "w-full flex items-center gap-2 px-2 h-8 rounded-md text-xs text-left transition-colors " +
                    (isActive ? "bg-primary/10 text-primary" : "text-foreground/85 hover:bg-muted")
                  }
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="truncate flex-1">{p.name}</span>
                  {p.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                </button>
                <button
                  type="button"
                  aria-label="Project options"
                  onClick={() => setProjectMenuFor(projectMenuFor === p.id ? null : p.id)}
                  className="absolute right-1 top-1 h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                {projectMenuFor === p.id && (
                  <div
                    role="menu"
                    className="absolute right-1 top-8 z-10 w-40 rounded-md border border-border bg-surface shadow-lg py-1 text-xs"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { togglePinProject(p.id); setProjectMenuFor(null); }}
                      className="w-full text-left px-2 py-1.5 hover:bg-muted"
                    >
                      {p.pinned ? "Unpin" : "Pin"} project
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (window.confirm(`Delete project "${p.name}"? Memories will be kept.`)) {
                          deleteProject(p.id);
                        }
                        setProjectMenuFor(null);
                      }}
                      className="w-full text-left px-2 py-1.5 hover:bg-muted text-red-600"
                    >
                      Delete project
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="flex flex-col min-w-0">
        <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <h1 className="text-sm font-semibold truncate">{headerTitle}</h1>
          {provider && (
            <span className="ml-2 text-[10px] text-muted-foreground">On {provider.name}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={captureFromPage}>
              <Plus className="h-3.5 w-3.5" />
              Capture
            </Button>
            {activeView === "trash" && memories.length > 0 && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (window.confirm("Permanently delete all trashed memories?")) emptyTrash();
                }}
              >
                Empty trash
              </Button>
            )}
          </div>
        </header>

        <div className="px-4 pt-3">
          <label className="relative block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search memories, tags, or content…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-surface border border-border text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            />
          </label>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="overflow-y-auto scroll-thin px-4 py-3">
            {!ready ? (
              <div className="text-xs text-muted-foreground px-2 py-6">Loading workspace…</div>
            ) : filtered.length === 0 ? (
              <Empty
                icon={<Inbox className="h-5 w-5" />}
                title={
                  activeView === "trash"
                    ? "Trash is empty."
                    : activeView === "favorites"
                      ? "No favorites yet."
                      : "No memories here yet."
                }
                description={
                  activeView === "trash"
                    ? "Deleted memories will appear here for 30 days before you can empty them."
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
              <ul className="space-y-2 max-w-2xl">
                {filtered.map((m) => (
                  <MemoryRow
                    key={m.id}
                    memory={m}
                    onOpen={setSelected}
                    onToggleFavorite={activeView !== "trash" ? toggleFavorite : undefined}
                    onTrash={activeView !== "trash" ? trashMemory : undefined}
                    onRestore={activeView === "trash" ? restoreMemory : undefined}
                    onDelete={activeView === "trash" ? deleteMemoryHard : undefined}
                  />
                ))}
              </ul>
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
                    aria-label="Close"
                    onClick={() => setSelected(null)}
                    className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
                  >
                    ×
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto scroll-thin px-4 py-3">
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans text-foreground/90">
                    {selected.content}
                  </pre>
                </div>
                {selected.sourceUrl && (
                  <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground truncate">
                    <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline text-primary">
                      {selected.sourceUrl}
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 grid place-items-center text-xs text-muted-foreground px-6 text-center">
                Select a memory to see its full content here.
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
