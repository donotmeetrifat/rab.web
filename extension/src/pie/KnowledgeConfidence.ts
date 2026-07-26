/**
 * KnowledgeConfidence — blends five signals into a 0..1 score per
 * technology/topic. Numbers are never surfaced in the UI; downstream
 * consumers (ranking, ContextEvolution) treat higher = more trusted.
 */
import { db } from "@/lib/db";
import type { KnowledgeRecord } from "@/knowledge/types";
import type { StoredConversation } from "@/types";
import type { PieConfidenceRow } from "./types";

const MS_PER_DAY = 86_400_000;

function recencyWeight(lastSeen: number, now: number): number {
  const days = Math.max(0, (now - lastSeen) / MS_PER_DAY);
  return Math.pow(0.5, days / 21); // 3-week half-life
}

interface Bump {
  kind: PieConfidenceRow["kind"];
  name: string;
  repetition: number;
  codeRefs: number;
  crossProvider: number;
  projectRelevance: number;
}

export async function updateConfidenceFor(
  conversation: StoredConversation,
  knowledge: KnowledgeRecord | null,
): Promise<void> {
  if (!knowledge) return;
  const now = Date.now();

  const bumps = new Map<string, Bump>();
  const add = (kind: PieConfidenceRow["kind"], name: string, count: number, code: number) => {
    const id = name.toLowerCase();
    const prev = bumps.get(id);
    if (prev) {
      prev.repetition += count;
      prev.codeRefs += code;
    } else {
      bumps.set(id, {
        kind,
        name: id,
        repetition: count,
        codeRefs: code,
        crossProvider: 1,
        projectRelevance: 0,
      });
    }
  };

  for (const e of knowledge.entityDetails) {
    const kind: PieConfidenceRow["kind"] =
      e.type === "language" ? "language" :
      e.type === "framework" ? "framework" :
      e.type === "topic" ? "topic" : "technology";
    const codeHits = knowledge.codeBlocks.filter(
      (c) => (c.language || "").toLowerCase() === e.name.toLowerCase(),
    ).length;
    add(kind, e.name, e.count, codeHits);
  }

  const projectRel = await (async () => {
    // A confidence signal: is this conversation attached to a real project?
    // (project detection may have set it already or not — either is fine)
    const c = await db.conversations.get(conversation.id);
    return c && (c as unknown as { projectId?: string }).projectId ? 1 : 0;
  })();

  const ids = Array.from(bumps.keys());
  const existing = await db.pieConfidence.bulkGet(ids);
  const rows: PieConfidenceRow[] = [];
  bumps.forEach((b, id) => {
    const prev = existing.find((r) => r?.id === id);
    const decay = prev ? recencyWeight(prev.updatedAt, now) : 0;
    const repetition = (prev ? prev.repetition * decay : 0) + b.repetition;
    const recency = 1; // fresh update
    const projectRelevance = (prev ? prev.projectRelevance * decay : 0) + projectRel;
    const decisionSupport = prev?.decisionSupport ?? 0;
    const crossProvider = (prev ? prev.crossProvider * decay : 0) + 1;
    const codeRefs = (prev ? prev.codeRefs * decay : 0) + b.codeRefs;

    // Blended score, saturating tanh so single spikes never dominate.
    const raw =
      0.30 * Math.tanh(repetition / 6) +
      0.20 * recency +
      0.15 * Math.tanh(projectRelevance / 3) +
      0.10 * Math.tanh(decisionSupport / 2) +
      0.10 * Math.tanh(crossProvider / 3) +
      0.15 * Math.tanh(codeRefs / 4);

    rows.push({
      id,
      kind: b.kind,
      score: Math.min(1, raw),
      repetition,
      recency,
      projectRelevance,
      decisionSupport,
      crossProvider,
      codeRefs,
      updatedAt: now,
    });
  });
  if (rows.length) await db.pieConfidence.bulkPut(rows);
}

/** Reinforce decision-support signal after DecisionMemory has updated. */
export async function reinforceFromDecisions(topics: string[]): Promise<void> {
  if (!topics.length) return;
  const now = Date.now();
  const rows = await db.pieConfidence.bulkGet(topics.map((t) => t.toLowerCase()));
  const updates: PieConfidenceRow[] = [];
  rows.forEach((r) => {
    if (!r) return;
    updates.push({ ...r, decisionSupport: r.decisionSupport + 1, updatedAt: now });
  });
  if (updates.length) await db.pieConfidence.bulkPut(updates);
}

export async function confidenceOf(name: string): Promise<number> {
  const r = await db.pieConfidence.get(name.toLowerCase());
  return r?.score ?? 0;
}

export async function highConfidence(min = 0.4, limit = 20): Promise<PieConfidenceRow[]> {
  const all = await db.pieConfidence.toArray();
  return all.filter((r) => r.score >= min).sort((a, b) => b.score - a.score).slice(0, limit);
}
