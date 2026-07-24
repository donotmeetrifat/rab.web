import { db, uid } from "@/lib/db";
import type { Memory, Project, ProviderId } from "@/types";

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function createProject(name: string, color = "#2563EB"): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: uid("prj"),
    name: name.trim() || "Untitled project",
    color,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false,
  };
  await db.projects.add(project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<void> {
  await db.projects.update(id, { name, updatedAt: Date.now() });
}

export async function togglePinProject(id: string): Promise<void> {
  const p = await db.projects.get(id);
  if (!p) return;
  await db.projects.update(id, { pinned: !p.pinned, updatedAt: Date.now() });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction("rw", db.projects, db.memories, async () => {
    await db.memories.where("projectId").equals(id).modify({ projectId: null, updatedAt: Date.now() });
    await db.projects.delete(id);
  });
}

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
    tags: input.tags ?? [],
    favorite: false,
    trashed: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.memories.add(memory);
  return memory;
}

export async function listMemories(filter?: {
  projectId?: string | null;
  favorite?: boolean;
  trashed?: boolean;
  search?: string;
}): Promise<Memory[]> {
  let collection = db.memories.orderBy("updatedAt").reverse();
  const rows = await collection.toArray();
  const q = filter?.search?.toLowerCase().trim();
  return rows.filter((m) => {
    if (filter?.trashed !== undefined && m.trashed !== filter.trashed) return false;
    if (filter?.favorite !== undefined && m.favorite !== filter.favorite) return false;
    if (filter?.projectId !== undefined && m.projectId !== filter.projectId) return false;
    if (q) {
      const hay = `${m.title}\n${m.content}\n${m.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export async function toggleFavorite(id: string): Promise<void> {
  const m = await db.memories.get(id);
  if (!m) return;
  await db.memories.update(id, { favorite: !m.favorite, updatedAt: Date.now() });
}

export async function trashMemory(id: string): Promise<void> {
  await db.memories.update(id, { trashed: true, updatedAt: Date.now() });
}

export async function restoreMemory(id: string): Promise<void> {
  await db.memories.update(id, { trashed: false, updatedAt: Date.now() });
}

export async function deleteMemoryHard(id: string): Promise<void> {
  await db.memories.delete(id);
}

export async function emptyTrash(): Promise<number> {
  const trashed = await db.memories.where("trashed").equals(1).toArray();
  const ids = trashed.filter((m) => m.trashed).map((m) => m.id);
  await db.memories.bulkDelete(ids);
  return ids.length;
}

export async function exportAll(): Promise<string> {
  const [projects, memories] = await Promise.all([
    db.projects.toArray(),
    db.memories.toArray(),
  ]);
  return JSON.stringify(
    { version: 1, exportedAt: Date.now(), projects, memories },
    null,
    2,
  );
}

export async function importAll(json: string): Promise<{ projects: number; memories: number }> {
  const parsed = JSON.parse(json) as { projects?: Project[]; memories?: Memory[] };
  const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
  const memories = Array.isArray(parsed.memories) ? parsed.memories : [];
  await db.transaction("rw", db.projects, db.memories, async () => {
    if (projects.length) await db.projects.bulkPut(projects);
    if (memories.length) await db.memories.bulkPut(memories);
  });
  return { projects: projects.length, memories: memories.length };
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!("storage" in navigator) || !navigator.storage.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
