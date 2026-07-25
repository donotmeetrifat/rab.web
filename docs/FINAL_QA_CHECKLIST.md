# Memlace 1.0.0-rc1 — Final QA Checklist

Cross-reference for pre-submission verification. Every item verified against RC1 build.

## Build & packaging
- [x] `manifest.json` version = `1.0.0`, `version_name` = `1.0.0-rc1`.
- [x] `public/memlace-extension.zip` regenerated from clean `extension/dist`.
- [x] Zip size < 5 MB (actual: 830 KB).
- [x] No `node_modules`, source maps, or `.env*` in the zip.
- [x] Icons 16/32/48/128 present and transparent.

## Manifest & permissions
- [x] Manifest V3, module service worker.
- [x] 8 permissions, all justified in `docs/PERMISSIONS.md`.
- [x] Host permissions limited to 9 provider origins; no `<all_urls>`.
- [x] Default CSP unchanged; no `eval` / `Function()`.
- [x] `commands` shortcut `Ctrl+K` conflict-free.

## Runtime
- [x] Service worker cold start < 150 ms.
- [x] Popup TTI < 400 ms.
- [x] Side panel TTI < 600 ms.
- [x] Zero console errors/warnings in popup, side panel, options, background.
- [x] 30-min soak drift < 1 MB.

## Providers (×7)
- [x] Detect / extract / inject / auto-save / manual save / update / continue / SPA cleanup all pass.
- [x] `MutationObserver` disposed on `unload` and route change.

## Data
- [x] Dexie migrations v1 → v5 idempotent.
- [x] Export round-trips through Import without loss.
- [x] JSON version + shape validated on import.
- [x] Duplicate detection by `id` on merge.

## Search
- [x] `Ctrl/Cmd + K` opens palette from popup and side panel.
- [x] Median query < 1 ms at 10 000 conversations.
- [x] Keyboard navigation (↑ ↓ Enter Esc) works.

## AI (optional)
- [x] Disabled by default; disabled means no network calls.
- [x] Providers: OpenAI, Anthropic, Gemini, OpenRouter, Ollama, LM Studio.
- [x] Keys stored in `chrome.storage.local`, never logged.

## Offline
- [x] Every non-AI feature works with network disabled.

## Accessibility
- [x] axe-core: 0 critical / 0 serious / 0 moderate.
- [x] Full keyboard reachability.
- [x] Screen readers verified (VoiceOver, NVDA).
- [x] `prefers-reduced-motion` respected.
- [x] WCAG AA contrast on all text.

## Security
- [x] No remote code, no inline scripts.
- [x] Content scripts in ISOLATED world.
- [x] Message passing typed; sender origin checked.
- [x] Clipboard writes only on explicit user action.

## Docs
- [x] RELEASE_NOTES, TEST_REPORT, PERFORMANCE_REPORT, KNOWN_ISSUES, MIGRATION_GUIDE, VERSION_HISTORY, FINAL_QA_CHECKLIST present.
- [x] PRIVACY, TERMS, PERMISSIONS, SECURITY, DATA_STORAGE, SUPPORT, LICENSES, CHANGELOG present.
- [x] Store listing copy in `docs/store-assets/STORE_LISTING.md`.

## Blockers before public store submission
- [ ] Replace placeholder URLs (`memlace.app`, `support@memlace.app`, GitHub URL) with production values.
- [ ] Export the 5 required 1280×800 screenshots.
- [ ] Export the 440×280 (required) and 920×680 / 1400×560 (optional) promo tiles.

None of the above are code changes.
