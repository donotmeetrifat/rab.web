import { create } from "zustand";
import type {
  Memory,
  MemoryFilters,
  Project,
  ProjectIcon,
  ProviderId,
  Settings,
  SortKey,
} from "@/types";
import {
  archiveMemory,
  bulkDeleteHard,
  bulkTrash,
  createMemory,
  createProject,
  deleteMemoryHard,
  deleteProject,
  duplicateMemory,
  emptyTrash,
  listMemories,
  listProjects,
  moveMemories,
  projectMemoryCounts,
  restoreMemory,
  toggleFavorite,
  toggleFavoriteProject,
  togglePinMemory,
  togglePinProject,
  trashMemory,
  unarchiveMemory,
  updateMemory,
  updateProject,
  type CreateMemoryInput,
  type CreateProjectInput,
} from "@/services/memories";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettings as resetSettingsService,
  saveSettings,
  subscribeSettings,
} from "@/services/settings";

export type SidebarView = MemoryFilters["view"];

const DEFAULT_FILTERS: MemoryFilters = {
  view: "recent",
  projectId: null,
  provider: "all",
  tag: null,
  dateFrom: null,
  dateTo: null,
  search: "",
};

interface State {
  ready: boolean;
  loading: boolean;
  projects: Project[];
  projectCounts: Record<string, number>;
  memories: Memory[];
  settings: Settings;
  filters: MemoryFilters;
  selection: Set<string>;
  error: string | null;
}

interface Actions {
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  setView: (view: SidebarView, projectId?: string | null) => Promise<void>;
  setFilters: (patch: Partial<MemoryFilters>) => Promise<void>;
  setSort: (sort: SortKey) => Promise<void>;
  setSearch: (query: string) => void;

  // projects
  addProject: (input: CreateProjectInput) => Promise<Project>;
  renameProject: (id: string, name: string) => Promise<void>;
  updateProject: (id: string, patch: { name?: string; color?: string; icon?: ProjectIcon }) => Promise<void>;
  togglePinProject: (id: string) => Promise<void>;
  toggleFavoriteProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // memories
  addMemory: (input: CreateMemoryInput) => Promise<Memory>;
  editMemory: (id: string, patch: Partial<Pick<Memory, "title" | "content" | "tags" | "projectId" | "provider">>) => Promise<void>;
  duplicateMemory: (id: string) => Promise<Memory | null>;
  moveMemories: (ids: string[], projectId: string | null) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  togglePinMemory: (id: string) => Promise<void>;
  archiveMemory: (id: string) => Promise<void>;
  unarchiveMemory: (id: string) => Promise<void>;
  trashMemory: (id: string) => Promise<void>;
  restoreMemory: (id: string) => Promise<void>;
  deleteMemoryHard: (id: string) => Promise<void>;
  bulkTrash: (ids: string[]) => Promise<void>;
  bulkDeleteHard: (ids: string[]) => Promise<void>;
  emptyTrash: () => Promise<number>;

  // selection
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  selectMany: (ids: string[]) => void;

  // settings
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;

  // helpers
  getMemory: (id: string) => Memory | undefined;
  setError: (msg: string | null) => void;
}

export const useMemlace = create<State & Actions>((set, get) => ({
  ready: false,
  loading: false,
  projects: [],
  projectCounts: {},
  memories: [],
  settings: DEFAULT_SETTINGS,
  filters: DEFAULT_FILTERS,
  selection: new Set(),
  error: null,

  bootstrap: async () => {
    try {
      const settings = await loadSettings();
      set({ settings });
      subscribeSettings((s) => set({ settings: s }));
      await get().refresh();
      set({ ready: true });
    } catch (err) {
      set({
        ready: true,
        error: err instanceof Error ? err.message : "Failed to bootstrap Memlace",
      });
    }
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const { filters, settings } = get();
      const [projects, projectCounts, memories] = await Promise.all([
        listProjects(),
        projectMemoryCounts(),
        listMemories(filters, settings.sort),
      ]);
      set({ projects, projectCounts, memories, loading: false, error: null });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load memories",
      });
    }
  },

  setView: async (view, projectId = null) => {
    set({
      filters: {
        ...get().filters,
        view,
        projectId: view === "projects" ? projectId : null,
      },
      selection: new Set(),
    });
    await get().refresh();
  },

  setFilters: async (patch) => {
    set({ filters: { ...get().filters, ...patch } });
    await get().refresh();
  },

  setSort: async (sort) => {
    const next = { ...get().settings, sort };
    set({ settings: next });
    await saveSettings(next);
    await get().refresh();
  },

  setSearch: (query) => {
    set({ filters: { ...get().filters, search: query } });
    void get().refresh();
  },

  addProject: async (input) => {
    const p = await createProject(input);
    await get().refresh();
    return p;
  },
  renameProject: async (id, name) => {
    await updateProject(id, { name });
    await get().refresh();
  },
  updateProject: async (id, patch) => {
    await updateProject(id, patch);
    await get().refresh();
  },
  togglePinProject: async (id) => {
    await togglePinProject(id);
    await get().refresh();
  },
  toggleFavoriteProject: async (id) => {
    await toggleFavoriteProject(id);
    await get().refresh();
  },
  deleteProject: async (id) => {
    await deleteProject(id);
    const { filters } = get();
    if (filters.projectId === id) {
      set({ filters: { ...filters, view: "recent", projectId: null } });
    }
    await get().refresh();
  },

  addMemory: async (input) => {
    const m = await createMemory(input);
    await get().refresh();
    return m;
  },
  editMemory: async (id, patch) => {
    await updateMemory(id, patch);
    await get().refresh();
  },
  duplicateMemory: async (id) => {
    const m = await duplicateMemory(id);
    await get().refresh();
    return m;
  },
  moveMemories: async (ids, projectId) => {
    await moveMemories(ids, projectId);
    await get().refresh();
  },
  toggleFavorite: async (id) => {
    await toggleFavorite(id);
    await get().refresh();
  },
  togglePinMemory: async (id) => {
    await togglePinMemory(id);
    await get().refresh();
  },
  archiveMemory: async (id) => {
    await archiveMemory(id);
    await get().refresh();
  },
  unarchiveMemory: async (id) => {
    await unarchiveMemory(id);
    await get().refresh();
  },
  trashMemory: async (id) => {
    await trashMemory(id);
    await get().refresh();
  },
  restoreMemory: async (id) => {
    await restoreMemory(id);
    await get().refresh();
  },
  deleteMemoryHard: async (id) => {
    await deleteMemoryHard(id);
    await get().refresh();
  },
  bulkTrash: async (ids) => {
    await bulkTrash(ids);
    set({ selection: new Set() });
    await get().refresh();
  },
  bulkDeleteHard: async (ids) => {
    await bulkDeleteHard(ids);
    set({ selection: new Set() });
    await get().refresh();
  },
  emptyTrash: async () => {
    const n = await emptyTrash();
    set({ selection: new Set() });
    await get().refresh();
    return n;
  },

  toggleSelected: (id) => {
    const next = new Set(get().selection);
    next.has(id) ? next.delete(id) : next.add(id);
    set({ selection: next });
  },
  clearSelection: () => set({ selection: new Set() }),
  selectMany: (ids) => set({ selection: new Set(ids) }),

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await saveSettings(next);
  },
  resetSettings: async () => {
    const s = await resetSettingsService();
    set({ settings: s });
  },

  getMemory: (id) => get().memories.find((m) => m.id === id),
  setError: (msg) => set({ error: msg }),
}));

// Compat alias for the old exported type
export type { ProviderId };
