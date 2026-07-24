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

export const EXPORT_VERSION = 3;

export async function exportAll(): Promise<string> {
  const [projects, memories, conversations, messages, settings] = await Promise.all([
    db.projects.toArray(),
    db.memories.toArray(),
    db.conversations.toArray(),
    db.convMessages.toArray(),
    loadSettings(),
  ]);
  const payload: ExportPayload = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    projects,
    memories,
    conversations,
    messages,
    settings,
  };
  return JSON.stringify(payload, null, 2);
}

/** Estimate JSON size in bytes without materializing a full export string twice. */
export async function estimateExportSize(): Promise<number> {
  const json = await exportAll();
  return new Blob([json]).size;
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
    tags: Array.isArray(v.tags)
      ? normalizeTags(v.tags.filter((t): t is string => typeof t === "string"))
      : [],
    favorite: v.favorite === true,
    pinned: v.pinned === true,
    archived: v.archived === true,
    trashed: v.trashed === true,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
    updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : Date.now(),
    trashedAt: typeof v.trashedAt === "number" ? v.trashedAt : null,
  };
}

function validateConversation(v: unknown): StoredConversation | null {
  if (!isRecord(v)) return null;
  if (
    typeof v.id !== "string" ||
    typeof v.provider !== "string" ||
    typeof v.providerConversationId !== "string"
  )
    return null;
  const now = Date.now();
  const src = v.source;
  return {
    id: v.id,
    provider: v.provider as ProviderId,
    providerConversationId: v.providerConversationId,
    title: typeof v.title === "string" ? v.title : "Untitled conversation",
    url: typeof v.url === "string" ? v.url : "",
    model: typeof v.model === "string" ? v.model : null,
    messageCount: typeof v.messageCount === "number" ? v.messageCount : 0,
    hash: typeof v.hash === "string" ? v.hash : "",
    createdAt: typeof v.createdAt === "number" ? v.createdAt : now,
    updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : now,
    lastSyncAt: typeof v.lastSyncAt === "number" ? v.lastSyncAt : now,
    source: src === "manual" || src === "auto" || src === "initial" ? src : "manual",
  };
}

function validateConvMessage(v: unknown): StoredConvMessage | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== "string" || typeof v.conversationId !== "string") return null;
  const role = v.role;
  return {
    id: v.id,
    conversationId: v.conversationId,
    providerMessageId: typeof v.providerMessageId === "string" ? v.providerMessageId : v.id,
    role:
      role === "user" || role === "assistant" || role === "system" || role === "tool"
        ? role
        : "assistant",
    content: typeof v.content === "string" ? v.content : "",
    markdown: typeof v.markdown === "string" ? v.markdown : "",
    order: typeof v.order === "number" ? v.order : 0,
    images: Array.isArray(v.images) ? v.images.filter((s): s is string => typeof s === "string") : [],
    attachments: Array.isArray(v.attachments)
      ? (v.attachments.filter((a) => isRecord(a)) as StoredConvMessage["attachments"])
      : [],
    metadata: isRecord(v.metadata) ? (v.metadata as Record<string, unknown>) : {},
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
  };
}

function validateSettingsPatch(v: unknown): Partial<Settings> | null {
  if (!isRecord(v)) return null;
  const out: Partial<Settings> = {};
  if (v.theme === "light" || v.theme === "dark" || v.theme === "system") out.theme = v.theme;
  if (typeof v.defaultProvider === "string") out.defaultProvider = v.defaultProvider as ProviderId;
  if (typeof v.shortcutCapture === "string") out.shortcutCapture = v.shortcutCapture;
  if (typeof v.shortcutOpenPopup === "string") out.shortcutOpenPopup = v.shortcutOpenPopup;
  if (typeof v.notificationsEnabled === "boolean") out.notificationsEnabled = v.notificationsEnabled;
  if (typeof v.autoSaveConversations === "boolean")
    out.autoSaveConversations = v.autoSaveConversations;
  if (v.sort === "newest" || v.sort === "oldest" || v.sort === "alphabetical")
    out.sort = v.sort as SortKey;
  return out;
}

export interface ImportResult {
  projects: number;
  memories: number;
  conversations: number;
  messages: number;
  skipped: number;
  settingsApplied: boolean;
}

export interface ImportOptions {
  /** When true, restore settings from payload. Defaults to false. */
  restoreSettings?: boolean;
}

export async function importAll(json: string, opts: ImportOptions = {}): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid export: not valid JSON");
  }
  if (!isRecord(parsed)) throw new Error("Invalid export: not an object");

  const projectsRaw = Array.isArray(parsed.projects) ? parsed.projects : [];
  const memoriesRaw = Array.isArray(parsed.memories) ? parsed.memories : [];
  const conversationsRaw = Array.isArray(parsed.conversations) ? parsed.conversations : [];
  // Accept both `messages` (v3+) and legacy `convMessages`.
  const messagesRaw = Array.isArray(parsed.messages)
    ? parsed.messages
    : Array.isArray(parsed.convMessages)
      ? parsed.convMessages
      : [];

  const projects: Project[] = [];
  const memories: Memory[] = [];
  const conversations: StoredConversation[] = [];
  const messages: StoredConvMessage[] = [];
  let skipped = 0;

  for (const p of projectsRaw) {
    const v = validateProject(p);
    v ? projects.push(v) : skipped++;
  }
  for (const m of memoriesRaw) {
    const v = validateMemory(m);
    v ? memories.push(v) : skipped++;
  }
  for (const c of conversationsRaw) {
    const v = validateConversation(c);
    v ? conversations.push(v) : skipped++;
  }
  for (const m of messagesRaw) {
    const v = validateConvMessage(m);
    v ? messages.push(v) : skipped++;
  }

  if (
    !projects.length &&
    !memories.length &&
    !conversations.length &&
    !messages.length
  ) {
    throw new Error("No valid records found in export");
  }

  // Deduplicate conversations by (provider, providerConversationId) against
  // existing rows. When a duplicate is found, remap the imported id to the
  // existing id so message relationships survive.
  const existingConvs = conversations.length ? await db.conversations.toArray() : [];
  const existingByKey = new Map<string, StoredConversation>();
  for (const c of existingConvs) {
    existingByKey.set(`${c.provider}::${c.providerConversationId}`, c);
  }
  const idRemap = new Map<string, string>();
  const convsToUpsert: StoredConversation[] = [];
  for (const c of conversations) {
    const key = `${c.provider}::${c.providerConversationId}`;
    const existing = existingByKey.get(key);
    if (existing) {
      idRemap.set(c.id, existing.id);
      // Keep the newer record wins on updatedAt, but preserve existing id.
      if (c.updatedAt > existing.updatedAt) {
        convsToUpsert.push({ ...c, id: existing.id });
      }
    } else {
      convsToUpsert.push(c);
    }
  }

  // Drop orphan messages (unknown conversationId) and remap ids for merged
  // conversations. Deduplicate against existing messages via a composite key.
  const validConvIds = new Set<string>([
    ...existingConvs.map((c) => c.id),
    ...convsToUpsert.map((c) => c.id),
    ...conversations.map((c) => c.id),
  ]);
  const remappedMessages: StoredConvMessage[] = [];
  for (const m of messages) {
    const targetConvId = idRemap.get(m.conversationId) ?? m.conversationId;
    if (!validConvIds.has(targetConvId)) {
      skipped++;
      continue;
    }
    remappedMessages.push({ ...m, conversationId: targetConvId });
  }

  const affectedConvIds = new Set(remappedMessages.map((m) => m.conversationId));
  const existingMsgKeys = new Set<string>();
  if (affectedConvIds.size) {
    const existingMsgs = await db.convMessages
      .where("conversationId")
      .anyOf(Array.from(affectedConvIds))
      .toArray();
    for (const m of existingMsgs) {
      existingMsgKeys.add(`${m.conversationId}::${m.providerMessageId}::${m.order}`);
    }
  }
  const messagesToInsert = remappedMessages.filter((m) => {
    const key = `${m.conversationId}::${m.providerMessageId}::${m.order}`;
    if (existingMsgKeys.has(key)) return false;
    existingMsgKeys.add(key);
    return true;
  });

  await db.transaction(
    "rw",
    db.projects,
    db.memories,
    db.conversations,
    db.convMessages,
    async () => {
      if (projects.length) await db.projects.bulkPut(projects);
      if (memories.length) await db.memories.bulkPut(memories);
      if (convsToUpsert.length) await db.conversations.bulkPut(convsToUpsert);
      if (messagesToInsert.length) await db.convMessages.bulkPut(messagesToInsert);

      // Recompute messageCount for affected conversations to keep the count
      // consistent with reality after dedupe.
      for (const convId of affectedConvIds) {
        const total = await db.convMessages.where("conversationId").equals(convId).count();
        await db.conversations.update(convId, { messageCount: total });
      }
    },
  );

  let settingsApplied = false;
  if (opts.restoreSettings) {
    const patch = validateSettingsPatch(parsed.settings);
    if (patch) {
      const current = await loadSettings();
      await saveSettings({ ...DEFAULT_SETTINGS, ...current, ...patch });
      settingsApplied = true;
    }
  }

  return {
    projects: projects.length,
    memories: memories.length,
    conversations: conversations.length,
    messages: messagesToInsert.length,
    skipped,
    settingsApplied,
  };
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

export async function counts(): Promise<{
  projects: number;
  memories: number;
  trashed: number;
  conversations: number;
  messages: number;
}> {
  const [projects, memories, conversations, messages] = await Promise.all([
    db.projects.count(),
    db.memories.toArray(),
    db.conversations.count(),
    db.convMessages.count(),
  ]);
  return {
    projects,
    memories: memories.filter((m) => !m.trashed).length,
    trashed: memories.filter((m) => m.trashed).length,
    conversations,
    messages,
  };
}
