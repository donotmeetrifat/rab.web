# Memlace Privacy Policy

_Last updated: 2026-07-25 · Applies to Memlace v1.0.0_

Memlace is a **local-first** browser extension. Your data stays on your device.

## What we collect
**Nothing.** Memlace has no servers, no accounts, no analytics, no telemetry, no crash reporting, no A/B testing, no ads. We do not know that you installed it.

## What Memlace stores locally
All data is stored in your browser via `chrome.storage.local` and IndexedDB:
- Saved conversations, messages, attachments, and images you captured
- Memories, projects, tags, and pins you created
- Knowledge index derived from your conversations
- Optional AI summaries, titles, tags, and embeddings you generated
- Extension settings and onboarding state

You can export, delete, or wipe this data at any time from **Settings → Backup** or **Diagnostics → Download full backup**.

## Optional AI features
Memlace works fully offline. If you choose to enable AI features in **AI Center**, you provide your own API key for a third-party AI provider (OpenAI, Anthropic, Google Gemini, OpenRouter, or a local runtime such as Ollama or LM Studio). In that case:
- The API key is stored locally in `chrome.storage.local` and is never transmitted to Memlace.
- Requests go directly from your browser to the provider you configured. Their privacy policy and data handling apply to those requests.
- You can disable AI features at any time; disabling stops all outbound requests immediately.

## Permissions
See [PERMISSIONS.md](./PERMISSIONS.md) for the full explanation of every permission Memlace requests.

## Cookies & tracking
Memlace sets no cookies and does not track you across sites.

## Children
Memlace is not directed to children under 13.

## Contact
Questions: **support@memlace.app** (placeholder — update before publishing).
