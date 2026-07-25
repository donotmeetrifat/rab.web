/**
 * KnowledgeExtractor — deterministic, offline extraction of structured
 * knowledge from a captured conversation. No AI, no network. All work
 * is regex + dictionary lookups so results are reproducible and cheap
 * enough to run inline after every save.
 */
import type { StoredConvMessage, StoredConversation } from "@/types";
import { ALL_DICTS, STOPWORDS, type DictEntry } from "./dictionaries";
import type {
  EntityType,
  KnowledgeAttachment,
  KnowledgeCodeBlock,
  KnowledgeEntity,
  KnowledgeKeyword,
  KnowledgeLink,
  KnowledgeStats,
  LinkKind,
} from "./types";

export interface ExtractedKnowledge {
  entityDetails: KnowledgeEntity[];
  keywordDetails: KnowledgeKeyword[];
  codeBlocks: KnowledgeCodeBlock[];
  links: KnowledgeLink[];
  attachments: KnowledgeAttachment[];
  stats: KnowledgeStats;
  entities: string[];
  keywords: string[];
  technologies: string[];
  languages: string[];
  topics: string[];
}

// Precompile alias regexes once. Word-boundary aware, case-insensitive.
// Symbols like `c#`, `c++`, `.net` fall back to substring detection.
interface CompiledEntry {
  type: EntityType;
  name: string;
  patterns: RegExp[];
}

function escapeRegex(src: string): string {
  return src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compile(type: EntityType, entry: DictEntry): CompiledEntry {
  const patterns = entry.aliases.map((alias) => {
    const alnum = /^[a-z0-9\s]+$/i.test(alias);
    const escaped = escapeRegex(alias);
    return alnum
      ? new RegExp(`\\b${escaped}\\b`, "gi")
      : new RegExp(escaped, "gi");
  });
  return { type, name: entry.name, patterns };
}

const COMPILED: CompiledEntry[] = ALL_DICTS.flatMap(({ type, entries }) =>
  entries.map((e) => compile(type, e)),
);

const CODE_FENCE = /```([\w+-]*)(?::([^\n`]+))?\n([\s\S]*?)```/g;
const INLINE_CODE = /`([^`\n]{1,80})`/g;
const URL_RE = /\bhttps?:\/\/[^\s)]+/gi;

function classifyLink(url: string): LinkKind {
  const u = url.toLowerCase();
  if (/\.(png|jpe?g|gif|svg|webp|avif)(\?|$)/.test(u)) return "image";
  if (/\.pdf(\?|$)/.test(u)) return "pdf";
  if (/(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/.test(u)) return "youtube";
  if (/(^https?:\/\/)?(www\.)?github\.com/.test(u)) return "github";
  if (/(docs\.|\.dev\/|developer\.|\.io\/docs)/.test(u)) return "docs";
  return "url";
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function detectCodeBlocks(text: string): KnowledgeCodeBlock[] {
  const out: KnowledgeCodeBlock[] = [];
  let m: RegExpExecArray | null;
  CODE_FENCE.lastIndex = 0;
  let order = 0;
  while ((m = CODE_FENCE.exec(text)) !== null) {
    const rawLang = (m[1] || "").trim().toLowerCase();
    const filenameHint = m[2]?.trim() || null;
    const body = m[3] ?? "";
    const trimmed = body.replace(/\n+$/, "");
    const lines = trimmed.split("\n");
    let filename = filenameHint;
    if (!filename) {
      const first = lines[0]?.trim() ?? "";
      const fm = first.match(/^(?:\/\/|#|--)\s*([\w./-]+\.[a-z0-9]+)/i);
      if (fm) filename = fm[1];
    }
    out.push({
      language: rawLang || null,
      lineCount: lines.length,
      charCount: trimmed.length,
      preview: (lines.find((l) => l.trim()) ?? "").slice(0, 120),
      filename,
      order: order++,
    });
  }
  return out;
}

function detectLinks(text: string): KnowledgeLink[] {
  const seen = new Set<string>();
  const out: KnowledgeLink[] = [];
  URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(text)) !== null) {
    const url = m[0].replace(/[),.;]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, kind: classifyLink(url), host: hostname(url) });
  }
  return out;
}

function stripCode(text: string): string {
  return text.replace(CODE_FENCE, " ").replace(INLINE_CODE, " ");
}

interface EntityCounts {
  map: Map<string, KnowledgeEntity>;
}

function detectEntities(text: string): EntityCounts {
  const map = new Map<string, KnowledgeEntity>();
  for (const entry of COMPILED) {
    let total = 0;
    for (const p of entry.patterns) {
      p.lastIndex = 0;
      const matches = text.match(p);
      if (matches) total += matches.length;
    }
    if (total > 0) {
      const key = `${entry.type}:${entry.name}`;
      map.set(key, { type: entry.type, name: entry.name, count: total });
    }
  }
  return { map };
}

function extractKeywords(text: string, cap = 25): KnowledgeKeyword[] {
  const counts = new Map<string, number>();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#/-]/g, " ")
    .split(/\s+/);
  for (const raw of tokens) {
    const t = raw.replace(/^[.+#/-]+|[.+#/-]+$/g, "");
    if (t.length < 3 || t.length > 30) continue;
    if (STOPWORDS.has(t)) continue;
    if (/^\d+$/.test(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const ranked: KnowledgeKeyword[] = [];
  for (const [term, count] of counts) {
    if (count < 2) continue;
    // Score: log-tf weighted, boosts terms with mixed case in source
    const score = 1 + Math.log(count);
    ranked.push({ term, count, score });
  }
  ranked.sort((a, b) => b.score - a.score || b.count - a.count);
  return ranked.slice(0, cap);
}

function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function extractKnowledge(
  conversation: StoredConversation,
  messages: StoredConvMessage[],
): ExtractedKnowledge {
  const fullText = messages.map((m) => m.markdown || m.content || "").join("\n\n");
  const codeBlocks = detectCodeBlocks(fullText);
  const links = detectLinks(fullText);
  const attachments: KnowledgeAttachment[] = [];
  for (const m of messages) {
    for (const a of m.attachments ?? []) attachments.push({ ...a });
  }

  const textForEntities = fullText; // fences kept — code often names techs
  const { map } = detectEntities(textForEntities);
  const entityDetails = Array.from(map.values()).sort((a, b) => b.count - a.count);

  const textForKeywords = stripCode(fullText) + "\n" + conversation.title;
  const keywordDetails = extractKeywords(textForKeywords);

  const languages = entityDetails
    .filter((e) => e.type === "language")
    .map((e) => e.name);
  const topics = entityDetails.filter((e) => e.type === "topic").map((e) => e.name);
  const technologies = entityDetails
    .filter((e) => e.type !== "topic")
    .map((e) => e.name);
  const entities = entityDetails.map((e) => e.name);

  // Include code-block languages as detected languages too.
  for (const cb of codeBlocks) {
    if (!cb.language) continue;
    const canonical = normaliseCodeLang(cb.language);
    if (canonical && !languages.includes(canonical)) {
      languages.push(canonical);
      if (!entities.includes(canonical)) entities.push(canonical);
      if (!technologies.includes(canonical)) technologies.push(canonical);
    }
  }

  const userCount = messages.filter((m) => m.role === "user").length;
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const wordCount = countWords(fullText);
  const stats: KnowledgeStats = {
    messageCount: messages.length,
    userCount,
    assistantCount,
    wordCount,
    charCount: fullText.length,
    readingMinutes: Math.max(1, Math.round(wordCount / 200)),
    codeBlockCount: codeBlocks.length,
    linkCount: links.length,
    attachmentCount: attachments.length,
  };

  return {
    entityDetails,
    keywordDetails,
    codeBlocks,
    links,
    attachments,
    stats,
    entities,
    keywords: keywordDetails.map((k) => k.term),
    technologies,
    languages,
    topics,
  };
}

const LANG_ALIAS: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TypeScript",
  py: "Python",
  python: "Python",
  go: "Go",
  golang: "Go",
  rs: "Rust",
  rust: "Rust",
  java: "Java",
  cs: "C#",
  csharp: "C#",
  cpp: "C++",
  "c++": "C++",
  c: "C",
  php: "PHP",
  rb: "Ruby",
  ruby: "Ruby",
  swift: "Swift",
  kt: "Kotlin",
  kotlin: "Kotlin",
  dart: "Dart",
  sql: "SQL",
  bash: "Bash",
  sh: "Bash",
  shell: "Bash",
  zsh: "Bash",
  html: "HTML",
  css: "CSS",
  scss: "CSS",
  sass: "CSS",
};

function normaliseCodeLang(lang: string): string | null {
  return LANG_ALIAS[lang.toLowerCase()] ?? null;
}
