# Memlace 1.0.0-rc1 — Known Issues

None of the issues below block release. Tracked for post-v1 iterations.

## Low severity

1. **Index rebuild pause at 10 000+ conversations** — after bulk import, the in-memory search index takes ~2.4 s to build. Search palette is disabled with a spinner during this window. Planned fix: incremental index on save (v1.1).
2. **Export size grows linearly** — a full JSON export of 10 000 conversations is ~118 MB. Chrome downloads handle it, but users on low-storage devices may prefer chunked export. Planned: streamed NDJSON export (v1.1).
3. **Arc side panel opens as pop-out window** — Arc does not implement `chrome.sidePanel` yet; behaviour is a floating window. Documented in Help Center.
4. **Copilot detect latency (88 ms)** — Bing Chat DOM is deep; still under 100 ms budget.

## Cosmetic

5. **Reduced-motion mode disables sheen sweep in hero card** — intended, but some users may want it back. No fix planned.
6. **Long conversation titles truncate at 48 chars in the sidebar** — hover tooltip shows full title.

## Deferred (post-v1)

- Web Workers offloading for index build.
- Encrypted-at-rest local DB (opt-in passphrase).
- Cross-device sync (explicit user demand only; currently local-first by design).
- Firefox port (WebExtensions polyfill required for `chrome.sidePanel`).

## Not-a-bug

- **No cloud sync by default** — intentional. Memlace is local-first.
- **AI features require a user key** — intentional. No shared inference credits.
- **No conversation is saved on providers where the user is logged out** — expected.
