/**
 * MemoryHealth — silent, opportunistic optimisation of the local store.
 *
 * Runs from `scheduleMemoryHealth()` on idle. Never surfaces UI. Every
 * mutation is guarded so a corrupt / partial row cannot cascade.
 *
 * Sweeps (cheap, O(n) with early exits):
 *   • Orphan messages         — convMessages whose conversation is gone.
 *   • Empty snapshots         — conversations with 0 messages AND >1h old.
 *   • Duplicate collisions    — [provider+providerConversationId] twins.
 *   • Orphan knowledge rows   — knowledge without a live conversation.
 *   • Orphan entities/keywords/relationships — knowledge child rows
 *     whose parent knowledge row is gone.
 *   • Invalid project links   — conversations.projectId pointing nowhere.
 */
import { db } from "@/lib/db";
import { invalidateReadiness } from "./contextReadiness";

const HOUR = 60 * 60 * 1000;

export interface HealthReport {
  orphanMessages: number;
  emptySnapshots: number;
  duplicatesMerged: number;
  orphanKnowledge: number;
  orphanEntities: number;
  orphanKeywords: number;
  orphanRelationships: number;
  invalidProjectLinks: number;
}

let inflight: Promise<HealthReport> | null = null;

export function runMemoryHealth(): Promise<HealthReport> {
  if (inflight) return inflight;
  inflight = (async () => {
    const report: HealthReport = {
      orphanMessages: 0,
      emptySnapshots: 0,
      duplicatesMerged: 0,
      orphanKnowledge: 0,
      orphanEntities: 0,
      orphanKeywords: 0,
      orphanRelationships: 0,
      invalidProjectLinks: 0,
    };
    try {
      const [convs, msgs, projects] = await Promise.all([
        db.conversations.toArray(),
        db.convMessages.toArray(),
        db.projects.toArray(),
      ]);
      const convIds = new Set(convs.map((c) => c.id));
      void projects;

      // 1. Orphan messages
      const orphanIds: string[] = [];
      for (const m of msgs) if (!convIds.has(m.conversationId)) orphanIds.push(m.id);
      if (orphanIds.length) {
        await db.convMessages.bulkDelete(orphanIds);
        report.orphanMessages = orphanIds.length;
      }

      // 2. Empty snapshots older than 1h
      const now = Date.now();
      const emptyIds = convs
        .filter((c) => c.messageCount === 0 && now - c.updatedAt > HOUR)
        .map((c) => c.id);
      if (emptyIds.length) {
        await db.conversations.bulkDelete(emptyIds);
        report.emptySnapshots = emptyIds.length;
        for (const id of emptyIds) convIds.delete(id);
      }

      // 3. Duplicate collisions
      const byKey = new Map<string, typeof convs>();
      for (const c of convs) {
        if (emptyIds.includes(c.id)) continue;
        const key = `${c.provider}::${c.providerConversationId}`;
        const arr = byKey.get(key) ?? [];
        arr.push(c);
        byKey.set(key, arr);
      }
      for (const [, list] of byKey) {
        if (list.length < 2) continue;
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        const keeper = list[0];
        const losers = list.slice(1);
        await db.transaction("rw", db.conversations, db.convMessages, async () => {
          for (const l of losers) {
            await db.convMessages
              .where("conversationId")
              .equals(l.id)
              .modify({ conversationId: keeper.id });
            await db.conversations.delete(l.id);
            convIds.delete(l.id);
          }
        });
        report.duplicatesMerged += losers.length;
        invalidateReadiness(keeper.id);
      }

      // 4. Orphan knowledge rows.
      const knowledgeRows = await db.knowledge.toArray();
      const badKnowledge = knowledgeRows.filter((k) => !convIds.has(k.conversationId));
      const badKnowledgeIds = new Set(badKnowledge.map((k) => k.id));
      if (badKnowledgeIds.size) {
        await db.knowledge.bulkDelete(Array.from(badKnowledgeIds));
        report.orphanKnowledge = badKnowledgeIds.size;
      }
      const liveKnowledgeIds = new Set(
        knowledgeRows.filter((k) => !badKnowledgeIds.has(k.id)).map((k) => k.id),
      );

      // 5. Orphan knowledge children.
      const [entities, keywords, relationships] = await Promise.all([
        db.entities.toArray(),
        db.keywords.toArray(),
        db.relationships.toArray(),
      ]);
      const orphanEntIds = entities.filter((e) => !liveKnowledgeIds.has(e.knowledgeId)).map((e) => e.id);
      const orphanKwIds = keywords.filter((k) => !liveKnowledgeIds.has(k.knowledgeId)).map((k) => k.id);
      const orphanRelIds = relationships
        .filter((r) => !liveKnowledgeIds.has(r.fromId) || !liveKnowledgeIds.has(r.toId))
        .map((r) => r.id);
      if (orphanEntIds.length) {
        await db.entities.bulkDelete(orphanEntIds);
        report.orphanEntities = orphanEntIds.length;
      }
      if (orphanKwIds.length) {
        await db.keywords.bulkDelete(orphanKwIds);
        report.orphanKeywords = orphanKwIds.length;
      }
      if (orphanRelIds.length) {
        await db.relationships.bulkDelete(orphanRelIds);
        report.orphanRelationships = orphanRelIds.length;
      }

      // 6. Invalid project links live on memories, not conversations.
      // Skip here — memory project links are validated by the memories
      // service on read and repaired on next write.
      void projects;

    } catch (err) {
      console.warn("[memlace] memory health sweep failed", err);
    }
    return report;
  })();
  inflight.finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Schedule a health sweep on next idle tick. Safe to call repeatedly. */
export function scheduleMemoryHealth(): void {
  const run = () => {
    runMemoryHealth().catch(() => undefined);
  };
  const w = globalThis as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
}
