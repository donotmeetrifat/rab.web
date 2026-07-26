/**
 * GoalEvolution — extends GoalDetector output into an evolving chain.
 * Goals with strong overlap fold into an existing chain; completed
 * language ("shipped", "launched") flips status to completed.
 */
import { db } from "@/lib/db";
import type { StoredConversation, StoredConvMessage } from "@/types";
import type { PieGoalRow } from "./types";

const GOAL_PATTERNS = [
  /\b(?:i(?:'m| am)|we(?:'re| are))\s+(?:trying to|working on|building|shipping|planning to)\s+([^\n.!?]{4,80})/gi,
  /\b(?:goal|objective|deliverable)\s*[:\-]\s*([^\n.!?]{4,80})/gi,
];
const COMPLETION = /\b(shipped|launched|released|done|completed|finished|deployed)\b/i;

function normalise(g: string): string {
  return g.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function overlap(a: string, b: string): number {
  const sa = new Set(a.split(" ").filter((w) => w.length > 2));
  const sb = new Set(b.split(" ").filter((w) => w.length > 2));
  if (!sa.size || !sb.size) return 0;
  let common = 0;
  sa.forEach((w) => { if (sb.has(w)) common += 1; });
  return common / Math.min(sa.size, sb.size);
}

export async function updateGoalsFor(
  conversation: StoredConversation,
  messages: StoredConvMessage[],
): Promise<void> {
  const now = Date.now();
  const text = messages
    .filter((m) => m.role === "user")
    .map((m) => m.markdown || m.content || "")
    .join("\n")
    .slice(0, 20_000);

  const raw: string[] = [];
  for (const re of GOAL_PATTERNS) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const g = m[1].trim();
      if (g && g.length <= 100) raw.push(g);
      if (raw.length > 8) break;
    }
  }
  if (!raw.length) return;

  const done = COMPLETION.test(text);
  const existing = await db.pieGoals.toArray();
  const rows: PieGoalRow[] = [];

  for (const label of raw) {
    const key = normalise(label);
    if (!key) continue;
    const match = existing.find((g) => overlap(g.key, key) >= 0.5);
    if (match) {
      const last = match.chain[match.chain.length - 1];
      if (!last || last.label !== label) {
        match.chain = [...match.chain, { label, at: now, conversationId: conversation.id }].slice(-16);
      }
      match.status = done ? "completed" : match.status;
      match.updatedAt = now;
      rows.push(match);
    } else {
      rows.push({
        id: `goal_${key.replace(/\s+/g, "_").slice(0, 60)}_${now.toString(36)}`,
        key,
        label,
        chain: [{ label, at: now, conversationId: conversation.id }],
        status: done ? "completed" : "active",
        updatedAt: now,
      });
    }
  }
  if (rows.length) await db.pieGoals.bulkPut(rows);
}

export async function listGoals(status?: PieGoalRow["status"]): Promise<PieGoalRow[]> {
  const all = await db.pieGoals.toArray();
  const filtered = status ? all.filter((g) => g.status === status) : all;
  return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
}
