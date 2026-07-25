/**
 * GoalDetector — cheap heuristic for "what is the user actually trying
 * to do right now?". Runs offline on the recent tail of the
 * conversation. Only the most recent 3 goals are considered active;
 * everything older becomes historical context and is downgraded.
 */
import type { StoredConvMessage } from "@/types";
import type { DetectedGoal } from "./types";

const GOAL_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:want|need|would like)\s+to|help\s+me|let'?s|please)\s+([a-z][^.\n!?]{4,120})/gi,
  /\b(?:goal|objective|task)\s*[:\-]\s*([^.\n!?]{4,120})/gi,
  /\b(?:trying\s+to|working\s+on|building)\s+([a-z][^.\n!?]{4,120})/gi,
];

const COMPLETION_HINTS = /\b(?:done|shipped|deployed|complete(?:d)?|works\s+now|fixed|resolved)\b/i;
const ABANDON_HINTS = /\b(?:abandoned|dropped|cancelled|not\s+going\s+to|no\s+longer)\b/i;

function trim(s: string, n = 90): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}

export function detectGoals(
  conversationId: string,
  messages: StoredConvMessage[],
  limit = 3,
): DetectedGoal[] {
  // Only user messages express goals; assistant echoes them.
  const userMessages = messages.filter((m) => m.role === "user");
  const results: DetectedGoal[] = [];
  for (const msg of userMessages) {
    const body = (msg.markdown?.trim() || msg.content || "").slice(0, 4000);
    if (!body) continue;
    for (const rx of GOAL_PATTERNS) {
      rx.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rx.exec(body)) !== null) {
        const label = trim(match[1] || match[0]);
        if (label.length < 5) continue;
        results.push({
          id: `${msg.id}:${match.index}`,
          conversationId,
          label,
          status: "active",
          updatedAt: msg.createdAt,
          confidence: 0.6,
        });
      }
    }
  }

  // Second pass: downgrade a goal if a later message signals completion
  // or abandonment about the same subject.
  const laterText = messages
    .slice(messages.length - 10)
    .map((m) => m.markdown || m.content || "")
    .join("\n")
    .toLowerCase();

  for (const g of results) {
    const key = g.label.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
    if (key && laterText.includes(key)) {
      if (COMPLETION_HINTS.test(laterText)) g.status = "completed";
      else if (ABANDON_HINTS.test(laterText)) g.status = "abandoned";
    }
  }

  // Dedupe and keep the latest N.
  const seen = new Set<string>();
  const deduped: DetectedGoal[] = [];
  for (const g of results.sort((a, b) => b.updatedAt - a.updatedAt)) {
    const key = g.label.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(g);
    if (deduped.length >= limit * 3) break;
  }
  // Active first, then completed, then abandoned.
  const order: Record<DetectedGoal["status"], number> = {
    active: 0,
    completed: 1,
    abandoned: 2,
  };
  deduped.sort((a, b) => order[a.status] - order[b.status] || b.updatedAt - a.updatedAt);
  return deduped.slice(0, limit);
}
