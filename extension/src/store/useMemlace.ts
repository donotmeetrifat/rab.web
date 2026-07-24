import { create } from "zustand";
import type { Memory, Project, Settings } from "@/types";
import {
  createMemory,
  createProject,
  deleteMemoryHard,
  deleteProject,
  emptyTrash,
  listMemories,
  listProjects,
  renameProject,
  restoreMemory,
  toggleFavorite,
  togglePinProject,
  trashMemory,
  type CreateMemoryInput,
} from "@/services/memories";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, subscribeSettings } from "@/services/settings";

export type SidebarView = "projects" | "recent" | "favorites" | "trash";

interface State {
  ready: boolean;
  projects: Project[];
  memories: Memory[];
  settings: Settings;
  activeView: SidebarView;
  activeProjectId: string | null;
  search: string;
}

interface Actions {
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  setView: (view: SidebarView, projectId?: string | null) => Promise<void>;
  setSearch: (query: string) => void;
  addProject: (name: string) => Promise<Project>;
  renameProject: (id: string, name: string) => Promise<void>;
  togglePinProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addMemory: (input: CreateMemoryInput) => Promise<Memory>;
  toggleFavorite: (id: string) => Promise<void>;
  trashMemory: (id: string) => Promise<void>;
  restoreMemory: (id: string) => Promise<void>;
  deleteMemoryHard: (id: string) => Promise<void>;
  emptyTrash: () => Promise<number>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

export const useMemlace = create<State & Actions>((set, get) => ({
  ready: false,
  projects: [],
  memories: [],
  settings: DEFAULT_SETTINGS,
  activeView: "recent",
  activeProjectId: null,
  search: "",

  bootstrap: async () => {
    const settings = await loadSettings();
    set({ settings });
    subscribeSettings((s) => set({ settings: s }));
    await get().refresh();
    set({ ready: true });
  },

  refresh: async () => {
    const view = get().activeView;
    const projectId = get().activeProjectId;
    const filter: Parameters<typeof listMemories>[0] =
      view === "trash"
        ? { trashed: true }
        : view === "favorites"
          ? { favorite: true, trashed: false }
          : view === "projects"
            ? { trashed: false, projectId }
            : { trashed: false };
    const [projects, memories] = await Promise.all([listProjects(), listMemories(filter)]);
    set({ projects, memories });
  },

  setView: async (view, projectId = null) => {
    set({ activeView: view, activeProjectId: view === "projects" ? projectId : null });
    await get().refresh();
  },

  setSearch: (query) => set({ search: query }),

  addProject: async (name) => {
    const p = await createProject(name);
    await get().refresh();
    return p;
  },
  renameProject: async (id, name) => {
    await renameProject(id, name);
    await get().refresh();
  },
  togglePinProject: async (id) => {
    await togglePinProject(id);
    await get().refresh();
  },
  deleteProject: async (id) => {
    await deleteProject(id);
    if (get().activeProjectId === id) set({ activeProjectId: null, activeView: "recent" });
    await get().refresh();
  },
  addMemory: async (input) => {
    const m = await createMemory(input);
    await get().refresh();
    return m;
  },
  toggleFavorite: async (id) => {
    await toggleFavorite(id);
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
  emptyTrash: async () => {
    const n = await emptyTrash();
    await get().refresh();
    return n;
  },
  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await saveSettings(next);
  },
}));
