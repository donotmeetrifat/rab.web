import { db, uid } from "@/lib/db";
import type { StoredConversation, StoredConvMessage } from "@/types";
import type { CapturedConversation } from "@/providers/base/types";
import { hashConversation } from "@/providers/base/hash";

/**
 * Persist a captured conversation. Upserts by (provider, conversationId).
 * De-dupes messages by their provider-scoped id. Never inserts a duplicate
 * row and never overwrites a newer local title with an empty one.
 */
export async function saveConversation(
  captured: CapturedConversation,
  opts: { hash?: string; source: "manual" | "auto" | "initial" } = { source: "manual" },
): Promise<{ conversation: StoredConversation; changed: boolean; created: boolean }> {
  const hash = opts.hash ?? hashConversation(captured);
  const now = Date.now();

  return db.transaction("rw", db.conversations, db.convMessages, async () => {
    const existing = await db.conversations
      .where("[provider+providerConversationId]")
      .equals([captured.provider, captured.conversationId])
      .first();

    if (existing && existing.hash === hash) {
      return { conversation: existing, changed: false, created: false };
    }

    const conversation: StoredConversation = existing
      ? {
          ...existing,
          title: captured.title || existing.title,
          url: captured.url || existing.url,
          model: captured.model ?? existing.model,
          messageCount: captured.messages.length,
          hash,
          lastSyncAt: now,
          updatedAt: now,
        }
      : {
          id: uid("conv"),
          provider: captured.provider,
          providerConversationId: captured.conversationId,
          title: captured.title || "Untitled conversation",
          url: captured.url,
          model: captured.model,
          messageCount: captured.messages.length,
          hash,
          createdAt: now,
          updatedAt: now,
          lastSyncAt: now,
          source: opts.source,
        };

    await db.conversations.put(conversation);

    // Replace-in-place strategy: cheaper than diffing, correct for edits/regens.
    await db.convMessages.where("conversationId").equals(conversation.id).delete();
    const rows: StoredConvMessage[] = captured.messages.map((m) => ({
      id: uid("msg"),
      conversationId: conversation.id,
      providerMessageId: m.id,
      role: m.role,
      content: m.content,
      markdown: m.markdown,
      order: m.order,
      images: m.images,
      attachments: m.attachments,
      metadata: m.metadata,
      createdAt: now,
    }));
    if (rows.length) await db.convMessages.bulkAdd(rows);

    return { conversation, changed: true, created: !existing };
  });
}

export async function listConversations(): Promise<StoredConversation[]> {
  const rows = await db.conversations.toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(id: string): Promise<StoredConversation | undefined> {
  return db.conversations.get(id);
}

export async function getConversationMessages(id: string): Promise<StoredConvMessage[]> {
  const rows = await db.convMessages.where("conversationId").equals(id).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

export async function deleteConversation(id: string): Promise<void> {
  await db.transaction("rw", db.conversations, db.convMessages, async () => {
    await db.convMessages.where("conversationId").equals(id).delete();
    await db.conversations.delete(id);
  });
}
