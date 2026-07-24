import { db } from "@/lib/db";
import { colorForTag } from "@/services/memories";
import type { TagMeta } from "@/types";

export async function listTags(): Promise<TagMeta[]> {
  const memories = await db.memories.filter((m) => !m.trashed).toArray();
  const map = new Map<string, number>();
  for (const m of memories) {
    for (const t of m.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  const out: TagMeta[] = [];
  for (const [name, count] of map) {
    out.push({ name, count, color: colorForTag(name) });
  }
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return out;
}
