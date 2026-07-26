/**
 * DecisionMemory — maintains living decisions as ordered chains keyed by
 * topic. Only the newest link is `active`; the earlier ones remain as
 * history for context transfer.
 */
import { db } from "@/lib/db";
import type { StoredConversation, StoredConvMessage } from "@/types";
import type { PieDecisionRow } from "./types";

const TOPIC_MAP: Array<[RegExp, string]> = [
  [/\b(supabase|firebase|planetscale|neon|postgres|mysql|mongodb|sqlite|redis)\b/i, "database"],
  [/\b(clerk|auth0|nextauth|lucia|supabase auth|rls|jwt|oauth)\b/i, "auth"],
  [/\b(vercel|netlify|cloudflare|render|fly\.io|aws|gcp|azure|railway)\b/i, "hosting"],
  [/\b(react|vue|svelte|angular|solid|nextjs|next\.js|remix|astro|tanstack)\b/i, "framework"],
  [/\b(tailwind|css modules|styled-components|chakra|mui|shadcn)\b/i, "styling"],
  [/\b(vitest|jest|playwright|cypress|testing-library)\b/i, "testing"],
  [/\b(openai|anthropic|claude|gemini|mistral|groq|ollama|openrouter)\b/i, "ai-provider"],
  [/\b(stripe|paddle|lemon squeezy|paypal)\b/i, "payments"],
];

const DECISION_VERB = /\b(use|switch(?:ing)? to|adopt|choose|chose|going with|moved to|migrate[d]? to|prefer)\b/i;
const REJECT_VERB = /\b(drop|dropped|remove[d]?|stop using|abandon|no longer using|switch away from)\b/i;

function normaliseValue(raw: string): string {
  return raw
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDecisions(text: string): Array<{ topic: string; value: string; source: "adopt" | "reject" }> {
  const out: Array<{ topic: string; value: string; source: "adopt" | "reject" }> = [];
  const sentences = text.split(/(?<=[.!?\n])\s+/).slice(0, 400);
  for (const s of sentences) {
    const adopt = DECISION_VERB.test(s);
    const reject = REJECT_VERB.test(s);
    if (!adopt && !reject) continue;
    for (const [re, topic] of TOPIC_MAP) {
      const m = s.match(re);
      if (!m) continue;
      out.push({
        topic,
        value: normaliseValue(m[0]).toLowerCase(),
        source: reject ? "reject" : "adopt",
      });
    }
  }
  return out;
}

export async function updateDecisionsFor(
  conversation: StoredConversation,
  messages: StoredConvMessage[],
): Promise<void> {
  const now = Date.now();
  const text = messages
    .map((m) => m.markdown || m.content || "")
    .join("\n")
    .slice(0, 40_000);
  const found = extractDecisions(text);
  if (!found.length) return;

  // Collapse duplicates within the same conversation: latest wins.
  const perTopic = new Map<string, { value: string; source: "adopt" | "reject" }>();
  for (const f of found) perTopic.set(f.topic, { value: f.value, source: f.source });

  const ids = Array.from(perTopic.keys());
  const existing = await db.pieDecisions.bulkGet(ids);
  const rows: PieDecisionRow[] = [];
  perTopic.forEach((entry, topic) => {
    const prev = existing.find((r) => r?.id === topic);
    if (prev && prev.current === entry.value && entry.source === "adopt") return;
    const link = {
      value: entry.value,
      at: now,
      conversationId: conversation.id,
      source: entry.source,
    };
    if (prev) {
      const chain = [...prev.chain, link].slice(-24);
      rows.push({
        ...prev,
        current: entry.source === "adopt" ? entry.value : prev.current,
        chain,
        active: entry.source === "adopt",
        updatedAt: now,
      });
    } else {
      rows.push({
        id: topic,
        topic,
        current: entry.value,
        chain: [link],
        active: entry.source === "adopt",
        updatedAt: now,
      });
    }
  });
  if (rows.length) await db.pieDecisions.bulkPut(rows);
}

export async function listActiveDecisions(): Promise<PieDecisionRow[]> {
  const rows = await db.pieDecisions.toArray();
  return rows.filter((r) => r.active).sort((a, b) => b.updatedAt - a.updatedAt);
}
