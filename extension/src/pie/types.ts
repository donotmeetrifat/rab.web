/**
 * Personal Intelligence Engine — shared types.
 *
 * All PIE data is local, lightweight metadata derived from the user's
 * own work. Nothing here is exposed as a raw number in the UI.
 */
import type { ProviderId } from "@/types";

export interface PiePreferenceRow {
  /** Composite key `${kind}:${value}` */
  id: string;
  kind:
    | "language"
    | "framework"
    | "database"
    | "cloud"
    | "ai"
    | "topic"
    | "provider"
    | "responseFormat"
    | "style";
  value: string;
  /** Exponentially decayed strength score (0..∞). */
  score: number;
  /** Raw occurrence count over the lifetime of the user's data. */
  count: number;
  /** Distinct conversation ids that contributed. */
  conversationIds: string[];
  firstSeen: number;
  lastSeen: number;
  updatedAt: number;
}

export interface PieDecisionRow {
  id: string;
  /** Stable topic key (lower-case, e.g. `database`, `auth`, `framework`). */
  topic: string;
  /** Latest chosen value, e.g. `Supabase with RLS`. */
  current: string;
  /** Chronological chain — oldest first. */
  chain: Array<{
    value: string;
    at: number;
    conversationId: string;
    source: "adopt" | "reject" | "consider";
  }>;
  active: boolean;
  updatedAt: number;
}

export interface PieGoalRow {
  id: string;
  /** Normalised goal phrase (lower-cased, trimmed). */
  key: string;
  /** Human-readable label from the first occurrence. */
  label: string;
  chain: Array<{ label: string; at: number; conversationId: string }>;
  status: "active" | "completed" | "archived";
  updatedAt: number;
}

export interface PieConfidenceRow {
  /** Knowledge entity name, e.g. `react`, `supabase`. */
  id: string;
  kind: "technology" | "topic" | "language" | "framework";
  /** 0..1 blended confidence — internal use only. */
  score: number;
  repetition: number;
  recency: number;
  projectRelevance: number;
  decisionSupport: number;
  crossProvider: number;
  codeRefs: number;
  updatedAt: number;
}

export interface PieVocabularyRow {
  /** The user's short-form, lower-cased. */
  id: string;
  short: string;
  /** Resolved expansion. */
  expansion: string;
  count: number;
  conversationIds: string[];
  updatedAt: number;
}

export interface PieRelationshipRow {
  /** Composite key `${aType}:${a}::${bType}:${b}` (a<b sorted). */
  id: string;
  aType: PieNodeType;
  a: string;
  bType: PieNodeType;
  b: string;
  weight: number;
  updatedAt: number;
}

export type PieNodeType =
  | "project"
  | "technology"
  | "topic"
  | "conversation"
  | "goal"
  | "decision"
  | "file";

export interface PieStats {
  preferences: number;
  decisions: number;
  goals: number;
  vocabulary: number;
  relationships: number;
  confident: number;
  topProvider: ProviderId | null;
  topLanguage: string | null;
  topFramework: string | null;
}
