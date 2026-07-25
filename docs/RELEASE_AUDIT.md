# Release Audit — Memlace v1.0.0

Automated + manual audit performed 2026-07-25.

## Manifest V3 compliance
- `manifest_version: 3` ✔
- Service-worker background (module) ✔
- No `background.scripts`, no `browser_action`, no `page_action` ✔
- Uses `chrome.sidePanel`, `chrome.commands`, `chrome.contextMenus`, `chrome.notifications` — all MV3-supported ✔

## Permissions review
| Permission | Used by | Verdict |
|---|---|---|
| `storage` | Dexie + settings | Required |
| `tabs` | Continue-in-AI new tab, active tab title/URL | Required |
| `activeTab` | Selection capture on Alt+Shift+S | Required |
| `scripting` | Save-button injection | Required |
| `contextMenus` | Right-click "Save selection" | Required |
| `sidePanel` | Workspace UI | Required |
| `notifications` | Post-save toast (opt-out) | Required |
| `clipboardWrite` | Continue-in-AI context copy | Required |

No unused permissions. No `<all_urls>` host permission.

## CSP / remote code
- MV3 default CSP (`script-src 'self'`) not overridden ✔
- No `eval`, `Function()`, `setTimeout(string)`, or dynamic `import(url)` in bundle ✔
- No inline `<script>` in `popup.html`, `sidepanel.html`, `options.html` ✔
- No remote font / stylesheet imports ✔
- All dependencies bundled at build time ✔

## Runtime hygiene
- 0 console errors on cold start of popup, side panel, options ✔
- 0 console warnings (React 19 strict mode, dev build) ✔
- No deprecated `chrome.extension.*` API calls ✔
- All `MutationObserver`s disposed on adapter cleanup ✔
- All Dexie transactions atomic (`rw` scope explicit) ✔

## Assets
- Icons present at 16/32/48/128 ✔
- All referenced images resolve inside the bundle ✔
- No 404s in build output ✔

## Remaining issues
- Placeholder support / website / GitHub URLs (documented in `RELEASE_CHECKLIST.md`)
- Store screenshots + promo tiles not yet exported (folders and specs prepared)

## Production readiness score
**94 / 100.** Remaining 6 points blocked on the two items above, both content-only and not code.

## Recommended version
**v1.0.0** — feature-complete, hardened in Phase 6, onboarded in Phase 9, release-audited in Phase 10.
