/**
 * KnowledgeIndexer — persists extracted knowledge to Dexie. Idempotent:
 * given the same conversation hash the store is left untouched. Runs
 * inside a single rw transaction so partial writes cannot survive.
 */
import { db, uid } from "@/lib/db";
import type { StoredConvMessage, StoredConversation } from "@/types";
import { extractKnowledge } from "./extractor";
import type { KnowledgeRecord } from "./types";

export interface IndexResult {
  knowledgeId: string;
  changed: boolean;
  created: boolean;
}

export async function indexConversation(
  conversation: StoredConversation,
  messages?: StoredConvMessage[],
): Promise<IndexResult> {
  const msgs =
    messages ??
    (await db.convMessages.where("conversationId").equals(conversation.id).toArray());
  msgs.sort((a, b) => a.order - b.order);

  const extracted = extractKnowledge(conversation, msgs);
  const now = Date.now();

  return db.transaction(
    "rw",
    db.knowledge,
    db.entities,
    db.keywords,
    async () => {
      const existing = await db.knowledge
        .where("conversationId")
        .equals(conversation.id)
        .first();

      // Skip when the conversation hash hasn't moved — the extractor is
      // pure, so identical input → identical output.
      if (existing && existing.hash === conversation.hash) {
        return { knowledgeId: existing.id, changed: false, created: false };
      }

      const id = existing?.id ?? uid("kn");
      const record: KnowledgeRecord = {
        id,
        conversationId: conversation.id,
        provider: conversation.provider,
        title: conversation.title,
        hash: conversation.hash,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        entityDetails: extracted.entityDetails,
        keywordDetails: extracted.keywordDetails,
        codeBlocks: extracted.codeBlocks,
        links: extracted.links,
        attachments: extracted.attachments,
        stats: extracted.stats,
        entities: extracted.entities,
        keywords: extracted.keywords,
        technologies: extracted.technologies,
        languages: extracted.languages,
        topics: extracted.topics,
      };

      await db.knowledge.put(record);

      // Replace normalised lookup rows atomically.
      await db.entities.where("knowledgeId").equals(id).delete();
      if (extracted.entityDetails.length) {
        await db.entities.bulkAdd(
          extracted.entityDetails.map((e) => ({
            id: uid("ent"),
            knowledgeId: id,
            type: e.type,
            name: e.name,
            count: e.count,
          })),
        );
      }

      await db.keywords.where("knowledgeId").equals(id).delete();
      if (extracted.keywordDetails.length) {
        await db.keywords.bulkAdd(
          extracted.keywordDetails.map((k) => ({
            id: uid("kw"),
            knowledgeId: id,
            term: k.term,
            count: k.count,
            score: k.score,
          })),
        );
      }

      return { knowledgeId: id, changed: true, created: !existing };
    },
  );
}

/** Drop the knowledge row and lookup children for a conversation. */
export async function removeKnowledgeForConversation(conversationId: string): Promise<void> {
  await db.transaction("rw", db.knowledge, db.entities, db.keywords, async () => {
    const row = await db.knowledge.where("conversationId").equals(conversationId).first();
    if (!row) return;
    await db.entities.where("knowledgeId").equals(row.id).delete();
    await db.keywords.where("knowledgeId").equals(row.id).delete();
    await db.knowledge.delete(row.id);
  });
}

/**
 * Backfill knowledge for any conversation whose hash doesn't match
 * (or lacks) a knowledge row. Runs on a low-priority queue so it
 * never blocks bootstrap. Yields to the event loop between
 * conversations to keep the UI responsive.
 */
let backfillPromise: Promise<{ scanned: number; indexed: number }> | null = null;

export function backfillKnowledge(): Promise<{ scanned: number; indexed: number }> {
  if (backfillPromise) return backfillPromise;
  const run = (async () => {
    const conversations = await db.conversations.toArray();
    let indexed = 0;
    for (const c of conversations) {
      const existing = await db.knowledge.where("conversationId").equals(c.id).first();
      if (existing && existing.hash === c.hash) continue;
      await indexConversation(c);
      indexed++;
      // Yield so the popup / sidepanel can paint between iterations.
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    return { scanned: conversations.length, indexed };
  })();
  backfillPromise = run;
  run.finally(() => {
    backfillPromise = null;
  });
  return run;
}
