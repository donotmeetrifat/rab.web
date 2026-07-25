/**
 * KnowledgeSearch — deterministic local search over persisted
 * knowledge rows. Weighted by match location so an exact technology
 * hit beats a keyword-only hit.
 */
import { db } from "@/lib/db";
import type { KnowledgeAggregate, KnowledgeRecord, KnowledgeSearchHit } from "./types";

export async function listKnowledge(): Promise<KnowledgeRecord[]> {
  const rows = await db.knowledge.toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getKnowledgeForConversation(
  conversationId: string,
): Promise<KnowledgeRecord | undefined> {
  return db.knowledge.where("conversationId").equals(conversationId).first();
}

const WEIGHTS: Record<KnowledgeSearchHit["matchedIn"][number], number> = {
  title: 5,
  technology: 4,
  language: 4,
  entity: 3,
  keyword: 2,
  code: 1,
};

export async function searchKnowledge(query: string): Promise<KnowledgeSearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) {
    const rows = await listKnowledge();
    return rows.map((r) => ({ record: r, matchedIn: [], score: 0 }));
  }
  const rows = await db.knowledge.toArray();
  const hits: KnowledgeSearchHit[] = [];
  for (const r of rows) {
    const matched = new Set<KnowledgeSearchHit["matchedIn"][number]>();
    let score = 0;
    if (r.title.toLowerCase().includes(q)) {
      matched.add("title");
      score += WEIGHTS.title;
    }
    for (const t of r.technologies) {
      if (t.toLowerCase().includes(q)) {
        matched.add("technology");
        score += WEIGHTS.technology;
        break;
      }
    }
    for (const l of r.languages) {
      if (l.toLowerCase().includes(q)) {
        matched.add("language");
        score += WEIGHTS.language;
        break;
      }
    }
    for (const e of r.entities) {
      if (e.toLowerCase().includes(q)) {
        matched.add("entity");
        score += WEIGHTS.entity;
        break;
      }
    }
    for (const k of r.keywords) {
      if (k.includes(q)) {
        matched.add("keyword");
        score += WEIGHTS.keyword;
        break;
      }
    }
    for (const cb of r.codeBlocks) {
      if ((cb.language ?? "").toLowerCase().includes(q) || cb.preview.toLowerCase().includes(q)) {
        matched.add("code");
        score += WEIGHTS.code;
        break;
      }
    }
    if (score > 0) hits.push({ record: r, matchedIn: Array.from(matched), score });
  }
  hits.sort((a, b) => b.score - a.score || b.record.updatedAt - a.record.updatedAt);
  return hits;
}

export async function findRelatedConversations(
  knowledgeId: string,
  limit = 5,
): Promise<{ record: KnowledgeRecord; sharedTechnologies: string[]; score: number }[]> {
  const source = await db.knowledge.get(knowledgeId);
  if (!source) return [];
  const rows = await db.knowledge.toArray();
  const srcSet = new Set(source.technologies.map((t) => t.toLowerCase()));
  const topicSet = new Set(source.topics.map((t) => t.toLowerCase()));
  const scored = rows
    .filter((r) => r.id !== source.id)
    .map((r) => {
      const shared: string[] = [];
      for (const t of r.technologies) if (srcSet.has(t.toLowerCase())) shared.push(t);
      let score = shared.length * 2;
      for (const t of r.topics) if (topicSet.has(t.toLowerCase())) score += 1;
      return { record: r, sharedTechnologies: shared, score };
    })
    .filter((r) => r.score > 0);
  scored.sort((a, b) => b.score - a.score || b.record.updatedAt - a.record.updatedAt);
  return scored.slice(0, limit);
}

export async function buildAggregate(): Promise<KnowledgeAggregate> {
  const rows = await db.knowledge.toArray();
  const tech = new Map<string, number>();
  const lang = new Map<string, number>();
  const frame = new Map<string, number>();
  const topics = new Map<string, number>();
  const kw = new Map<string, number>();
  let codeBlocks = 0;
  let links = 0;
  let words = 0;
  for (const r of rows) {
    codeBlocks += r.stats.codeBlockCount;
    links += r.stats.linkCount;
    words += r.stats.wordCount;
    for (const t of r.technologies) tech.set(t, (tech.get(t) ?? 0) + 1);
    for (const l of r.languages) lang.set(l, (lang.get(l) ?? 0) + 1);
    for (const e of r.entityDetails) {
      if (e.type === "framework") frame.set(e.name, (frame.get(e.name) ?? 0) + 1);
    }
    for (const t of r.topics) topics.set(t, (topics.get(t) ?? 0) + 1);
    for (const k of r.keywordDetails) kw.set(k.term, (kw.get(k.term) ?? 0) + k.count);
  }
  const toSorted = (m: Map<string, number>, cap = 20) =>
    Array.from(m, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, cap);
  return {
    totalConversations: rows.length,
    totalCodeBlocks: codeBlocks,
    totalLinks: links,
    totalWords: words,
    technologies: toSorted(tech),
    languages: toSorted(lang),
    frameworks: toSorted(frame),
    topics: toSorted(topics),
    topKeywords: Array.from(kw, ([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30),
  };
}

export async function listConversationsForTechnology(name: string): Promise<KnowledgeRecord[]> {
  return db.knowledge.where("technologies").equals(name).toArray();
}
