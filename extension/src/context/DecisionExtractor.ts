/**
 * DecisionExtractor — lightweight, offline, regex-driven detector for
 * declarative decisions inside conversation messages.
 *
 * It intentionally errs on the side of recall: false positives are
 * cheap (they become low-priority context items) but a missed
 * "we picked Supabase" is expensive because it steers a whole project.
 *
 * Newer decisions on the same subject supersede older ones (last-write-
 * wins by message order).
 */
import type { StoredConvMessage } from "@/types";
import type { ExtractedDecision } from "./types";

interface Pattern {
  polarity: ExtractedDecision["polarity"];
  regex: RegExp;
  /** Higher = we trust this phrasing more. */
  weight: number;
}

const PATTERNS: Pattern[] = [
  { polarity: "adopt", weight: 0.95, regex: /\b(?:we(?:'ll|\s+will)|let'?s|going to)\s+(?:use|pick|choose|go with|adopt|switch to)\s+([^.\n!?]{2,80})/gi },
  { polarity: "adopt", weight: 0.9, regex: /\b(?:decided|chose|picked|selected)\s+(?:to\s+use\s+|to\s+go\s+with\s+|)([^.\n!?]{2,80})/gi },
  { polarity: "adopt", weight: 0.7, regex: /\b(?:the\s+project|this\s+app|the\s+stack)\s+(?:uses|is\s+built\s+on|runs\s+on)\s+([^.\n!?]{2,80})/gi },
  { polarity: "reject", weight: 0.9, regex: /\b(?:we(?:'ll|\s+will|\s+won'?t)?|let'?s)\s+(?:not\s+use|avoid|drop|skip|remove)\s+([^.\n!?]{2,80})/gi },
  { polarity: "reject", weight: 0.9, regex: /\b(?:decided|chose)\s+not\s+to\s+use\s+([^.\n!?]{2,80})/gi },
  { polarity: "complete", weight: 0.85, regex: /\b(?:this|the)\s+(?:feature|task|bug|issue|ticket)\s+(?:is|has been)\s+(?:done|complete|completed|shipped|fixed|resolved)\b[^.\n!?]{0,80}/gi },
  { polarity: "complete", weight: 0.8, regex: /\b(?:✅|✓)\s*([^.\n!?]{3,120})/g },
  { polarity: "unresolved", weight: 0.85, regex: /\b(?:this|the)\s+(?:bug|issue|error|problem)\s+(?:is\s+)?(?:still\s+)?(?:unresolved|open|not\s+fixed|blocking)\b[^.\n!?]{0,80}/gi },
  { polarity: "unresolved", weight: 0.75, regex: /\b(?:TODO|FIXME|OPEN|BLOCKED)[:\s-]+([^.\n!?]{3,120})/g },
];

function normalize(sentence: string): string {
  return sentence
    .replace(/\s+/g, " ")
    .replace(/[.,;!?]+$/g, "")
    .trim()
    .toLowerCase();
}

function subject(statement: string): string {
  // Very small stop-word strip so "use supabase" and "supabase" collapse.
  return normalize(statement)
    .replace(/^(?:use|pick|choose|adopt|drop|avoid|remove|not\s+use)\s+/i, "")
    .replace(/^(?:the\s+|a\s+|an\s+)/i, "");
}

export function extractDecisions(
  conversationId: string,
  messages: StoredConvMessage[],
): ExtractedDecision[] {
  const raw: ExtractedDecision[] = [];
  for (const msg of messages) {
    const body = msg.markdown?.trim() || msg.content || "";
    if (!body) continue;
    // Cap per-message scan to keep the extractor O(n).
    const scannable = body.length > 8000 ? body.slice(0, 8000) : body;
    for (const p of PATTERNS) {
      p.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = p.regex.exec(scannable)) !== null) {
        const captured = (match[1] || match[0]).trim();
        if (captured.length < 3) continue;
        const statement = captured.replace(/\s+/g, " ").slice(0, 160);
        raw.push({
          id: `${msg.id}:${p.polarity}:${match.index}`,
          conversationId,
          statement,
          polarity: p.polarity,
          messageId: msg.id,
          confidence: p.weight,
          detectedAt: msg.createdAt,
        });
      }
    }
  }

  // Supersede older decisions on the same subject.
  const bySubject = new Map<string, ExtractedDecision>();
  const ordered = raw.sort((a, b) => a.detectedAt - b.detectedAt);
  for (const d of ordered) {
    const key = `${d.polarity === "reject" ? "!" : ""}${subject(d.statement)}`;
    const prev = bySubject.get(key);
    if (prev) d.supersedes = prev.id;
    bySubject.set(key, d);
  }
  return [...bySubject.values()].sort((a, b) => b.confidence - a.confidence);
}
