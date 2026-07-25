/**
 * PromptEngine — builds prompts and caches results by content hash.
 *
 * Cache lives in Dexie so it survives popup close and sidepanel reload.
 * The hash covers `system + prompt + model + temperature + provider`, so
 * changing any of those causes a fresh call.
 */
import { db, uid } from "@/lib/db";
import type { StoredConvMessage, StoredConversation } from "@/types";
import { fnv1a } from "@/providers/base/hash";
import { generate, getSettings } from "./AIManager";
import { estimateTokens, truncateToTokens } from "./TokenCounter";
import type { AIPromptCacheRow } from "./types";

const MAX_CACHE_ROWS = 500;

export interface PromptResult {
  text: string;
  cached: boolean;
  usage: { inputTokens: number; outputTokens: number };
  costUSD: number;
  model: string;
}

export function hashPrompt(parts: {
  system?: string;
  prompt: string;
  model: string;
  temperature: number;
  provider: string;
}): string {
  return fnv1a(
    [parts.provider, parts.model, parts.temperature.toFixed(2), parts.system ?? "", parts.prompt].join("\u0001"),
  );
}

/** Fire a prompt through the AI Manager with content-hash caching. */
export async function runPrompt(opts: {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
  /** If true, ignore any cached row and force a fresh call. */
  skipCache?: boolean;
}): Promise<PromptResult> {
  const settings = await getSettings();
  const temperature = opts.temperature ?? settings.temperature;
  const hash = hashPrompt({
    system: opts.system,
    prompt: opts.prompt,
    model: settings.chatModel,
    temperature,
    provider: settings.provider,
  });

  if (!opts.skipCache) {
    const cached = await db.aiPromptCache.get(hash);
    if (cached) {
      return {
        text: cached.text,
        cached: true,
        usage: cached.usage,
        costUSD: cached.costUSD,
        model: cached.model,
      };
    }
  }

  const result = await generate({
    system: opts.system,
    prompt: opts.prompt,
    temperature,
    maxTokens: opts.maxTokens,
    json: opts.json,
    signal: opts.signal,
  });

  const row: AIPromptCacheRow = {
    hash,
    provider: settings.provider,
    model: result.model,
    text: result.text,
    usage: result.usage,
    costUSD: result.costUSD,
    createdAt: Date.now(),
  };
  await db.aiPromptCache.put(row);
  void trimCache();
  return { ...result, cached: false };
}

async function trimCache(): Promise<void> {
  const count = await db.aiPromptCache.count();
  if (count <= MAX_CACHE_ROWS) return;
  const overflow = count - MAX_CACHE_ROWS;
  const oldest = await db.aiPromptCache.orderBy("createdAt").limit(overflow).toArray();
  await db.aiPromptCache.bulkDelete(oldest.map((r) => r.hash));
}

/* -------------------------- conversation shaping -------------------------- */

/**
 * Serialise a conversation for prompt input. Preserves message order,
 * strips base64 attachments, and truncates each message to keep the
 * request within a reasonable budget for the current chat model.
 */
export function serializeConversation(
  conv: StoredConversation,
  messages: StoredConvMessage[],
  opts: { maxTokens?: number } = {},
): string {
  const maxTokens = opts.maxTokens ?? 6000;
  const perMsg = Math.max(200, Math.floor(maxTokens / Math.max(1, messages.length)));
  const lines: string[] = [
    `# Conversation: ${conv.title || "(untitled)"}`,
    `Provider: ${conv.provider}${conv.model ? `  · Model: ${conv.model}` : ""}`,
    "",
  ];
  for (const m of messages.sort((a, b) => a.order - b.order)) {
    const role = m.role.toUpperCase();
    const body = truncateToTokens(m.markdown || m.content || "", perMsg);
    lines.push(`## ${role}\n${body}\n`);
  }
  const joined = lines.join("\n");
  return truncateToTokens(joined, maxTokens);
}

export function estimateSerializedTokens(s: string): number {
  return estimateTokens(s);
}

/** Small helper to safely parse a JSON blob that may be wrapped in fences. */
export function tryParseJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(s.slice(first, last + 1)) as T;
  } catch {
    return null;
  }
}

export function newPromptId(): string {
  return uid("prompt");
}
