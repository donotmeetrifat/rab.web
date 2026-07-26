/**
 * Portable archive format — import/export contract.
 *
 * The wire format is JSON; ZIP/HTML/Markdown are produced from the
 * same shape by platform-specific writers. Everything stays local —
 * no cloud is contacted anywhere in this module.
 */

export const PORTABLE_ARCHIVE_VERSION = 1;

export interface PortableMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  markdown?: string;
  createdAt?: number;
}

export interface PortableConversation {
  id: string;
  provider: string;
  title: string;
  url?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
  messages: PortableMessage[];
  tags?: string[];
  projectId?: string;
}

export interface PortableProject {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PortableKnowledge {
  entities: Array<{ id: string; kind: string; label: string }>;
  edges: Array<{ from: string; to: string; kind: string }>;
}

export interface PortableArchive {
  version: typeof PORTABLE_ARCHIVE_VERSION;
  exportedAt: number;
  source: string;                       // "memlace-chrome@1.0.0", …
  conversations: PortableConversation[];
  projects?: PortableProject[];
  knowledge?: PortableKnowledge;
}

// -------------------- import parsers -----------------------------------

export type ImportKind =
  | "memlace"      // native portable archive
  | "chatgpt"      // OpenAI data export
  | "claude"       // Anthropic data export
  | "gemini"       // Google Takeout for Gemini
  | "markdown"     // .md file(s)
  | "json";        // generic JSON

export interface ImportResult {
  kind: ImportKind;
  conversations: PortableConversation[];
  warnings: string[];
}

/**
 * Detect archive kind from a JSON payload. Heuristic — falls back to
 * "json" when nothing matches so the caller can still show the raw
 * content to the user.
 */
export function detectImportKind(payload: unknown): ImportKind {
  if (!payload || typeof payload !== "object") return "json";
  const p = payload as Record<string, unknown>;
  if (p.version === PORTABLE_ARCHIVE_VERSION && Array.isArray(p.conversations)) {
    return "memlace";
  }
  if (Array.isArray(p) && p[0] && typeof p[0] === "object") {
    const first = p[0] as Record<string, unknown>;
    if ("mapping" in first && "title" in first) return "chatgpt";
    if ("uuid" in first && "chat_messages" in first) return "claude";
  }
  return "json";
}

/** Parse a native Memlace portable archive. */
export function parseMemlaceArchive(payload: unknown): ImportResult {
  if (!payload || typeof payload !== "object") {
    return { kind: "memlace", conversations: [], warnings: ["empty payload"] };
  }
  const a = payload as PortableArchive;
  return {
    kind: "memlace",
    conversations: Array.isArray(a.conversations) ? a.conversations : [],
    warnings:
      a.version === PORTABLE_ARCHIVE_VERSION
        ? []
        : [`archive version ${String(a.version)} — expected ${PORTABLE_ARCHIVE_VERSION}`],
  };
}

/** Parse an OpenAI ChatGPT export (conversations.json). */
export function parseChatGPTExport(payload: unknown): ImportResult {
  const warnings: string[] = [];
  const out: PortableConversation[] = [];
  if (!Array.isArray(payload)) {
    return { kind: "chatgpt", conversations: [], warnings: ["expected an array"] };
  }
  for (const raw of payload) {
    const conv = raw as {
      id?: string;
      title?: string;
      create_time?: number;
      update_time?: number;
      mapping?: Record<string, { message?: {
        author?: { role?: string };
        content?: { parts?: string[] };
        create_time?: number;
      } }>;
    };
    const messages: PortableMessage[] = [];
    for (const node of Object.values(conv.mapping ?? {})) {
      const m = node.message;
      if (!m?.content?.parts) continue;
      const text = m.content.parts.join("\n\n").trim();
      if (!text) continue;
      const role = (m.author?.role ?? "user") as PortableMessage["role"];
      messages.push({ role, content: text, createdAt: (m.create_time ?? 0) * 1000 });
    }
    if (!messages.length) continue;
    out.push({
      id: conv.id ?? crypto.randomUUID(),
      provider: "chatgpt",
      title: conv.title ?? "Untitled",
      createdAt: (conv.create_time ?? 0) * 1000,
      updatedAt: (conv.update_time ?? conv.create_time ?? 0) * 1000,
      messages,
    });
  }
  return { kind: "chatgpt", conversations: out, warnings };
}

/** Parse an Anthropic Claude export. */
export function parseClaudeExport(payload: unknown): ImportResult {
  const out: PortableConversation[] = [];
  if (!Array.isArray(payload)) {
    return { kind: "claude", conversations: [], warnings: ["expected an array"] };
  }
  for (const raw of payload) {
    const c = raw as {
      uuid?: string;
      name?: string;
      created_at?: string;
      updated_at?: string;
      chat_messages?: Array<{ sender?: string; text?: string; created_at?: string }>;
    };
    const messages: PortableMessage[] = (c.chat_messages ?? []).map((m) => ({
      role: m.sender === "assistant" ? "assistant" : "user",
      content: m.text ?? "",
      createdAt: m.created_at ? Date.parse(m.created_at) : undefined,
    }));
    if (!messages.length) continue;
    out.push({
      id: c.uuid ?? crypto.randomUUID(),
      provider: "claude",
      title: c.name ?? "Untitled",
      createdAt: c.created_at ? Date.parse(c.created_at) : Date.now(),
      updatedAt: c.updated_at ? Date.parse(c.updated_at) : Date.now(),
      messages,
    });
  }
  return { kind: "claude", conversations: out, warnings: [] };
}

// -------------------- exporters ----------------------------------------

export function conversationToMarkdown(c: PortableConversation): string {
  const lines: string[] = [`# ${c.title}`, "", `_Provider: ${c.provider}_`, ""];
  for (const m of c.messages) {
    lines.push(`## ${m.role}`, "", (m.markdown ?? m.content).trim(), "");
  }
  return lines.join("\n");
}

export function conversationToHtml(c: PortableConversation): string {
  const escape = (s: string) =>
    s.replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]!));
  const body = c.messages
    .map(
      (m) =>
        `<section class="msg ${m.role}"><h3>${m.role}</h3><pre>${escape(m.markdown ?? m.content)}</pre></section>`,
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(
    c.title,
  )}</title></head><body><h1>${escape(c.title)}</h1>${body}</body></html>`;
}

export function archiveToJson(a: PortableArchive): string {
  return JSON.stringify(a, null, 2);
}
