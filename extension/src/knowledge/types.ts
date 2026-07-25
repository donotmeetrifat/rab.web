import type { ProviderId } from "@/types";

export type EntityType =
  | "language"
  | "framework"
  | "database"
  | "cloud"
  | "devops"
  | "ai"
  | "library"
  | "topic";

export interface KnowledgeEntity {
  type: EntityType;
  name: string;
  /** Number of matches across the conversation. */
  count: number;
}

export interface KnowledgeKeyword {
  term: string;
  count: number;
  /** Rank score (weighted TF, higher = more relevant). */
  score: number;
}

export interface KnowledgeCodeBlock {
  language: string | null;
  lineCount: number;
  charCount: number;
  /** First non-empty line, capped for previews. */
  preview: string;
  /** Detected file-name hint (e.g. `// src/foo.ts`, ```ts:src/foo.ts). */
  filename: string | null;
  /** Ordinal within the conversation. */
  order: number;
}

export type LinkKind =
  | "github"
  | "docs"
  | "youtube"
  | "pdf"
  | "image"
  | "url";

export interface KnowledgeLink {
  url: string;
  kind: LinkKind;
  host: string;
}

export interface KnowledgeAttachment {
  kind: "image" | "file" | "link";
  name?: string;
  url?: string;
  mime?: string;
}

export interface KnowledgeStats {
  messageCount: number;
  userCount: number;
  assistantCount: number;
  wordCount: number;
  charCount: number;
  /** Reading time in minutes (200 wpm). */
  readingMinutes: number;
  codeBlockCount: number;
  linkCount: number;
  attachmentCount: number;
}

/** Persisted per-conversation knowledge row. Aggregate string arrays
 *  (entities/keywords/technologies/languages/topics) are indexed with
 *  Dexie multiEntry so `where(field).equals(name)` is O(log n). */
export interface KnowledgeRecord {
  id: string;
  conversationId: string;
  provider: ProviderId;
  title: string;
  hash: string;
  createdAt: number;
  updatedAt: number;

  /** Structured extraction results. */
  entityDetails: KnowledgeEntity[];
  keywordDetails: KnowledgeKeyword[];
  codeBlocks: KnowledgeCodeBlock[];
  links: KnowledgeLink[];
  attachments: KnowledgeAttachment[];
  stats: KnowledgeStats;

  /** Flat, deduplicated names — indexed for fast lookup / faceting. */
  entities: string[];
  keywords: string[];
  technologies: string[];
  languages: string[];
  topics: string[];
}

export interface KnowledgeEntityRow {
  id: string;
  knowledgeId: string;
  type: EntityType;
  name: string;
  count: number;
}

export interface KnowledgeKeywordRow {
  id: string;
  knowledgeId: string;
  term: string;
  count: number;
  score: number;
}

export interface KnowledgeRelationship {
  id: string;
  fromId: string;
  toId: string;
  kind: "shares-technology" | "shares-topic";
  weight: number;
}

export interface KnowledgeAggregate {
  totalConversations: number;
  totalCodeBlocks: number;
  totalLinks: number;
  totalWords: number;
  technologies: { name: string; count: number }[];
  languages: { name: string; count: number }[];
  frameworks: { name: string; count: number }[];
  topics: { name: string; count: number }[];
  topKeywords: { term: string; count: number }[];
}

export interface KnowledgeSearchHit {
  record: KnowledgeRecord;
  /** Fields that matched (for UI badges). */
  matchedIn: Array<"title" | "technology" | "language" | "keyword" | "entity" | "code">;
  score: number;
}
