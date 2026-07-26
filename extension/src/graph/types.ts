/**
 * Memory Graph — types.
 *
 * Persistent semantic graph connecting every saved object. No UI.
 * Nodes and edges are derived data — safe to rebuild from source
 * tables (conversations, knowledge, pie*) at any time.
 */

export type GraphNodeType =
  | "project"
  | "conversation"
  | "session"
  | "knowledge"
  | "technology"
  | "language"
  | "framework"
  | "topic"
  | "goal"
  | "decision"
  | "file"
  | "code"
  | "provider";

export type GraphRelation =
  | "technology"
  | "depends-on"
  | "mentions"
  | "implements"
  | "uses"
  | "replaced-by"
  | "derived-from"
  | "same-project"
  | "same-session"
  | "same-goal"
  | "same-decision"
  | "related-topic"
  | "shared-code"
  | "shared-file"
  | "provider-chain";

export interface GraphNodeRow {
  /** `${type}:${key}` — lower-case key. */
  id: string;
  type: GraphNodeType;
  key: string;
  label: string;
  /** Rolling activity weight (decayed on read). */
  weight: number;
  firstSeen: number;
  lastSeen: number;
}

export interface GraphEdgeRow {
  /** `${a}::${b}::${rel}` — a<b sorted. */
  id: string;
  aType: GraphNodeType;
  a: string;
  bType: GraphNodeType;
  b: string;
  rel: GraphRelation;
  /** Reinforced on repeat co-occurrence. */
  weight: number;
  firstSeen: number;
  lastSeen: number;
}
