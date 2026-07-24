import type { CapturedConversation } from "./types";

/** FNV-1a 32-bit hash — fast, dependency-free, stable across sessions. */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function hashConversation(c: CapturedConversation): string {
  const parts: string[] = [c.provider, c.conversationId, c.title, c.model ?? ""];
  for (const m of c.messages) {
    parts.push(m.id, m.role, String(m.order), m.markdown);
  }
  return fnv1a(parts.join("\u0001"));
}
