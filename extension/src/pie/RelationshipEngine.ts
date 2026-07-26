/**
 * RelationshipEngine — persistent, deduplicated edges between the eight
 * PIE node types. Updates incrementally per saved conversation.
 */
import { db } from "@/lib/db";
import type { KnowledgeRecord } from "@/knowledge/types";
import type { StoredConversation } from "@/types";
import type { PieNodeType, PieRelationshipRow } from "./types";

function edgeId(aType: PieNodeType, a: string, bType: PieNodeType, b: string): string {
  const left = `${aType}:${a.toLowerCase()}`;
  const right = `${bType}:${b.toLowerCase()}`;
  return left < right ? `${left}::${right}` : `${right}::${left}`;
}

interface EdgeSpec { aType: PieNodeType; a: string; bType: PieNodeType; b: string; weight: number; }

async function upsertEdges(edges: EdgeSpec[]): Promise<void> {
  if (!edges.length) return;
  const now = Date.now();
  const ids = edges.map((e) => edgeId(e.aType, e.a, e.bType, e.b));
  const existing = await db.pieRelationships.bulkGet(ids);
  const rows: PieRelationshipRow[] = edges.map((e, i) => {
    const id = ids[i];
    const prev = existing[i];
    return prev
      ? { ...prev, weight: prev.weight + e.weight, updatedAt: now }
      : { id, aType: e.aType, a: e.a.toLowerCase(), bType: e.bType, b: e.b.toLowerCase(), weight: e.weight, updatedAt: now };
  });
  await db.pieRelationships.bulkPut(rows);
}

export async function updateRelationshipsFor(
  conversation: StoredConversation,
  knowledge: KnowledgeRecord | null,
): Promise<void> {
  const edges: EdgeSpec[] = [];
  const convId = conversation.id;
  const projectId = (conversation as unknown as { projectId?: string }).projectId;

  const techs = knowledge?.technologies ?? [];
  const topics = knowledge?.topics ?? [];

  // conversation ↔ technology / topic
  for (const t of techs) edges.push({ aType: "conversation", a: convId, bType: "technology", b: t, weight: 1 });
  for (const t of topics) edges.push({ aType: "conversation", a: convId, bType: "topic", b: t, weight: 1 });

  // project ↔ technology / topic / conversation
  if (projectId) {
    edges.push({ aType: "project", a: projectId, bType: "conversation", b: convId, weight: 1 });
    for (const t of techs) edges.push({ aType: "project", a: projectId, bType: "technology", b: t, weight: 1 });
    for (const t of topics) edges.push({ aType: "project", a: projectId, bType: "topic", b: t, weight: 1 });
  }

  // technology ↔ technology (co-occurrence)
  for (let i = 0; i < techs.length; i++) {
    for (let j = i + 1; j < techs.length; j++) {
      edges.push({ aType: "technology", a: techs[i], bType: "technology", b: techs[j], weight: 1 });
    }
  }
  await upsertEdges(edges);
}

export async function neighbours(
  type: PieNodeType,
  key: string,
  limit = 12,
): Promise<PieRelationshipRow[]> {
  const k = key.toLowerCase();
  const [asA, asB] = await Promise.all([
    db.pieRelationships.where("a").equals(k).toArray(),
    db.pieRelationships.where("b").equals(k).toArray(),
  ]);
  const filtered = [...asA, ...asB].filter(
    (r) => (r.a === k && r.aType === type) || (r.b === k && r.bType === type),
  );
  return filtered.sort((a, b) => b.weight - a.weight).slice(0, limit);
}
