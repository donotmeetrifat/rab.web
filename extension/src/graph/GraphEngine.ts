/**
 * GraphEngine — incremental writer for the Memory Graph.
 *
 * Called from the Orchestrator on every conversation save/delete. Never
 * rebuilds the graph; only touches nodes/edges implied by the current
 * conversation. Safe to re-run — all writes are idempotent upserts.
 *
 * No UI. No telemetry. All data is derived and can be dropped without
 * data loss.
 */
import { db } from "@/lib/db";
import type { StoredConversation } from "@/types";
import type { KnowledgeRecord } from "@/knowledge/types";
import type {
  GraphEdgeRow,
  GraphNodeRow,
  GraphNodeType,
  GraphRelation,
} from "./types";

const DECAY_HALF_LIFE = 30 * 24 * 60 * 60 * 1000; // 30 days

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

export function nodeId(type: GraphNodeType, key: string): string {
  return `${type}:${normKey(key)}`;
}

function edgeKey(
  aType: GraphNodeType,
  a: string,
  bType: GraphNodeType,
  b: string,
  rel: GraphRelation,
): string {
  const left = nodeId(aType, a);
  const right = nodeId(bType, b);
  const [x, y] = left < right ? [left, right] : [right, left];
  return `${x}::${y}::${rel}`;
}

interface NodeSpec {
  type: GraphNodeType;
  key: string;
  label?: string;
  weight?: number;
}

interface EdgeSpec {
  aType: GraphNodeType;
  a: string;
  bType: GraphNodeType;
  b: string;
  rel: GraphRelation;
  weight?: number;
}

async function upsertNodes(nodes: NodeSpec[], now: number): Promise<void> {
  if (!nodes.length) return;
  // Dedupe by id within this batch.
  const map = new Map<string, NodeSpec>();
  for (const n of nodes) {
    const id = nodeId(n.type, n.key);
    const prev = map.get(id);
    if (!prev) map.set(id, n);
    else prev.weight = (prev.weight ?? 1) + (n.weight ?? 1);
  }
  const ids = [...map.keys()];
  const existing = await db.graphNodes.bulkGet(ids);
  const rows: GraphNodeRow[] = ids.map((id, i) => {
    const spec = map.get(id)!;
    const prev = existing[i];
    const add = spec.weight ?? 1;
    return prev
      ? { ...prev, weight: prev.weight + add, lastSeen: now, label: spec.label ?? prev.label }
      : {
          id,
          type: spec.type,
          key: normKey(spec.key),
          label: spec.label ?? spec.key,
          weight: add,
          firstSeen: now,
          lastSeen: now,
        };
  });
  await db.graphNodes.bulkPut(rows);
}

async function upsertEdges(edges: EdgeSpec[], now: number): Promise<void> {
  if (!edges.length) return;
  // Dedupe by id (undirected + rel).
  const map = new Map<string, { spec: EdgeSpec; weight: number }>();
  for (const e of edges) {
    const id = edgeKey(e.aType, e.a, e.bType, e.b, e.rel);
    const cur = map.get(id);
    if (cur) cur.weight += e.weight ?? 1;
    else map.set(id, { spec: e, weight: e.weight ?? 1 });
  }
  const ids = [...map.keys()];
  const existing = await db.graphEdges.bulkGet(ids);
  const rows: GraphEdgeRow[] = ids.map((id, i) => {
    const { spec, weight } = map.get(id)!;
    const prev = existing[i];
    // Canonical order (a<b).
    const left = nodeId(spec.aType, spec.a);
    const right = nodeId(spec.bType, spec.b);
    const [aFirst] = left < right ? [true] : [false];
    const A = aFirst ? spec : { ...spec, aType: spec.bType, a: spec.b, bType: spec.aType, b: spec.a };
    return prev
      ? { ...prev, weight: prev.weight + weight, lastSeen: now }
      : {
          id,
          aType: A.aType,
          a: normKey(A.a),
          bType: A.bType,
          b: normKey(A.b),
          rel: spec.rel,
          weight,
          firstSeen: now,
          lastSeen: now,
        };
  });
  await db.graphEdges.bulkPut(rows);
}

/** Rough session bucket: 3-hour window aligned to floor. Matches Timeline. */
function sessionKeyFor(ts: number): string {
  const bucket = Math.floor(ts / (3 * 60 * 60 * 1000));
  return `s_${bucket}`;
}

/**
 * Incremental update for one conversation. Safe to re-run.
 * Only touches edges/nodes implied by this conversation and its
 * knowledge/decisions/goals — never scans the full graph.
 */
export async function updateGraphForConversation(
  conversation: StoredConversation,
  knowledge?: KnowledgeRecord | null,
): Promise<void> {
  const now = Date.now();
  const convId = conversation.id;
  const projectId = (conversation as { projectId?: string }).projectId ?? null;
  const kr =
    knowledge ??
    (await db.knowledge.where("conversationId").equals(convId).first().catch(() => undefined)) ??
    null;

  const techs = kr?.technologies ?? [];
  const langs = kr?.languages ?? [];
  const topics = kr?.topics ?? [];
  const frameworks = (kr?.entityDetails ?? [])
    .filter((e) => e.type === "framework")
    .map((e) => e.name);
  const files = (kr?.codeBlocks ?? [])
    .map((c) => c.filename)
    .filter((f): f is string => !!f);
  const codeLangs = (kr?.codeBlocks ?? [])
    .map((c) => (c.language ?? "").toLowerCase())
    .filter(Boolean);

  const nodes: NodeSpec[] = [
    { type: "conversation", key: convId, label: conversation.title || "Untitled" },
    { type: "provider", key: conversation.provider, label: conversation.provider },
    { type: "session", key: sessionKeyFor(conversation.updatedAt) },
  ];
  if (projectId) nodes.push({ type: "project", key: projectId });
  if (kr) nodes.push({ type: "knowledge", key: kr.id });

  for (const t of techs) nodes.push({ type: "technology", key: t, label: t });
  for (const l of langs) nodes.push({ type: "language", key: l, label: l });
  for (const t of topics) nodes.push({ type: "topic", key: t, label: t });
  for (const f of frameworks) nodes.push({ type: "framework", key: f, label: f });
  for (const f of files) nodes.push({ type: "file", key: f, label: f });
  for (const l of codeLangs) nodes.push({ type: "code", key: l, label: l });

  const edges: EdgeSpec[] = [];

  // Provider chain
  edges.push({
    aType: "conversation", a: convId,
    bType: "provider", b: conversation.provider,
    rel: "provider-chain",
  });

  // Session grouping
  const sess = sessionKeyFor(conversation.updatedAt);
  edges.push({
    aType: "conversation", a: convId,
    bType: "session", b: sess,
    rel: "same-session",
  });

  // Project links
  if (projectId) {
    edges.push({ aType: "conversation", a: convId, bType: "project", b: projectId, rel: "same-project" });
    for (const t of techs) edges.push({ aType: "project", a: projectId, bType: "technology", b: t, rel: "uses" });
    for (const t of topics) edges.push({ aType: "project", a: projectId, bType: "topic", b: t, rel: "related-topic" });
    for (const f of files) edges.push({ aType: "project", a: projectId, bType: "file", b: f, rel: "shared-file" });
  }

  // Conversation ↔ knowledge facets
  if (kr) edges.push({ aType: "conversation", a: convId, bType: "knowledge", b: kr.id, rel: "derived-from" });
  for (const t of techs) edges.push({ aType: "conversation", a: convId, bType: "technology", b: t, rel: "mentions" });
  for (const l of langs) edges.push({ aType: "conversation", a: convId, bType: "language", b: l, rel: "implements" });
  for (const t of topics) edges.push({ aType: "conversation", a: convId, bType: "topic", b: t, rel: "related-topic" });
  for (const f of frameworks) edges.push({ aType: "conversation", a: convId, bType: "framework", b: f, rel: "uses" });
  for (const f of files) edges.push({ aType: "conversation", a: convId, bType: "file", b: f, rel: "shared-file" });
  for (const l of codeLangs) edges.push({ aType: "conversation", a: convId, bType: "code", b: l, rel: "shared-code" });

  // Framework depends-on language (heuristic co-occurrence)
  for (const fw of frameworks) {
    for (const l of langs) edges.push({ aType: "framework", a: fw, bType: "language", b: l, rel: "depends-on" });
  }
  // Tech ↔ Tech co-occurrence
  for (let i = 0; i < techs.length; i++) {
    for (let j = i + 1; j < techs.length; j++) {
      edges.push({ aType: "technology", a: techs[i], bType: "technology", b: techs[j], rel: "technology" });
    }
  }

  // Decisions active on this project → same-decision links
  if (projectId) {
    try {
      const decisions = await db.pieDecisions.toArray();
      for (const d of decisions.filter((d) => d.active)) {
        nodes.push({ type: "decision", key: d.id, label: d.current });
        edges.push({
          aType: "conversation", a: convId,
          bType: "decision", b: d.id,
          rel: "same-decision",
        });
      }
    } catch { /* empty pie table pre-migration */ }
  }

  // Goals — link this conversation to active goal chains it mentions.
  try {
    const goals = await db.pieGoals.where("status").equals("active").toArray();
    const text = `${conversation.title} ${topics.join(" ")}`.toLowerCase();
    for (const g of goals) {
      if (text.includes(g.key)) {
        nodes.push({ type: "goal", key: g.id, label: g.label });
        edges.push({
          aType: "conversation", a: convId,
          bType: "goal", b: g.id,
          rel: "same-goal",
        });
      }
    }
  } catch { /* ignore */ }

  await upsertNodes(nodes, now);
  await upsertEdges(edges, now);
}

/**
 * Remove all edges/nodes anchored to this conversation. Facet nodes
 * (technology / topic / etc.) are left in place — they may still be
 * referenced by other conversations, and orphan cleanup runs lazily.
 */
export async function removeConversationFromGraph(conversationId: string): Promise<void> {
  const id = nodeId("conversation", conversationId);
  const [asA, asB] = await Promise.all([
    db.graphEdges.where("a").equals(normKey(conversationId)).toArray(),
    db.graphEdges.where("b").equals(normKey(conversationId)).toArray(),
  ]);
  const ids = new Set<string>();
  for (const e of [...asA, ...asB]) if (e.a === normKey(conversationId) || e.b === normKey(conversationId)) ids.add(e.id);
  if (ids.size) await db.graphEdges.bulkDelete([...ids]);
  await db.graphNodes.delete(id);
}

/** Time-decayed weight for ranking. */
export function decayedWeight(edge: GraphEdgeRow, now = Date.now()): number {
  const age = Math.max(0, now - edge.lastSeen);
  const factor = Math.pow(0.5, age / DECAY_HALF_LIFE);
  return edge.weight * factor;
}
