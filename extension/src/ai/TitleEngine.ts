/**
 * TitleEngine — generates a concise, human title for a saved conversation.
 * Reuses the summary row if one already exists.
 */
import { db } from "@/lib/db";
import { getConversation, listConversationMessages } from "@/services/conversations";
import { runPrompt, serializeConversation } from "./PromptEngine";
import { getSummary, summarizeConversation } from "./SummaryEngine";

export async function generateTitle(
  conversationId: string,
  opts: { force?: boolean; signal?: AbortSignal } = {},
): Promise<string | null> {
  const existing = await getSummary(conversationId);
  if (existing?.title && !opts.force) return existing.title;

  const conv = await getConversation(conversationId);
  if (!conv) return null;
  const messages = await listConversationMessages(conversationId);
  const body = serializeConversation(conv, messages, { maxTokens: 1200 });

  const result = await runPrompt({
    system: "You write short, specific, five-to-eight-word titles for chat transcripts. Reply with only the title text.",
    prompt: `Suggest a title for this chat:\n\n${body}`,
    temperature: 0.4,
    maxTokens: 30,
    signal: opts.signal,
    skipCache: opts.force,
  });

  const title = result.text.trim().replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 120);
  if (!title) return null;

  // Persist onto the summary row (creating one if needed).
  const sum = await summarizeConversation(conversationId).catch(() => null);
  if (sum) {
    await db.aiSummaries.update(sum.id, { title, updatedAt: Date.now() });
  }
  return title;
}
