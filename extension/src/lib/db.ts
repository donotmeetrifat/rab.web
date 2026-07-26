import Dexie, { type Table } from "dexie";
import type {
  Memory,
  Project,
  StoredConversation,
  StoredConvMessage,
} from "@/types";
import type {
  KnowledgeRecord,
  KnowledgeEntityRow,
  KnowledgeKeywordRow,
  KnowledgeRelationship,
} from "@/knowledge/types";
import type {
  AIConversationSummary,
  AIEmbeddingRow,
  AIPromptCacheRow,
} from "@/ai/types";
import type {
  PiePreferenceRow,
  PieDecisionRow,
  PieGoalRow,
  PieConfidenceRow,
  PieVocabularyRow,
  PieRelationshipRow,
} from "@/pie/types";
import type { GraphNodeRow, GraphEdgeRow } from "@/graph/types";

class MemlaceDB extends Dexie {
  projects!: Table<Project, string>;
  memories!: Table<Memory, string>;
  conversations!: Table<StoredConversation, string>;
  convMessages!: Table<StoredConvMessage, string>;
  knowledge!: Table<KnowledgeRecord, string>;
  entities!: Table<KnowledgeEntityRow, string>;
  keywords!: Table<KnowledgeKeywordRow, string>;
  relationships!: Table<KnowledgeRelationship, string>;
  aiSummaries!: Table<AIConversationSummary, string>;
  aiEmbeddings!: Table<AIEmbeddingRow, string>;
  aiPromptCache!: Table<AIPromptCacheRow, string>;
  piePreferences!: Table<PiePreferenceRow, string>;
  pieDecisions!: Table<PieDecisionRow, string>;
  pieGoals!: Table<PieGoalRow, string>;
  pieConfidence!: Table<PieConfidenceRow, string>;
  pieVocabulary!: Table<PieVocabularyRow, string>;
  pieRelationships!: Table<PieRelationshipRow, string>;
  graphNodes!: Table<GraphNodeRow, string>;
  graphEdges!: Table<GraphEdgeRow, string>;

  constructor() {
    super("memlace");

    this.version(1).stores({
      projects: "id, name, pinned, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, trashed, createdAt, updatedAt, *tags",
    });

    this.version(2)
      .stores({
        projects: "id, name, pinned, favorite, archived, updatedAt",
        memories:
          "id, projectId, provider, favorite, pinned, archived, trashed, createdAt, updatedAt, trashedAt, *tags",
      })
      .upgrade(async (tx) => {
        await tx
          .table<Memory>("memories")
          .toCollection()
          .modify((m) => {
            if (typeof m.pinned !== "boolean") m.pinned = false;
            if (typeof m.archived !== "boolean") m.archived = false;
            if (typeof m.trashedAt !== "number" && m.trashedAt !== null) {
              m.trashedAt = m.trashed ? m.updatedAt : null;
            }
          });
        await tx
          .table<Project>("projects")
          .toCollection()
          .modify((p) => {
            if (typeof p.favorite !== "boolean") p.favorite = false;
            if (typeof p.icon !== "string") p.icon = "folder";
          });
      });

    this.version(3).stores({
      projects: "id, name, pinned, favorite, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, pinned, archived, trashed, createdAt, updatedAt, trashedAt, *tags",
      conversations:
        "id, provider, providerConversationId, [provider+providerConversationId], updatedAt, createdAt",
      convMessages: "id, conversationId, order, role",
    });

    // v4 — Knowledge Engine (Phase 7). Aggregate arrays on `knowledge`
    // are multiEntry-indexed so we can query by tech/keyword/entity in
    // O(log n). `entities`/`keywords` are normalised rows for cross-
    // conversation aggregations. `relationships` reserves the graph
    // edges surface for future work.
    this.version(4).stores({
      projects: "id, name, pinned, favorite, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, pinned, archived, trashed, createdAt, updatedAt, trashedAt, *tags",
      conversations:
        "id, provider, providerConversationId, [provider+providerConversationId], updatedAt, createdAt",
      convMessages: "id, conversationId, order, role",
      knowledge:
        "id, &conversationId, provider, hash, updatedAt, *entities, *keywords, *technologies, *languages, *topics",
      entities: "id, knowledgeId, type, name, [type+name]",
      keywords: "id, knowledgeId, term",
      relationships: "id, fromId, toId, kind",
    });

    // v5 — AI Intelligence Layer (Phase 8). Everything AI-derived lives
    // in its own tables so a user who never enables AI incurs zero cost
    // and zero storage beyond the empty schema definitions.
    this.version(5).stores({
      projects: "id, name, pinned, favorite, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, pinned, archived, trashed, createdAt, updatedAt, trashedAt, *tags",
      conversations:
        "id, provider, providerConversationId, [provider+providerConversationId], updatedAt, createdAt",
      convMessages: "id, conversationId, order, role",
      knowledge:
        "id, &conversationId, provider, hash, updatedAt, *entities, *keywords, *technologies, *languages, *topics",
      entities: "id, knowledgeId, type, name, [type+name]",
      keywords: "id, knowledgeId, term",
      relationships: "id, fromId, toId, kind",
      aiSummaries: "id, conversationId, provider, model, hash, updatedAt",
      aiEmbeddings: "id, [scope+conversationId], conversationId, provider, model, hash, createdAt",
      aiPromptCache: "&hash, provider, model, createdAt",
    });

    // v6 — Personal Intelligence Engine (Phase 12.8). Six lightweight
    // tables of derived metadata. Never stores raw personal data — only
    // aggregates over the user's own conversations.
    this.version(6).stores({
      projects: "id, name, pinned, favorite, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, pinned, archived, trashed, createdAt, updatedAt, trashedAt, *tags",
      conversations:
        "id, provider, providerConversationId, [provider+providerConversationId], updatedAt, createdAt",
      convMessages: "id, conversationId, order, role",
      knowledge:
        "id, &conversationId, provider, hash, updatedAt, *entities, *keywords, *technologies, *languages, *topics",
      entities: "id, knowledgeId, type, name, [type+name]",
      keywords: "id, knowledgeId, term",
      relationships: "id, fromId, toId, kind",
      aiSummaries: "id, conversationId, provider, model, hash, updatedAt",
      aiEmbeddings: "id, [scope+conversationId], conversationId, provider, model, hash, createdAt",
      aiPromptCache: "&hash, provider, model, createdAt",
      piePreferences: "id, kind, value, score, updatedAt",
      pieDecisions: "id, topic, active, updatedAt",
      pieGoals: "id, key, status, updatedAt",
      pieConfidence: "id, kind, score, updatedAt",
      pieVocabulary: "id, short, updatedAt",
      pieRelationships: "id, aType, a, bType, b, weight, updatedAt",
    });

    // v7 — Memory Graph Engine (Phase 14.1). Two derived tables that
    // materialise the semantic graph across every saved object. Safe
    // to drop and rebuild from source tables.
    this.version(7).stores({
      projects: "id, name, pinned, favorite, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, pinned, archived, trashed, createdAt, updatedAt, trashedAt, *tags",
      conversations:
        "id, provider, providerConversationId, [provider+providerConversationId], updatedAt, createdAt",
      convMessages: "id, conversationId, order, role",
      knowledge:
        "id, &conversationId, provider, hash, updatedAt, *entities, *keywords, *technologies, *languages, *topics",
      entities: "id, knowledgeId, type, name, [type+name]",
      keywords: "id, knowledgeId, term",
      relationships: "id, fromId, toId, kind",
      aiSummaries: "id, conversationId, provider, model, hash, updatedAt",
      aiEmbeddings: "id, [scope+conversationId], conversationId, provider, model, hash, createdAt",
      aiPromptCache: "&hash, provider, model, createdAt",
      piePreferences: "id, kind, value, score, updatedAt",
      pieDecisions: "id, topic, active, updatedAt",
      pieGoals: "id, key, status, updatedAt",
      pieConfidence: "id, kind, score, updatedAt",
      pieVocabulary: "id, short, updatedAt",
      pieRelationships: "id, aType, a, bType, b, weight, updatedAt",
      graphNodes: "id, type, key, weight, lastSeen",
      graphEdges: "id, a, b, aType, bType, rel, weight, lastSeen",
    });
  }
}

export const db = new MemlaceDB();

/* ------------------------------------------------------------------ *
 * Debug instrumentation (Phase 14.2) — logging only.
 * Toggle: window.memlaceDebug = true  OR  localStorage.memlaceDebug="1"
 * ------------------------------------------------------------------ */
function _dbgOn(): boolean {
  try {
    const w = globalThis as unknown as { memlaceDebug?: boolean };
    if (w.memlaceDebug) return true;
  } catch { /* ignore */ }
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("memlaceDebug") === "1")
      return true;
  } catch { /* ignore */ }
  return false;
}
function _dlog(...args: unknown[]) { if (_dbgOn()) console.log("[Memlace][db]", ...args); }

db.on("ready", () => { _dlog("db.open() ready", { name: db.name, version: db.verno }); });
db.on("versionchange", (e) => { _dlog("versionchange", e); });
db.on("blocked", () => { _dlog("db blocked (another tab holds an older version)"); });
// Dexie transaction lifecycle.
// Signature: (mode, tables, transaction)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(db as any).on("txcommitted", (tx: unknown) => { _dlog("transaction committed", tx); });
try {
  db.use({
    stack: "dbcore",
    name: "memlace-tx-logger",
    create(down) {
      return {
        ...down,
        transaction(stores, mode) {
          _dlog("transaction start", { stores, mode });
          const tx = down.transaction(stores, mode);
          try {
            tx.addEventListener?.("abort", () => _dlog("transaction abort", { stores, mode }));
            tx.addEventListener?.("complete", () => _dlog("transaction end", { stores, mode }));
            tx.addEventListener?.("error", (ev: unknown) =>
              _dlog("transaction error", { stores, mode, ev }),
            );
          } catch { /* ignore listener attach failure */ }
          return tx;
        },
      };
    },
  });
} catch (err) {
  // Non-fatal — logging middleware only.
  console.warn("[Memlace][db] failed to attach tx logger", err);
}

export function uid(prefix = "id"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}
