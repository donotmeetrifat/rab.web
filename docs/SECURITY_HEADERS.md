# Edge Middleware & Content Security Policy

**File:** `middleware.ts` (Vercel Edge Middleware, runs at the edge on every non-static request)

## Why middleware and not just `vercel.json`

`vercel.json` can only match by path. Security headers need to apply to
**every** response — HTML from SSR, JSON from server routes, error pages
from the framework runtime — with a single audited definition. Middleware
runs after the response is produced and injects the headers uniformly.

Static assets (`/assets/*`, favicon, robots, sitemap, extension zip) skip
middleware via the `matcher` — they already have their own cache/security
rules in `vercel.json` and don't need CSP evaluation.

## Applied headers

| Header | Value | Reason |
| --- | --- | --- |
| `Content-Security-Policy` | see below | Restricts script/style/connect origins |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevents framing (belt + `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Minimal referrer leakage |
| `Permissions-Policy` | camera/mic/geo/payment/usb/FLoC disabled | Deny unused browser APIs |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | 2y HSTS with preload |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browsing context |
| `Cross-Origin-Resource-Policy` | `same-origin` | Blocks cross-origin embedding |
| `X-DNS-Prefetch-Control` | `off` | Disables implicit DNS prefetch |

## CSP directives

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'strict-dynamic';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
connect-src 'self';
media-src 'self';
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
manifest-src 'self';
worker-src 'self' blob:;
upgrade-insecure-requests
```

### Notes

- **`script-src`** includes `'unsafe-inline'` **and** `'strict-dynamic'`.
  Modern browsers that understand `'strict-dynamic'` **ignore**
  `'unsafe-inline'`; older browsers use it as a fallback for TanStack Start's
  inline hydration script. When per-request nonces are added (v1.2),
  swap `'unsafe-inline'` for `'nonce-<value>'` injected by the middleware
  and mirrored into the SSR render.
- **`connect-src 'self'`** — the landing page has no third-party API calls.
  Widen this deliberately if analytics or forms are added later.
- **`frame-ancestors 'none'`** + **`X-Frame-Options: DENY`** — anti-clickjacking.
- **`upgrade-insecure-requests`** — auto-upgrades any accidental `http://`
  references to `https://`.

## Roadmap

- v1.1 — this middleware. Header-only, no HTML rewriting.
- v1.2 — per-request nonce; drop `'unsafe-inline'` from `script-src`; add a
  CSP report endpoint (`report-uri /api/public/csp-report`).
- v1.3 — Trusted Types (`require-trusted-types-for 'script'`).
