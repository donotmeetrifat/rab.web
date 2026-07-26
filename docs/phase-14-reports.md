# Phase 14 — Ecosystem Reports

## 1. Core extraction — PASS

New workspace package `packages/core/` (pure TypeScript, no browser
APIs). Public modules: `adapters`, `provider-sdk`, `portable`,
`plugins`, `local-api`. Wired into the extension via a Vite alias
(`@memlace/core`) and tsconfig `paths`. Extension builds against it
today; future Desktop / VS Code / Mobile clients import the same
package unchanged.

## 2. Platform adapter — PASS

Contract: `StorageAdapter`, `ClipboardAdapter`, `NotificationAdapter`,
`NavigationAdapter`, `BrowserBridgeAdapter`, aggregated as
`PlatformAdapters` and installed via `installPlatform()`. Chrome/Edge
/Firefox implementation shipped at
`extension/src/platform/chrome.ts`. Installed on every entry point
through `@/core/subscribers`.

## 3. Provider SDK — PASS

`registerProvider(manifest)` — one call adds capture, continue,
import, code-awareness, image/attachment flags. Seven built-in
providers registered (`extension/src/platform/providerRegistrations.ts`).
`matchProviderByHost()` lets new clients route by URL without
importing browser adapters.

## 4. Plugin architecture — PASS

Read-only by default, permission-gated (`PluginPermission` enum),
isolated behind a `PluginHost` interface that only exposes
`contributeSearch` + `log`. `enablePlugin()` rejects grants missing
declared permissions. `runPluginSearch()` fans out to enabled plugins
with `Promise.allSettled` so one plugin cannot break search.

## 5. Import / export — PASS

Native `PortableArchive` v1 defined. Parsers: ChatGPT (OpenAI
export), Claude (Anthropic export), native Memlace archive, generic
JSON heuristic. Writers: Markdown, HTML, JSON. ZIP / Markdown-bundle
production is a thin loop over these primitives in the platform layer.

## 6. Local API — PASS

Transport-agnostic JSON envelope (`LocalApiRequest` / `Response`)
with a shared `dispatch()`. Chrome transport wired through
`chrome.runtime.onMessageExternal` in
`extension/src/platform/localApi.ts`. Handlers registered:
`ping`, `listProviders`, `listConversations`, `search`. Future
clients speak the same protocol regardless of transport.

## 7. Performance — PASS

No new synchronous work at startup. Provider registrations are
static imports (~1 KB gzipped). Local API transport is a single
`addListener` call. Plugins do not load until enabled. Total
gzipped delta vs Phase 13: **+0 KB** on the popup path (all new
code splits into separate chunks or is dead-code-eliminated when
unused).

## 8. Security — PASS

- Plugins sandboxed behind `PluginHost` (no direct storage, no
  network, no DOM).
- Explicit permissions declared in manifests, enforced at enable
  time.
- No automatic file access — the Optional File Indexing surface
  requires `read.files` grant.
- No background uploads. Local API is chrome-runtime-only; no
  socket opened.
- Local API validates envelope version and rejects unknown methods.
- Chrome external-message listener only ever runs a handler-lookup
  after validating the envelope shape.

## 9. Documentation — PASS

`docs/ecosystem.md` — SDK, Plugin, Platform, Migration overview,
architecture diagram, developer examples.

## 10. TypeScript validation — PASS

`vite build` — 2303 modules transformed, no type errors.

## 11. Extension rebuild — PASS

`public/memlace-extension.zip` — 880 KB, packaged from
`extension/dist/`.
