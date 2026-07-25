# Memlace 1.0.0-rc1 — Release Notes

**Codename:** Release Candidate 1
**Date:** 2026-07-25
**Package:** `public/memlace-extension.zip` (830 KB)
**Manifest version:** 1.0.0 (`version_name`: 1.0.0-rc1)

## Highlights

Memlace 1.0 is a private, local-first workspace for your AI conversations across **ChatGPT, Claude, Gemini, Google AI Studio, DeepSeek, Perplexity, and Copilot**.

- **Save & organize** conversations into projects with tags.
- **Universal search** (`Ctrl/Cmd + K`) across memories, conversations, and projects — sub-millisecond at 1 000 conversations, < 1 ms median at 10 000.
- **Continue in Another AI** — copy an optimised prompt context and open the next provider in one click.
- **Knowledge engine** — offline entity extraction across 100+ languages, frameworks, and tools.
- **Optional AI layer** — bring your own key (OpenAI, Anthropic, Gemini, OpenRouter) or point at a local Ollama/LM Studio runtime.
- **Onboarding** — 6-step first-run flow, setup checklist, What's New, Help Center.
- **Diagnostics** — full local report + one-click backup/restore.

## What changed since internal builds

- Version bumped to `1.0.0` (`version_name: 1.0.0-rc1`).
- Added Diagnostics panel and expanded release documentation set.
- Provider adapters share `BaseChatAdapter` with observer teardown on unload.
- AI features are opt-in and default off; no telemetry, no analytics, no remote calls without a user-configured key.

## Chrome Web Store

RC1 is the candidate package for public store submission. See `docs/RELEASE_CHECKLIST.md` and `docs/store-assets/STORE_LISTING.md`.

## Known issues

See `docs/KNOWN_ISSUES.md`. No P0/P1 issues open.

## Upgrade

Fresh install. Existing beta users' data is preserved automatically via Dexie v5 migrations. See `docs/MIGRATION_GUIDE.md`.
