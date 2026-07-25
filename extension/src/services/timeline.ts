/**
 * Timeline — turns the flat conversations table into a continuous memory
 * feed. Groups by relative day bucket (Today / Yesterday / This Week /
 * This Month / Earlier) and, inside each bucket, clusters closely
 * related conversations into "Memory Sessions" that span providers.
 *
 * Everything here is pure derivation over already-persisted rows. The
 * caller decides whether to render the flat list (during search) or the
 * grouped timeline (default browse).
 */
import { db } from "@/lib/db";
import type { StoredConversation } from "@/types";

export type TimelineBucketId = "today" | "yesterday" | "week" | "month" | "earlier";

export interface MemorySession {
  id: string;
  /** e.g. "Morning Session", "Late Night Session". */
  label: string;
  startedAt: number;
  endedAt: number;
  conversations: StoredConversation[];
}

export interface TimelineBucket {
  id: TimelineBucketId;
  label: string;
  sessions: MemorySession[];
  /** Convenience: total conversations across sessions in this bucket. */
  count: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Max quiet gap inside a session before we start a new one. */
const SESSION_GAP = 3 * HOUR;
/** How many shared knowledge topics keep a session together across a longer gap. */
const TOPIC_BRIDGE = 2;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function bucketOf(now: number, ts: number): TimelineBucketId {
  const today = startOfDay(now);
  if (ts >= today) return "today";
  if (ts >= today - DAY) return "yesterday";
  if (ts >= today - 7 * DAY) return "week";
  if (ts >= today - 30 * DAY) return "month";
  return "earlier";
}

function sessionLabel(startedAt: number): string {
  const h = new Date(startedAt).getHours();
  if (h < 5) return "Late Night Session";
  if (h < 12) return "Morning Session";
  if (h < 17) return "Afternoon Session";
  if (h < 22) return "Evening Session";
  return "Late Night Session";
}

/** Load a convId → topic-set map for smart cross-provider grouping. */
async function loadTopicMap(): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  try {
    const rows = await db.knowledge.toArray();
    for (const r of rows) {
      const bag = new Set<string>();
      for (const t of r.topics ?? []) bag.add(t.toLowerCase());
      for (const t of r.technologies ?? []) bag.add(t.toLowerCase());
      if (bag.size) map.set(r.conversationId, bag);
    }
  } catch {
    // Knowledge table missing / migration in flight — degrade to
    // gap-only clustering. Never surface to the user.
  }
  return map;
}

function sharedTopics(a: Set<string> | undefined, b: Set<string> | undefined): number {
  if (!a || !b) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/**
 * Build the grouped timeline. Input MUST be sorted newest-first
 * (matches `searchConversations({ sort: "newest" })`).
 */
export async function buildTimeline(
  conversations: StoredConversation[],
  now: number = Date.now(),
): Promise<TimelineBucket[]> {
  const topics = await loadTopicMap();

  const bucketDefs: { id: TimelineBucketId; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "earlier", label: "Earlier" },
  ];

  const bucketMap = new Map<TimelineBucketId, StoredConversation[]>(
    bucketDefs.map((b) => [b.id, []]),
  );
  for (const c of conversations) bucketMap.get(bucketOf(now, c.updatedAt))?.push(c);

  const out: TimelineBucket[] = [];
  for (const def of bucketDefs) {
    const items = bucketMap.get(def.id)!;
    if (items.length === 0) continue;

    const sessions: MemorySession[] = [];
    let current: StoredConversation[] = [];
    let prev: StoredConversation | null = null;

    for (const c of items) {
      let sameSession = false;
      if (prev) {
        const gap = prev.updatedAt - c.updatedAt; // sorted desc
        if (gap <= SESSION_GAP) sameSession = true;
        else if (
          gap <= 12 * HOUR &&
          sharedTopics(topics.get(prev.id), topics.get(c.id)) >= TOPIC_BRIDGE
        ) {
          sameSession = true;
        }
      }
      if (!sameSession && current.length) {
        sessions.push(makeSession(current));
        current = [];
      }
      current.push(c);
      prev = c;
    }
    if (current.length) sessions.push(makeSession(current));

    out.push({ id: def.id, label: def.label, sessions, count: items.length });
  }
  return out;
}

function makeSession(items: StoredConversation[]): MemorySession {
  // items are newest-first inside the session
  const endedAt = items[0].updatedAt;
  const startedAt = items[items.length - 1].updatedAt;
  return {
    id: `sess_${startedAt}_${endedAt}`,
    label: sessionLabel(startedAt),
    startedAt,
    endedAt,
    conversations: items,
  };
}
