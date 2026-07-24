import { db, uid } from "@/lib/db";
import type {
  ExportPayload,
  Memory,
  MemoryFilters,
  Project,
  ProjectIcon,
  ProviderId,
  Settings,
  SortKey,
  StoredConversation,
  StoredConvMessage,
} from "@/types";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "@/services/settings";

/* ------------------------------------------------------------------ */
/* PROJECTS                                                           */
/* ------------------------------------------------------------------ */

export async function listProjects(): Promise<Project[]> {
  const rows = await db.projects.toArray();
  return rows.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export async function projectMemoryCounts(): Promise<Record<string, number>> {
  const memories = await db.memories.filter((m) => !m.trashed).toArray();
  const counts: Record<string, number> = {};
  for (const m of memories) {
    if (!m.projectId) continue;
    counts[m.projectId] = (counts[m.projectId] ?? 0) + 1;
  }
  return counts;
}

export interface CreateProjectInput {
  name: string;
  color?: string;
  icon?: ProjectIcon;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: uid("prj"),
    name: input.name.trim() || "Untitled project",
    color: input.color ?? "#2563EB",
    icon: input.icon ?? "folder",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    favorite: false,
    archived: false,
  };
  await db.projects.add(project);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "color" | "icon" | "archived">>,
): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: Date.now() });
}

export async function togglePinProject(id: string): Promise<void> {
  const p = await db.projects.get(id);
  if (!p) return;
  await db.projects.update(id, { pinned: !p.pinned, updatedAt: Date.now() });
}

export async function toggleFavoriteProject(id: string): Promise<void> {
  const p = await db.projects.get(id);
  if (!p) return;
  await db.projects.update(id, { favorite: !p.favorite, updatedAt: Date.now() });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction("rw", db.projects, db.memories, async () => {
    await db.memories
      .where("projectId")
      .equals(id)
      .modify({ projectId: null, updatedAt: Date.now() });
    await db.projects.delete(id);
  });
}

/* ------------------------------------------------------------------ */
/* MEMORIES                                                           */
/* ------------------------------------------------------------------ */

export interface CreateMemoryInput {
  title: string;
  content: string;
  provider: ProviderId;
  projectId?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
}

export async function createMemory(input: CreateMemoryInput): Promise<Memory> {
  const now = Date.now();
  const memory: Memory = {
    id: uid("mem"),
    projectId: input.projectId ?? null,
    title: input.title.trim() || "Untitled memory",
    content: input.content,
    provider: input.provider,
    sourceUrl: input.sourceUrl ?? null,
    tags: normalizeTags(input.tags ?? []),
    favorite: false,
    pinned: false,
    archived: false,
    trashed: false,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
  };
  await db.memories.add(memory);
  return memory;
}

export async function updateMemory(
  id: string,
  patch: Partial<Pick<Memory, "title" | "content" | "tags" | "projectId" | "provider">>,
): Promise<void> {
  const clean: Partial<Memory> = { ...patch, updatedAt: Date.now() };
  if (patch.tags) clean.tags = normalizeTags(patch.tags);
  await db.memories.update(id, clean);
}

export async function duplicateMemory(id: string): Promise<Memory | null> {
  const src = await db.memories.get(id);
  if (!src) return null;
  return createMemory({
    title: `${src.title} (copy)`,
    content: src.content,
    provider: src.provider,
    projectId: src.projectId,
    sourceUrl: src.sourceUrl,
    tags: [...src.tags],
  });
}

export async function moveMemories(
  ids: string[],
  projectId: string | null,
): Promise<void> {
  const now = Date.now();
  await db.memories.bulkUpdate(
    ids.map((id) => ({ key: id, changes: { projectId, updatedAt: now } })),
  );
}

export async function toggleFavorite(id: string): Promise<void> {
  const m = await db.memories.get(id);
  if (!m) return;
  await db.memories.update(id, { favorite: !m.favorite, updatedAt: Date.now() });
}

export async function togglePinMemory(id: string): Promise<void> {
  const m = await db.memories.get(id);
  if (!m) return;
  await db.memories.update(id, { pinned: !m.pinned, updatedAt: Date.now() });
}

export async function archiveMemory(id: string): Promise<void> {
  await db.memories.update(id, { archived: true, updatedAt: Date.now() });
}

export async function unarchiveMemory(id: string): Promise<void> {
  await db.memories.update(id, { archived: false, updatedAt: Date.now() });
}

export async function trashMemory(id: string): Promise<void> {
  const now = Date.now();
  await db.memories.update(id, { trashed: true, trashedAt: now, updatedAt: now });
}

export async function restoreMemory(id: string): Promise<void> {
  await db.memories.update(id, {
    trashed: false,
    trashedAt: null,
    updatedAt: Date.now(),
  });
}

export async function deleteMemoryHard(id: string): Promise<void> {
  await db.memories.delete(id);
}

export async function bulkTrash(ids: string[]): Promise<void> {
  const now = Date.now();
  await db.memories.bulkUpdate(
    ids.map((id) => ({
      key: id,
      changes: { trashed: true, trashedAt: now, updatedAt: now },
    })),
  );
}

export async function bulkDeleteHard(ids: string[]): Promise<void> {
  await db.memories.bulkDelete(ids);
}

export async function emptyTrash(): Promise<number> {
  const trashed = await db.memories.filter((m) => m.trashed).toArray();
  const ids = trashed.map((m) => m.id);
  if (ids.length) await db.memories.bulkDelete(ids);
  return ids.length;
}

/* ------------------------------------------------------------------ */
/* QUERY                                                              */
/* ------------------------------------------------------------------ */

export async function listMemories(
  filters: Partial<MemoryFilters> = {},
  sort: SortKey = "newest",
): Promise<Memory[]> {
  const view = filters.view ?? "recent";
  const rows = await db.memories.toArray();
  const q = filters.search?.toLowerCase().trim();

  const filtered = rows.filter((m) => {
    // View gates
    if (view === "trash") {
      if (!m.trashed) return false;
    } else {
      if (m.trashed) return false;
    }
    if (view === "archived" && !m.archived) return false;
    if (view !== "archived" && view !== "trash" && m.archived) return false;
    if (view === "favorites" && !m.favorite) return false;
    if (view === "pinned" && !m.pinned) return false;
    if (view === "projects" && filters.projectId && m.projectId !== filters.projectId) {
      return false;
    }
    if (view === "projects" && filters.projectId === null && m.projectId !== null) {
      // "no project" bucket only when explicitly null; otherwise recent shows all
    }

    if (filters.provider && filters.provider !== "all" && m.provider !== filters.provider)
      return false;
    if (filters.tag && !m.tags.includes(filters.tag)) return false;
    if (filters.dateFrom && m.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && m.createdAt > filters.dateTo) return false;

    if (q) {
      const hay = `${m.title}\n${m.content}\n${m.tags.join(" ")}\n${m.provider}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return sortMemories(filtered, sort);
}

export function sortMemories(rows: Memory[], sort: SortKey): Memory[] {
  const copy = [...rows];
  switch (sort) {
    case "oldest":
      copy.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "alphabetical":
      copy.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "provider":
      copy.sort((a, b) => a.provider.localeCompare(b.provider) || b.updatedAt - a.updatedAt);
      break;
    case "pinned":
      copy.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
      break;
    case "favorites":
      copy.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
      break;
    case "newest":
    default:
      copy.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return copy;
}

/* ------------------------------------------------------------------ */
/* TAGS                                                               */
/* ------------------------------------------------------------------ */

const TAG_PALETTE = [
  "#2563EB", "#7C3AED", "#DB2777", "#DC2626", "#EA580C",
  "#CA8A04", "#16A34A", "#0EA5E9", "#0F766E", "#475569",
];

export function colorForTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().replace(/^#+/, "").toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* IMPORT / EXPORT                                                    */
/* ------------------------------------------------------------------ */

export async function exportAll(): Promise<string> {
  const [projects, memories] = await Promise.all([
    db.projects.toArray(),
    db.memories.toArray(),
  ]);
  const payload: ExportPayload = {
    version: 2,
    exportedAt: Date.now(),
    projects,
    memories,
  };
  return JSON.stringify(payload, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function validateProject(v: unknown): Project | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== "string" || typeof v.name !== "string") return null;
  return {
    id: v.id,
    name: v.name,
    color: typeof v.color === "string" ? v.color : "#2563EB",
    icon: (typeof v.icon === "string" ? v.icon : "folder") as ProjectIcon,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
    updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : Date.now(),
    pinned: v.pinned === true,
    favorite: v.favorite === true,
    archived: v.archived === true,
  };
}

function validateMemory(v: unknown): Memory | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== "string" || typeof v.content !== "string") return null;
  return {
    id: v.id,
    projectId: typeof v.projectId === "string" ? v.projectId : null,
    title: typeof v.title === "string" ? v.title : "Untitled",
    content: v.content,
    provider: (typeof v.provider === "string" ? v.provider : "other") as ProviderId,
    sourceUrl: typeof v.sourceUrl === "string" ? v.sourceUrl : null,
    tags: Array.isArray(v.tags) ? normalizeTags(v.tags.filter((t): t is string => typeof t === "string")) : [],
    favorite: v.favorite === true,
    pinned: v.pinned === true,
    archived: v.archived === true,
    trashed: v.trashed === true,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
    updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : Date.now(),
    trashedAt: typeof v.trashedAt === "number" ? v.trashedAt : null,
  };
}

export async function importAll(
  json: string,
): Promise<{ projects: number; memories: number; skipped: number }> {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) throw new Error("Invalid export: not an object");
  const projectsRaw = Array.isArray(parsed.projects) ? parsed.projects : [];
  const memoriesRaw = Array.isArray(parsed.memories) ? parsed.memories : [];

  const projects: Project[] = [];
  const memories: Memory[] = [];
  let skipped = 0;
  for (const p of projectsRaw) {
    const v = validateProject(p);
    v ? projects.push(v) : skipped++;
  }
  for (const m of memoriesRaw) {
    const v = validateMemory(m);
    v ? memories.push(v) : skipped++;
  }
  if (!projects.length && !memories.length) throw new Error("No valid records found");

  await db.transaction("rw", db.projects, db.memories, async () => {
    if (projects.length) await db.projects.bulkPut(projects);
    if (memories.length) await db.memories.bulkPut(memories);
  });
  return { projects: projects.length, memories: memories.length, skipped };
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

export async function counts(): Promise<{ projects: number; memories: number; trashed: number }> {
  const [projects, memories] = await Promise.all([
    db.projects.count(),
    db.memories.toArray(),
  ]);
  return {
    projects,
    memories: memories.filter((m) => !m.trashed).length,
    trashed: memories.filter((m) => m.trashed).length,
  };
}
