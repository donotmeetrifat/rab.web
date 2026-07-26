/**
 * LearningLoop — single entry point invoked by the conversation save
 * pipeline. Runs every PIE engine sequentially inside one micro-batch
 * per conversation so writes coalesce and no extra observers are needed.
 *
 * All work is asynchronous, best-effort, and never blocks the save.
 */
import { db } from "@/lib/db";
import type { StoredConversation } from "@/types";
import { updatePreferencesFor } from "./PreferenceEngine";
import { updateDecisionsFor } from "./DecisionMemory";
import { updateGoalsFor } from "./GoalEvolution";
import { updateConfidenceFor, reinforceFromDecisions } from "./KnowledgeConfidence";
import { updateRelationshipsFor } from "./RelationshipEngine";
import { updateVocabularyFor, invalidateVocabularyCache } from "./VocabularyEngine";

const inflight = new Map<string, Promise<void>>();

export function onConversationLearned(conversation: StoredConversation): Promise<void> {
  const existing = inflight.get(conversation.id);
  if (existing) return existing;
  const run = (async () => {
    try {
      const [knowledge, messages] = await Promise.all([
        db.knowledge.where("conversationId").equals(conversation.id).first(),
        db.convMessages.where("conversationId").equals(conversation.id).toArray(),
      ]);
      messages.sort((a, b) => a.order - b.order);

      // Sequential to keep IDB transaction pressure low and let later
      // stages read the writes from earlier ones (e.g. decisions →
      // confidence reinforcement).
      await updatePreferencesFor(conversation, knowledge ?? null, messages);
      await updateDecisionsFor(conversation, messages);
      await updateGoalsFor(conversation, messages);
      await updateConfidenceFor(conversation, knowledge ?? null);

      // Reinforce confidence for topics that just gained a decision.
      const decisions = await db.pieDecisions.toArray();
      const recentTopics = decisions
        .filter((d) => Date.now() - d.updatedAt < 5_000)
        .map((d) => d.current);
      if (recentTopics.length) await reinforceFromDecisions(recentTopics);

      await updateRelationshipsFor(conversation, knowledge ?? null);
      await updateVocabularyFor(conversation, messages);
      invalidateVocabularyCache();
    } catch (err) {
      console.warn("[memlace] pie learning loop failed", err);
    }
  })().finally(() => {
    inflight.delete(conversation.id);
  });
  inflight.set(conversation.id, run);
  return run;
}
