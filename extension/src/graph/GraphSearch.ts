/**
 * GraphSearch — read-side helpers over the Memory Graph.
 *
 * Consumed by Ask Memlace, Continue Anywhere, Workspace, Project
 * Brain, and Universal Search. Never blocks — all queries hit
 * multiEntry indexes.
 */
import { db } from "@/lib/db";
import type { GraphEdgeRow, GraphNodeType, GraphRelation } from "./types";
import { decayedWeight, nodeId } from "./GraphEngine";

export interface GraphNeighbour {
  id: string;
  type: GraphNodeType;
  key: string;
  rel: GraphRelation;
  weight: number;
}

async function edgesTouching(type: GraphNodeType, key: string): Promise<GraphEdgeRow[]> {
  const k = key.toLowerCase();
  const [asA, asB] = await Promise.all([
    db.graphEdges.where("a").equals(k).toArray(),
    db.graphEdges.where("b").equals(k).toArray(),
  ]);
  // Filter by side type so we don't mix `conversation:foo` with `topic:foo`.
  const seen = new Set<string>();
  const out: GraphEdgeRow[] = [];
  for (const e of [...asA, ...asB]) {
    if (seen.has(e.id)) continue;
    const matches = (e.a === k && e.aType === type) || (e.b === k && e.bType === type);
    if (matches) { seen.add(e.id); out.push(e); }
  }
  return out;
}

export async function neighbours(
  type: GraphNodeType,
  key: string,
  opts: { rel?: GraphRelation | GraphRelation[]; limit?: number } = {},
): Promise<GraphNeighbour[]> {
  const edges = await edgesTouching(type, key);
  const rels = opts.rel
    ? new Set(Array.isArray(opts.rel) ? opts.rel : [opts.rel])
    : null;
  const now = Date.now();
  const k = key.toLowerCase();
  const results: GraphNeighbour[] = [];
  for (const e of edges) {
    if (rels && !rels.has(e.rel)) continue;
    const isA = e.a === k && e.aType === type;
    const nType = isA ? e.bType : e.aType;
    const nKey = isA ? e.b : e.a;
    results.push({
      id: nodeId(nType, nKey),
      type: nType,
      key: nKey,
      rel: e.rel,
      weight: decayedWeight(e, now),
    });
  }
  results.sort((a, b) => b.weight - a.weight);
  return typeof opts.limit === "number" ? results.slice(0, opts.limit) : results;
}

/**
 * Breadth-first expansion from one or more seed nodes. Returns node
 * ids weighted by aggregated (decayed) edge weight — used to boost
 * search candidates without executing a full graph traversal at
 * query time.
 */
export async function expand(
  seeds: Array<{ type: GraphNodeType; key: string }>,
  opts: { depth?: number; limit?: number } = {},
): Promise<Map<string, number>> {
  const depth = Math.max(1, Math.min(3, opts.depth ?? 2));
  const scores = new Map<string, number>();
  let frontier: Array<{ type: GraphNodeType; key: string; w: number }> = seeds.map((s) => ({
    ...s, w: 1,
  }));
  for (let d = 0; d < depth; d++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const nbrs = await neighbours(node.type, node.key, { limit: 24 });
      for (const n of nbrs) {
        const contribution = (node.w * n.weight) / (d + 1);
        scores.set(n.id, (scores.get(n.id) ?? 0) + contribution);
        // Only walk deeper through non-terminal facets.
        if (d < depth - 1 && n.type !== "conversation") {
          next.push({ type: n.type, key: n.key, w: contribution });
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  if (typeof opts.limit === "number") {
    const trimmed = new Map(
      [...scores].sort((a, b) => b[1] - a[1]).slice(0, opts.limit),
    );
    return trimmed;
  }
  return scores;
}

/**
 * For a set of candidate conversation ids, return a boost score
 * derived from graph proximity to the seed. Merges seamlessly into
 * existing ranking functions:
 *   finalScore = baseScore + graphBoost * α
 */
export async function graphBoost(
  seeds: Array<{ type: GraphNodeType; key: string }>,
  candidateConvIds: string[],
): Promise<Map<string, number>> {
  if (!seeds.length || !candidateConvIds.length) return new Map();
  const scores = await expand(seeds, { depth: 2 });
  const out = new Map<string, number>();
  for (const id of candidateConvIds) {
    const s = scores.get(nodeId("conversation", id));
    if (s) out.set(id, s);
  }
  return out;
}

export async function graphStats(): Promise<{ nodes: number; edges: number }> {
  const [nodes, edges] = await Promise.all([
    db.graphNodes.count().catch(() => 0),
    db.graphEdges.count().catch(() => 0),
  ]);
  return { nodes, edges };
}
