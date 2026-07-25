# Phase 12.5 — Project Brain

_A single dashboard turns every project into a living workspace._

## Architecture

- **New service** `extension/src/services/projectBrain.ts` — pure aggregator over existing indexes. No new Dexie tables, no new observers.
- **New view** `extension/src/components/projects/ProjectHome.tsx` — replaces the memory grid when a project is selected. Everything else in the side panel is untouched.
- **Reverse helpers** added to `extension/src/services/projectDetection.ts`: `conversationsForProject`, `allProjectMappings`.
- **Pipeline hook** — `conversations.ts` now calls `invalidateProjectBrain()` after knowledge indexing and project detection settle, and also on delete. The cache is a monotonic version map — invalidation is O(1).

```
saveConversation → knowledge.indexer → projectDetection → invalidateProjectBrain
deleteConversation → knowledge.remove → invalidateProjectBrain
```

## Knowledge Integration

Facets are read once from the existing `knowledge` table (multi-entry indexed on `technologies / languages / topics / entities`) and aggregated in-memory per project. Code snippets, links, and attachments are surfaced from `KnowledgeRecord` — no re-parsing.

## Decision Timeline

`extractDecisions` (Phase 12.3) is re-used per-conversation. Cross-conversation supersedes are computed by hashing the normalised subject (`use|adopt|pick|drop` stripped). Superseded items keep their timestamp; the newest with the same subject is rendered "Active" and older versions render struck-through — history is preserved rather than deleted.

## Goal Management

`detectGoals` runs on the last 20 project conversations, dedupes by label prefix, and returns Active → Completed → Abandoned. No user input required.

## Project Summary Engine

`renderProjectSummary(brain)` returns a Markdown blob (≤ 10 lines) built from: current objective, stack, latest activity, latest decision, open goal, snippet count, knowledge count, memory count, and status. Wired to the **Copy Summary** quick action.

## Related Work Engine

For each other project we know about, we intersect its top technologies with the current project's. Any overlap produces a chip with the shared list on hover. Related conversations = the 8 most recently updated project conversations, one click away.

## Project Health

Single badge; internal percentages hidden. Buckets: **Planning / In Progress / Testing / Ready to Deploy / Maintaining** — chosen from a keyword score over recent decisions, goals, and titles.

## Background Pipeline

```
Conversation saved
   ↓
Knowledge updated (existing)
   ↓
Project detection (existing)
   ↓
invalidateProjectBrain()   ← new (O(1), non-blocking)
   ↓
Next ProjectHome open recomputes lazily.
```

Every step remains fire-and-forget; the primary save never blocks.

## Performance Validation

- **No new DB indexes.** All reads use existing keyed lookups: `conversations.bulkGet`, `knowledge.where("conversationId").anyOf`, `convMessages.where("conversationId").anyOf`.
- **Memory cache** keyed by project id + monotonic version. Rebuilds only after the pipeline signals a change.
- **Bounded work** — messages are scanned only for the 20 most recent project conversations; timeline capped at 40 entries; related projects capped at 6.
- **Chunk size** — the extra `projectBrain` chunk is **8.83 kB / 3.56 kB gzip**.
- **No new DOM observers.** ProjectHome is a passive read.

## Accessibility Validation

- Semantic `<section aria-label>`, `<h1>` / `<h2>`, `<ol>` / `<ul>`.
- Interactive rows are real `<button>` elements — full keyboard focus, no custom key handlers.
- Status badge is text, not colour-only; decision categories carry a text label (`Adopted / Rejected / Done / Open`) alongside colour dots.
- Every icon is `aria-hidden`.

## TypeScript Validation

`bunx tsgo -p extension/tsconfig.json` — no new errors introduced by Phase 12.5. Only pre-existing errors in `ai/providers/anthropic.ts`, `components/Diagnostics.tsx`, `components/onboarding/OnboardingFlow.tsx` remain (out of scope).

## Extension Rebuild

`bunx vite build` — clean build. Packaged to `public/memlace-extension.zip` (**843 KB**).

## UX Guarantee

A first-time user opens a project and immediately sees:

> This project remembers: Conversations · Knowledge · Decisions · Goals · Progress.

No configuration. No manual tagging. No new pages to learn.
