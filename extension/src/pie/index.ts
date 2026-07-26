/**
 * Personal Intelligence Engine — public surface.
 *
 * Architecture:
 *   Conversation saved ──► LearningLoop ──► {
 *     PreferenceEngine, DecisionMemory, GoalEvolution,
 *     KnowledgeConfidence, RelationshipEngine, VocabularyEngine
 *   }
 *   Search / Ask Memlace / Continue Anywhere read through:
 *     - expandQuery()          (vocabulary)
 *     - buildEvolvedContext()  (context evolution)
 *     - confidenceOf()         (ranking)
 *     - freshness()            (knowledge decay)
 *
 * All data is local, incremental, and reuses existing Dexie
 * transactions. No MutationObservers. No telemetry. No network.
 */
export { onConversationLearned } from "./LearningLoop";
export { topPreferences, preferredProvider } from "./PreferenceEngine";
export { listActiveDecisions } from "./DecisionMemory";
export { listGoals } from "./GoalEvolution";
export { confidenceOf, highConfidence } from "./KnowledgeConfidence";
export { neighbours } from "./RelationshipEngine";
export { expandQuery, invalidateVocabularyCache } from "./VocabularyEngine";
export { freshness } from "./KnowledgeDecay";
export { buildEvolvedContext, renderPreamble } from "./ContextEvolution";
export { collectPieStats } from "./Diagnostics";
export type * from "./types";
