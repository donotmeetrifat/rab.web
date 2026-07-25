# Release Checklist — Memlace v1.0.0

## Code
- [x] TypeScript strict — 0 errors
- [x] Production build clean (`bunx vite build` in `extension/`)
- [x] No `eval`, `new Function`, or remote `<script>` tags
- [x] No inline event handlers in HTML
- [x] All dead code and placeholder adapters removed

## Manifest
- [x] `manifest_version: 3`
- [x] `version: 1.0.0`
- [x] Permissions limited to what is used (see `docs/PERMISSIONS.md`)
- [x] Host permissions limited to 9 supported AI domains
- [x] No `<all_urls>` host permission
- [x] Icons registered at 16 / 32 / 48 / 128
- [x] `web_accessible_resources` scoped to `icons/*` and `src/assets/*`

## Icons
- [x] `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png` present in `extension/public/icons/`
- [x] Transparent background, crisp on Retina

## Docs
- [x] Privacy Policy — `docs/PRIVACY.md`
- [x] Terms — `docs/TERMS.md`
- [x] Permissions — `docs/PERMISSIONS.md`
- [x] Security — `docs/SECURITY.md`
- [x] Data storage — `docs/DATA_STORAGE.md`
- [x] Support — `docs/SUPPORT.md`
- [x] Licenses — `docs/LICENSES.md`
- [x] Changelog — `docs/CHANGELOG.md`

## Store assets
- [x] Store listing copy — `docs/store-assets/STORE_LISTING.md`
- [ ] Store icon 128×128 — copy from `extension/public/icons/icon-128.png`
- [ ] Screenshots 1280×800 ×5 — `docs/store-assets/screenshots/`
- [ ] Small promo tile 440×280
- [ ] Large promo tile 920×680 (optional)
- [ ] Marquee 1400×560 (optional)

## In-product QA
- [x] Onboarding flow completes and persists
- [x] Setup checklist ticks from real usage
- [x] "What's new" fires once per version
- [x] Universal search (⌘K) opens in popup and side panel
- [x] Save button injects into all 7 supported chat sites (native + floating fallback)
- [x] Continue-in-another-AI copies context and opens target tab
- [x] Import / Export round-trips successfully
- [x] Diagnostics displays version, DB version, counts, storage
- [x] Backup / Restore one-click works
- [x] Dark mode readable across all views
- [x] Keyboard-only navigation reaches every primary control
- [x] Fully offline: no network requests when AI is disabled

## Before hitting "Publish"
- [ ] Replace `support@memlace.app`, `memlace.app`, and GitHub URL placeholders
- [ ] Host Privacy Policy at a public URL and paste it into the store form
- [ ] Upload the packaged zip: `public/memlace-extension.zip`
- [ ] Fill out the store's data-usage disclosures: **no data collected**
