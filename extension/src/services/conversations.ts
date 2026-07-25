import { db, uid } from "@/lib/db";
import type {
  ProviderId,
  StoredConversation,
  StoredConvMessage,
} from "@/types";
import type { CapturedConversation } from "@/providers/base/types";
import { hashConversation } from "@/providers/base/hash";
import { onConversationSaved, onConversationDeleted } from "@/knowledge/engine";

/* ------------------------------------------------------------------ *
 * In-memory message index (lazy, invalidated on write). Lets universal
 * search scan message bodies for thousands of conversations without a
 * fresh IndexedDB read on every keystroke.
 * ------------------------------------------------------------------ */

interface MessageIndex {
  version: number;
  /** conversationId -> lower-cased concatenated body text. */
  bodies: Map<string, string>;
  /** conversationId -> original (case preserved) body text for snippets. */
  originals: Map<string, string>;
}

let indexVersion = 0;
let messageIndex: MessageIndex | null = null;
let indexPromise: Promise<MessageIndex> | null = null;

function invalidateIndex() {
  indexVersion += 1;
  messageIndex = null;
  indexPromise = null;
}

async function ensureIndex(): Promise<MessageIndex> {
  if (messageIndex && messageIndex.version === indexVersion) return messageIndex;
  if (indexPromise) return indexPromise;
  const version = indexVersion;
  indexPromise = (async () => {
    const rows = await db.convMessages.toArray();
    const bodies = new Map<string, string>();
    const originals = new Map<string, string>();
    for (const m of rows) {
      const text = m.markdown || m.content || "";
      if (!text) continue;
      const prev = originals.get(m.conversationId);
      const next = prev ? `${prev}\n${text}` : text;
      originals.set(m.conversationId, next);
      bodies.set(m.conversationId, next.toLowerCase());
    }
    const built: MessageIndex = { version, bodies, originals };
    messageIndex = built;
    indexPromise = null;
    return built;
  })();
  return indexPromise;
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

export interface SaveConversationOptions {
  hash?: string;
  source: "manual" | "auto" | "initial";
  /** Persist inline image URLs. Default true. */
  saveImages?: boolean;
  /** Persist attachment metadata. Default true. */
  saveAttachments?: boolean;
}

export async function saveConversation(
  captured: CapturedConversation,
  opts: SaveConversationOptions = { source: "manual" },
): Promise<{ conversation: StoredConversation; changed: boolean; created: boolean }> {
  const hash = opts.hash ?? hashConversation(captured);
  const keepImages = opts.saveImages !== false;
  const keepAttachments = opts.saveAttachments !== false;
  const now = Date.now();

  const result = await db.transaction("rw", db.conversations, db.convMessages, async () => {
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

    await db.convMessages.where("conversationId").equals(conversation.id).delete();
    const rows: StoredConvMessage[] = captured.messages.map((m) => ({
      id: uid("msg"),
      conversationId: conversation.id,
      providerMessageId: m.id,
      role: m.role,
      content: m.content,
      markdown: m.markdown,
      order: m.order,
      images: keepImages ? m.images : [],
      attachments: keepAttachments ? m.attachments : [],
      metadata: m.metadata,
      createdAt: now,
    }));
    if (rows.length) await db.convMessages.bulkAdd(rows);

    return { conversation, changed: true, created: !existing };
  });

  if (result.changed) {
    invalidateIndex();
    // Fire-and-forget knowledge indexing. Failures are logged only —
    // knowledge is derived data, never blocks the primary save.
    onConversationSaved(result.conversation).catch((err) =>
      console.warn("[memlace] knowledge indexing failed", err),
    );
    // Optional AI enrichment (Phase 8). Never blocks the save, never
    // runs unless the user opted in via AI settings.
    void (async () => {
      try {
        const { getSettings } = await import("@/ai/AIManager");
        const s = await getSettings();
        if (!s.enabled || !s.autoEnrich) return;
        const { aiQueue } = await import("@/ai/AIQueue");
        const { enrichConversation } = await import("@/ai/MemoryEngine");
        await aiQueue.enqueue({
          kind: "memory",
          label: `Enrich: ${result.conversation.title || "(untitled)"}`,
          conversationId: result.conversation.id,
          estInputTokens: 4000,
          estOutputTokens: 900,
          runner: async () => enrichConversation(result.conversation.id),
        });
      } catch (err) {
        console.warn("[memlace] ai enrichment skipped", err);
      }
    })();
  }
  if (result.created) {
    void import("@/services/onboarding").then((m) =>
      m.markChecklist("savedConversation"),
    );
  }
  return result;
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
  invalidateIndex();
  onConversationDeleted(id).catch((err) =>
    console.warn("[memlace] knowledge cleanup failed", err),
  );
}

/* ------------------------------------------------------------------ *
 * Universal search
 * ------------------------------------------------------------------ */

export type ConvSort = "newest" | "oldest" | "alphabetical";

export interface ConvSearchOptions {
  query?: string;
  providers?: ProviderId[];
  /** Inclusive lower bound on updatedAt (ms). */
  dateFrom?: number | null;
  /** Inclusive upper bound on updatedAt (ms). */
  dateTo?: number | null;
  sort?: ConvSort;
}

export type MatchField = "title" | "message" | "provider" | "model";

export interface ConvSnippet {
  text: string;
  matchStart: number;
  matchLength: number;
}

export interface ConvSearchHit {
  conversation: StoredConversation;
  matchedIn: MatchField | null;
  snippet: ConvSnippet | null;
}

function makeSnippet(source: string, query: string, hint = -1): ConvSnippet | null {
  const lower = source.toLowerCase();
  const q = query.toLowerCase();
  const at = hint >= 0 ? hint : lower.indexOf(q);
  if (at < 0) return null;
  const radius = 60;
  const rawStart = Math.max(0, at - radius);
  const rawEnd = Math.min(source.length, at + q.length + radius);
  const leftEll = rawStart > 0;
  const rightEll = rawEnd < source.length;
  const body = source.slice(rawStart, rawEnd).replace(/\s+/g, " ").trim();
  const prefix = leftEll ? "… " : "";
  const suffix = rightEll ? " …" : "";
  const text = `${prefix}${body}${suffix}`;
  // Recompute the highlight position inside the composed snippet.
  const matchStart = text.toLowerCase().indexOf(q);
  return { text, matchStart, matchLength: q.length };
}

export async function searchConversations(
  opts: ConvSearchOptions = {},
): Promise<ConvSearchHit[]> {
  const all = await db.conversations.toArray();
  const query = (opts.query || "").trim();
  const q = query.toLowerCase();
  const providers = opts.providers && opts.providers.length ? new Set(opts.providers) : null;
  const from = opts.dateFrom ?? null;
  const to = opts.dateTo ?? null;

  const filtered = all.filter((c) => {
    if (providers && !providers.has(c.provider)) return false;
    if (from !== null && c.updatedAt < from) return false;
    if (to !== null && c.updatedAt > to) return false;
    return true;
  });

  let hits: ConvSearchHit[];
  if (!q) {
    hits = filtered.map((c) => ({ conversation: c, matchedIn: null, snippet: null }));
  } else {
    const index = await ensureIndex();
    hits = [];
    for (const c of filtered) {
      const title = c.title.toLowerCase();
      const provider = c.provider.toLowerCase();
      const model = (c.model || "").toLowerCase();

      if (title.includes(q)) {
        hits.push({
          conversation: c,
          matchedIn: "title",
          snippet: null,
        });
        continue;
      }
      const body = index.bodies.get(c.id) || "";
      const bodyIdx = body.indexOf(q);
      if (bodyIdx >= 0) {
        const original = index.originals.get(c.id) || "";
        hits.push({
          conversation: c,
          matchedIn: "message",
          snippet: makeSnippet(original, query, bodyIdx),
        });
        continue;
      }
      if (provider.includes(q)) {
        hits.push({ conversation: c, matchedIn: "provider", snippet: null });
        continue;
      }
      if (model.includes(q)) {
        hits.push({ conversation: c, matchedIn: "model", snippet: null });
        continue;
      }
    }
  }

  const sort: ConvSort = opts.sort ?? "newest";
  hits.sort((a, b) => {
    if (sort === "oldest") return a.conversation.updatedAt - b.conversation.updatedAt;
    if (sort === "alphabetical")
      return a.conversation.title.localeCompare(b.conversation.title, undefined, {
        sensitivity: "base",
      });
    return b.conversation.updatedAt - a.conversation.updatedAt;
  });
  return hits;
}
