/**
 * PIE diagnostics — surface-level counts only, no implementation detail.
 */
import { db } from "@/lib/db";
import type { PieStats } from "./types";
import type { ProviderId } from "@/types";
import { preferredProvider, topPreferences } from "./PreferenceEngine";

export async function collectPieStats(): Promise<PieStats> {
  const [preferences, decisions, goals, vocabulary, relationships, confident, provider, langs, fws] =
    await Promise.all([
      db.piePreferences.count(),
      db.pieDecisions.count(),
      db.pieGoals.count(),
      db.pieVocabulary.count(),
      db.pieRelationships.count(),
      db.pieConfidence.where("score").aboveOrEqual(0.4).count().catch(() => 0),
      preferredProvider(),
      topPreferences("language", 1),
      topPreferences("framework", 1),
    ]);
  return {
    preferences,
    decisions,
    goals,
    vocabulary,
    relationships,
    confident,
    topProvider: (provider as ProviderId) ?? null,
    topLanguage: langs[0]?.value ?? null,
    topFramework: fws[0]?.value ?? null,
  };
}
