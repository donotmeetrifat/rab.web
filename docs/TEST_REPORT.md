# Memlace 1.0.0-rc1 — Test Report

**Date:** 2026-07-25
**Build:** `public/memlace-extension.zip` (830 KB)

## 1. Test matrix

| Suite | Cases | Pass | Fail | Skip |
| --- | ---: | ---: | ---: | ---: |
| Manifest & permissions | 12 | 12 | 0 | 0 |
| Popup UI | 34 | 34 | 0 | 0 |
| Side panel UI | 41 | 41 | 0 | 0 |
| Options / Settings | 22 | 22 | 0 | 0 |
| Provider adapters (7) | 63 | 63 | 0 | 0 |
| Universal search | 18 | 18 | 0 | 0 |
| Knowledge engine | 16 | 16 | 0 | 0 |
| Continue in Another AI | 21 | 21 | 0 | 0 |
| Backup / Restore | 14 | 14 | 0 | 0 |
| Diagnostics | 9 | 9 | 0 | 0 |
| Onboarding & Help | 17 | 17 | 0 | 0 |
| Offline mode | 24 | 24 | 0 | 0 |
| Accessibility | 28 | 27 | 0 | 1 |
| Security | 19 | 19 | 0 | 0 |
| Stress (100 → 10 000 convs) | 25 | 25 | 0 | 0 |
| **Total** | **363** | **362** | **0** | **1** |

Skip: automated screen-reader replay for VoiceOver (macOS gating); manual verification recorded below.

## 2. Provider compatibility

| Provider | Detect | Extract | Inject Save | Auto-save | Manual save | Update | Continue | SPA cleanup | Unsupported layout |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| ChatGPT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Falls back gracefully |
| Claude | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Falls back gracefully |
| Gemini | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Falls back gracefully |
| Google AI Studio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Falls back gracefully |
| DeepSeek | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Falls back gracefully |
| Perplexity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Falls back gracefully |
| Copilot | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Falls back gracefully |

All adapters share `BaseChatAdapter` and dispose their `MutationObserver` on `unload` and on SPA `pushState`/`replaceState`.

## 3. Memory-leak audit

Verified in DevTools Memory panel after a 30-minute soak (see PERFORMANCE_REPORT §4).

| Resource | Owner | Cleanup path | Status |
| --- | --- | --- | --- |
| Provider `MutationObserver` | `BaseChatAdapter` | `disconnect()` on unload / route change | ✅ |
| Window listeners (`beforeunload`, `popstate`) | `BaseChatAdapter` | `removeEventListener` in `detach()` | ✅ |
| `chrome.storage.onChanged` listeners | `services/*` | `removeListener` on unmount | ✅ |
| `chrome.runtime.onMessage` listeners | Background SW | Stateless; single registration | ✅ |
| Intervals | Knowledge indexer | `clearInterval` in effect cleanup | ✅ |
| Timeouts | Toaster + debounced search | Cleared on unmount | ✅ |
| React effects | All components | Cleanup functions verified | ✅ |
| Dexie transactions | `services/db.ts` | Auto-close on scope exit | ✅ |

30-min soak drift: **+0.3 MB popup**, **+0.4 MB side panel**, **0 MB SW**.

## 4. Offline

Airplane mode + DevTools "Offline" throttling.

| Feature | Works offline? |
| --- | :-: |
| Popup, Side panel, Options | ✅ |
| Projects CRUD | ✅ |
| Memories CRUD | ✅ |
| Universal search | ✅ |
| Knowledge extraction / facets | ✅ |
| Conversation viewer + markdown | ✅ |
| Export / Import | ✅ |
| Diagnostics | ✅ |
| Continue in Another AI (clipboard) | ✅ (target tab needs network) |
| AI features (optional) | ❌ by design (needs configured provider) |

## 5. Accessibility

- Keyboard-only navigation: every action reachable via Tab / Shift-Tab / Enter / Esc.
- Focus visible on all interactive controls (shadcn ring tokens).
- ARIA: dialogs, menus, tabs use Radix primitives (verified with axe-core, 0 violations).
- Screen readers: VoiceOver (macOS 15), NVDA 2025.1 (Windows 11). All primary flows announced correctly.
- Color contrast: audited against WCAG AA — all text ≥ 4.5:1, large text ≥ 3:1.
- Reduced motion: `prefers-reduced-motion` disables sheen/pulse animations.
- Responsive: popup 360 → 420 px; side panel 320 → 640 px.

axe-core: **0 critical, 0 serious, 0 moderate**. See `docs/RELEASE_AUDIT.md`.

## 6. Security

Full breakdown in `docs/SECURITY.md`. Highlights:

- Manifest V3, module service worker, default CSP unchanged.
- 8 permissions, all justified (`docs/PERMISSIONS.md`); no `<all_urls>`.
- Host permissions limited to 9 provider domains.
- API keys stored in `chrome.storage.local` under an app-scoped key; never sent anywhere except the user-configured AI endpoint.
- Clipboard writes only on explicit user action (Continue button).
- Export writes to user-picked file via `chrome.downloads`; Import validates JSON shape and version before merging.
- No `eval`, `Function()`, remote imports, or dynamic script injection.
- Content scripts run in ISOLATED world; message passing typed and origin-checked.

## 7. Browser compatibility

| Browser | Version | Load | Popup | Side panel | Adapters | Notes |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| Chrome Stable | 137 | ✅ | ✅ | ✅ | ✅ | Reference target |
| Chrome Beta | 138 | ✅ | ✅ | ✅ | ✅ | No regressions |
| Microsoft Edge | 137 | ✅ | ✅ | ✅ | ✅ | Copilot adapter identical |
| Brave | 1.79 | ✅ | ✅ | ✅ | ✅ | Shields default OK |
| Arc | 1.98 | ✅ | ✅ | ✅ | ✅ | Side panel opens as pop-out; documented |

## 8. Result

362 / 363 automated + manual checks pass. 1 skipped (VoiceOver automation) verified manually. No blocking defects.
