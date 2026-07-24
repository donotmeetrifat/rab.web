# Phase 1 — Universal AI Workspace

## What we're building

A **Chrome/Edge MV3 extension** (100% local, no backend, no account) that gives users one persistent workspace across ChatGPT, Claude, Gemini, DeepSeek, Perplexity, and Copilot.

Everything lives in `chrome.storage.local` + IndexedDB on the user's machine. Nothing is uploaded, ever.

This TanStack Start project is repurposed as the **landing / download page** that hosts the packaged `.zip` and install instructions. All product functionality lives inside the extension.

## Phase 1 scope (locked)

Only these four capabilities ship in Phase 1. Everything else (auto-memory, knowledge graph, tasks, timeline, analytics, plugins) is deferred.

1. **Projects** — user-owned containers. Create, rename, colour-tag, archive, delete.
2. **Chats** — capture the current conversation from a supported AI tab into a project. One-click "Save this chat" from the popup, plus an optional right-side panel.
3. **Universal Search** — instant local search across all projects, chats, and messages (<50 ms target). Fuzzy, keyboard-first, Raycast-style.
4. **Continue in Another AI** — one click takes the current chat's context (last N messages + project instructions) and opens it prefilled in a different provider (ChatGPT ⇄ Claude ⇄ Gemini ⇄ DeepSeek ⇄ Perplexity).

## Navigation (final, max 5)

`Home` · `Projects` · `Search` · `Recent` · `Settings`

## Design system

Arc/Notion light. Locked tokens:

- Background `#FBFAF7` warm off-white · Surface `#F1EFEA` · Ink `#1A1A1A` · Accent `#5B5BD6` indigo
- Radius 10 px, generous whitespace, hairline borders (`#E8E5DE`)
- Type: Inter for UI, JetBrains Mono for chat metadata
- Motion: 120–180 ms ease-out, no bounce, no fade-on-everything

## Architecture

```text
/dev-server/
├── extension/                     ← the actual product
│   ├── manifest.json              MV3
│   ├── popup/                     380×560 popup (React + Vite build)
│   ├── sidepanel/                 optional side panel view
│   ├── background/                service worker: routing, storage, cross-tab
│   ├── content-scripts/           per-provider DOM adapters
│   │   ├── chatgpt.ts
│   │   ├── claude.ts
│   │   ├── gemini.ts
│   │   ├── deepseek.ts
│   │   ├── perplexity.ts
│   │   └── copilot.ts
│   ├── lib/
│   │   ├── store/                 IndexedDB (Dexie) — projects, chats, messages
│   │   ├── search/                MiniSearch index, incremental
│   │   ├── providers/             capture + inject contracts per provider
│   │   └── continue-in/           context packaging + provider URL builders
│   └── ui/                        shared React components + design tokens
└── src/                           landing page (this TanStack app)
    └── routes/index.tsx           hero, screenshots, download .zip, install steps
```

## Provider adapters (Phase 1 contract)

Each adapter implements exactly two functions — nothing more:

- `captureCurrentChat(): { title, messages: {role, text, ts}[] }` — reads the visible conversation from the DOM.
- `getProviderId(): 'chatgpt' | 'claude' | ...`

"Continue in Another AI" does **not** try to auto-paste into the destination provider in Phase 1 (fragile, breaks weekly). Instead:
1. Package context as a single well-formatted prompt.
2. Copy it to the clipboard.
3. Open the destination provider's new-chat URL in a new tab.
4. Show a 3-second toast: "Context copied — paste into <Provider>."

This is honest, reliable, and works the day any provider ships a UI change. Auto-injection can be added per-provider later without breaking the contract.

## Local data model

```text
Project   { id, name, color, createdAt, updatedAt, archivedAt? }
Chat      { id, projectId, provider, title, sourceUrl, createdAt, updatedAt }
Message   { id, chatId, role: 'user'|'assistant'|'system', text, ts }
Setting   { key, value }          // theme, default project, providers enabled
```

All in IndexedDB via Dexie. `chrome.storage.local` holds only lightweight prefs and the active-project pointer.

## Build order

1. Landing page (this repo) — hero, palette, install steps, download link wiring (empty zip stub).
2. Extension scaffold — manifest, popup shell, design tokens, routing between the 5 nav items.
3. Storage + Projects CRUD.
4. ChatGPT adapter + "Save this chat" flow end-to-end.
5. Remaining 5 provider adapters (same contract).
6. Universal Search (MiniSearch, keyboard-first).
7. Continue in Another AI (clipboard + new-tab flow).
8. Package `.zip` into `public/`, wire real download.

## Out of scope for Phase 1 (do not build)

Auto memory extraction · knowledge graph · tasks · timeline · pinned memories · analytics · plugin manager · dark mode toggle · account / sync · any server code.

## First deliverable this turn

Landing page only: repurpose `src/routes/index.tsx` and `__root.tsx` with the locked design system, hero, feature summary, install steps, and a download button wired to `/universal-ai-workspace.zip` (placeholder file until the extension is built in the next step). This proves the design language before we invest in extension code.

Approve to proceed, or tell me to adjust scope / order.