/**
 * Cheap, dependency-free token estimator.
 *
 * We can't ship a real BPE in a Chrome extension without bloating the
 * bundle, so we use the well-known ~4 characters per token approximation
 * that OpenAI's own guidance recommends for planning. Good enough for
 * cost/quota UI and prompt budgeting; NEVER used for provider-side
 * truncation (providers count exactly server-side).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // A blend of char-based and whitespace-based heuristics tracks real
  // tokenizers within ~15% on typical English/code content.
  const chars = text.length;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil((chars / 4 + words * 1.3) / 2));
}

export function estimateMessageTokens(messages: { role: string; content: string }[]): number {
  return messages.reduce((n, m) => n + estimateTokens(m.content) + 4, 0);
}

/** Trim text to fit an approximate token budget, cutting on sentence boundaries. */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
  return (lastStop > maxChars * 0.6 ? slice.slice(0, lastStop + 1) : slice).trim() + "…";
}
