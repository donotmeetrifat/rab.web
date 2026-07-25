# Data Storage

Memlace uses two browser-managed stores. Nothing leaves your device.

## `chrome.storage.local`
- Settings (theme, notifications, capture options)
- Onboarding + checklist state
- AI provider settings and API key (only when you enable AI)
- Last-seen version (for "What's new")

## IndexedDB (via Dexie, database `memlace`)
Version 5 schema:
- `projects`, `memories`, `tags`
- `conversations`, `convMessages`
- `knowledge`, `entities`, `keywords`, `relationships`
- `aiSummaries`, `aiEmbeddings`, `aiPromptCache`

## Backup format
JSON, version 3. Includes projects, memories, tags, conversations, messages, and (optionally) settings. See **Diagnostics → Download full backup**.

## Wipe
Uninstall the extension, or use Chrome's **Settings → Privacy → Clear browsing data → Cookies and site data** for the extension origin.
