# Memlace — Migration Guide

## Upgrading to 1.0.0-rc1

RC1 is compatible with all internal beta builds. On first run after upgrade:

1. Dexie opens the database and runs the v1 → v5 migration chain automatically. No user action required.
2. `chrome.storage.local` keys are namespaced (`memlace.*`) and preserved.
3. Onboarding does not re-trigger for existing users; `What's New` shows the 1.0.0 changelog once per version.

## Dexie schema versions

| Dexie ver | Introduced | Adds |
| --- | --- | --- |
| v1 | Alpha | `memories`, `projects`, `tags` |
| v2 | Alpha | `conversations`, `messages` |
| v3 | Beta | Backup/import indices, `settings` |
| v4 | Phase 7 | `knowledgeItems`, `entities`, `entityLinks` |
| v5 | Phase 8 | `aiSummaries`, `aiEmbeddings`, `aiSessions` |

All migrations are additive and non-destructive. Downgrade is **not** supported: opening an older extension against a newer DB will refuse to start and prompt the user to update.

## Backup before upgrade

Recommended once, from **Side Panel → Diagnostics → Download full backup**. The JSON file is portable across installs and versions.

## Restoring on a new machine

**Install RC1 → Side Panel → Diagnostics → Restore from file → pick the JSON**. Duplicate detection is by `id`; existing records are preserved.

## Migrating from other tools

Not supported in v1. NDJSON import for common ChatGPT export formats is on the v1.1 roadmap.

## API-key migration

API keys stored in `chrome.storage.local` under `memlace.ai.credentials.*`. On upgrade they remain in place. To wipe, use **Options → AI → Disconnect provider** or **Diagnostics → Reset all data**.
