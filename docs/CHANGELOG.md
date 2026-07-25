# Changelog

All notable changes to Memlace are documented here. Format loosely follows Keep a Changelog.

## 1.0.0 — 2026-07-25
First public release.

### Added
- Local-first workspace: Memories, Projects, Tags, Pins, Favorites.
- Conversation capture for ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Copilot, AI Studio via native composer buttons with a floating fallback.
- Conversation viewer with markdown, syntax highlighting, GFM tables, images, and per-message actions.
- Universal search (⌘K) across memories, conversations, and projects, with grouped results and highlighting.
- Continue in another AI — copies an optimized, provider-sized context to clipboard and opens the chosen chat.
- Knowledge engine: offline entity extraction (languages, frameworks, tools), stats, and related-conversation recommendations.
- Optional AI Center: bring-your-own key for OpenAI, Anthropic, Gemini, OpenRouter, Ollama, or LM Studio. Powers summaries, titles, tags, semantic search, and Ask Memlace (RAG).
- First-run onboarding, setup checklist, What's New modal, Help Center, and Diagnostics.
- One-click backup and restore.

### Security & privacy
- No accounts, no telemetry, no analytics, no remote code.
- Manifest V3, strict CSP, no `eval`, no inline scripts.
- Host permissions limited to the nine supported AI domains.
