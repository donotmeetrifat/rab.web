/**
 * ProjectDetection — background suggestion mapping conversations to an
 * existing project. Silent by design: writes to chrome.storage.local
 * under `memlace.convProject` so it survives reloads without adding a
 * Dexie migration or forcing UI changes. Users may override via manual
 * project moves elsewhere in the app.
 */
import { suggestProject } from "@/ai/MemoryEngine";
import type { StoredConversation } from "@/types";

const KEY = "memlace.convProject";

type Mapping = Record<string, { projectId: string | null; reason: string; ts: number }>;

async function readMap(): Promise<Mapping> {
  try {
    const raw = await chrome.storage?.local.get(KEY);
    return (raw?.[KEY] as Mapping) ?? {};
  } catch {
    return {};
  }
}

async function writeMap(m: Mapping): Promise<void> {
  try {
    await chrome.storage?.local.set({ [KEY]: m });
  } catch {
    // Ignore quota / unavailable — detection is best-effort.
  }
}

/**
 * Silently update the mapping for a conversation. Never overrides an
 * entry the user has already touched (marked with reason="user").
 */
export async function detectProjectFor(conv: StoredConversation): Promise<void> {
  try {
    const map = await readMap();
    const existing = map[conv.id];
    if (existing && existing.reason === "user") return;
    const suggestion = await suggestProject(conv.id).catch(() => null);
    if (!suggestion) return;
    map[conv.id] = {
      projectId: suggestion.projectId,
      reason: suggestion.reason,
      ts: Date.now(),
    };
    await writeMap(map);
  } catch {
    // Silent by requirement — detection must never surface errors.
  }
}

export async function getDetectedProject(
  conversationId: string,
): Promise<{ projectId: string | null; reason: string } | null> {
  const map = await readMap();
  const hit = map[conversationId];
  return hit ? { projectId: hit.projectId, reason: hit.reason } : null;
}

export async function overrideProject(
  conversationId: string,
  projectId: string | null,
): Promise<void> {
  const map = await readMap();
  map[conversationId] = { projectId, reason: "user", ts: Date.now() };
  await writeMap(map);
}

/** Return every conversation id detected/overridden into the given project. */
export async function conversationsForProject(projectId: string): Promise<string[]> {
  const map = await readMap();
  const out: string[] = [];
  for (const [convId, entry] of Object.entries(map)) {
    if (entry?.projectId === projectId) out.push(convId);
  }
  return out;
}

/** Full mapping — useful for reverse indexes. */
export async function allProjectMappings(): Promise<
  Record<string, { projectId: string | null; reason: string; ts: number }>
> {
  return readMap();
}

