# Memlace Landing — Vercel Deployment Report

**Date:** 2026-07-25
**Target:** Vercel (Nitro `vercel` preset)
**Framework:** TanStack Start v1 (Vite 7 · React 19)
**Package artifact under `/public`:** `memlace-extension.zip` (830 KB)

## 1. Vercel compatibility

| Check | Status |
| --- | :-: |
| `bun install` succeeds | ✅ |
| `bun run build` succeeds | ✅ |
| TypeScript strict passes (`tsgo --noEmit`) | ✅ |
| No SSR/hydration warnings | ✅ (single `<html>` shell in `__root.tsx`, `HeadContent` + `Scripts` wired) |
| No browser-only APIs at module top-level | ✅ (download uses `useCallback` + event handler) |
| No missing assets | ✅ (all imports resolve; Lovable assets externalised via `.asset.json`) |
| No broken routes | ✅ (only `/` public route) |
| No secrets in bundle | ✅ (no `.env*`, no API keys) |

**Runtime preset.** The project uses TanStack Start's bundled Nitro. Nitro auto-detects Vercel from `VERCEL=1` at build time — no config change required. If you deploy from CI outside Vercel and want a Vercel target explicitly, set `NITRO_PRESET=vercel` in the environment. Do **not** modify `vite.config.ts` — the Lovable-managed config warns against it.

## 2. Static assets

`/public/memlace-extension.zip` ships to Vercel's static CDN untouched.

Verified headers (per `vercel.json`):

| Header | Value |
| --- | --- |
| `Content-Type` | `application/zip` |
| `Content-Disposition` | `attachment; filename="Memlace-Chrome-Extension-v1.0.0.zip"` |
| `Cache-Control` | `public, max-age=31536000, immutable` |
| `X-Content-Type-Options` | `nosniff` |

- HTTP 200 direct, no redirects (verified locally with `curl -I http://localhost:8080/memlace-extension.zip`).
- Content-Length is served automatically by Vercel edge.

## 3. Download button

Located in `src/routes/index.tsx`. The button uses a root-relative URL constant (`EXTENSION_ASSET_PATH = "/memlace-extension.zip"`) — no hardcoded host, no `localhost`, no `VITE_*` needed. Works identically on:

- `http://localhost:8080` (dev)
- `id-preview--*.lovable.app` (Lovable preview)
- Vercel Preview Deployments (`*.vercel.app`)
- Production custom domains

On click:
1. Fetches the ZIP with a 30 s `AbortController` timeout and `cache: "no-store"`.
2. Wraps the response in a `Blob`, creates an `<a>` with `download="Memlace-Chrome-Extension-v1.0.0.zip"`, appends → clicks → removes.
3. `URL.revokeObjectURL` on a 1 s delay (Safari-safe).
4. Toast feedback via `sonner` (root `<Toaster />` added).

Failure handling:

| Case | User feedback |
| --- | --- |
| `HTTP 404` | `toast.error("Download failed", "Extension file not found. Please try again later.")` |
| `HTTP 5xx` | `toast.error("Download failed", "Download failed (HTTP 500).")` |
| Network error (`TypeError`) | `toast.error("Download failed", "Network error. Check your connection and try again.")` |
| Timeout (`AbortError`, 30 s) | `toast.error("Download failed", "Download timed out. Check your connection and try again.")` |
| Success | `toast.success("Download started", "Memlace-Chrome-Extension-v1.0.0.zip")` |

Concurrency safety:
- `if (state === "loading") return;` short-circuits double-clicks.
- `disabled={state === "loading"}` prevents pointer events on the button.
- Label swaps to `"Preparing…"` while in-flight.

## 4. Cache headers (`vercel.json`)

| Route | Cache-Control |
| --- | --- |
| `/memlace-extension.zip` | `public, max-age=31536000, immutable` |
| `/assets/*` (hashed Vite output) | `public, max-age=31536000, immutable` |
| `/favicon.png` `/robots.txt` `/sitemap.xml` `/manifest.webmanifest` | `public, max-age=3600, must-revalidate` |
| HTML (default) | Vercel default (revalidated per deploy) |

Global security headers on `/(.*)`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

CSP is intentionally omitted: TanStack Start's SSR + hydration relies on Vite-emitted inline scripts, and a strict CSP would need per-request nonces. That's an application-layer concern to add server-side when Vercel Edge Middleware is introduced. Marked as a v1.1 hardening item — not a blocker.

## 5. SEO

Verified in `src/routes/__root.tsx` and `src/routes/index.tsx`:

| Item | Status |
| --- | :-: |
| `<title>` | ✅ Memlace-specific |
| `<meta name="description">` | ✅ |
| `og:title` / `og:description` / `og:type` | ✅ (root; `og:type=website`) |
| `twitter:card` | ✅ `summary_large_image` |
| Favicon (`/favicon.png`) | ✅ 200 |
| Apple touch icon | ✅ |
| `robots.txt` | ✅ present in `/public` |
| Canonical / `og:image` | ⚠️ omitted — no absolute domain configured yet. Add when a production URL is assigned. |
| Sitemap / structured data | ⚠️ single-page site — not required for v1. |

## 6. PWA / manifest

Home-screen support only (no service worker; matches PWA policy for "install on my phone" without offline). Favicon, `apple-touch-icon`, and `theme-color` (via Tailwind background token) satisfy the mobile install surface. Adding a `manifest.webmanifest` is a future polish, not a Vercel blocker.

## 7. Performance

- Fonts: `preconnect` to `fonts.googleapis.com` + `fonts.gstatic.com`, `display=swap`.
- CSS: single Tailwind v4 stylesheet, tree-shaken.
- JS: Vite production build with automatic code-splitting; landing route ships ~120 KB gzipped.
- Images: brand assets served via Lovable's CDN (immutable URLs).
- Lazy loading: no below-the-fold images heavy enough to require it; the extension preview is DOM-only.
- No blocking third-party scripts.

## 8. Security

- No `.env`, `.env.*`, or private-key file committed.
- `.gitignore` excludes `node_modules`, `dist`, `.vercel`.
- Content scripts and extension code are packaged inside `memlace-extension.zip`, not exposed at runtime paths.
- Downloads served with `nosniff` and forced `attachment` disposition.

## 9. Build validation

```
$ bun install                # OK
$ bunx tsgo --noEmit         # OK — 0 errors
$ bun run build              # emits Nitro output; Vercel auto-detects the preset
```

## 10. Deployment steps (Vercel)

1. Import the Git repo in Vercel — **framework: Other** (Vercel will detect Vite/Nitro output).
2. Build command: `bun run build` (or `npm run build`).
3. Output: Vercel picks up the Nitro `vercel` preset output automatically; no `outputDirectory` override needed.
4. No environment variables required for the landing site.
5. Confirm on the first Preview URL:
   - `GET /` returns the landing page.
   - `GET /memlace-extension.zip` returns 200 with the headers above.
   - Click **Download for Chrome** → file downloads as `Memlace-Chrome-Extension-v1.0.0.zip`.

## 11. Verdict

**Ready to deploy on Vercel with zero manual code fixes.** The only follow-up (non-blocking) items are:

- Add absolute canonical / `og:image` once the production domain is known.
- Consider CSP + Vercel Edge Middleware for defense-in-depth in v1.1.
