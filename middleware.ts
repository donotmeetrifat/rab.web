// Vercel Edge Middleware — applies security headers (including CSP) to every
// response consistently, regardless of whether the response came from the
// static CDN, the SSR handler, or a server route.
//
// This complements `vercel.json`: cache headers stay declarative there;
// security-sensitive headers live here so they can (a) be shipped as one
// audited unit and (b) evolve toward per-request nonces later.
//
// Docs: https://vercel.com/docs/edge-middleware

import { next } from "@vercel/edge";

export const config = {
  // Skip the static asset routes that already have their own header rules in
  // vercel.json and would only be slowed down by middleware execution.
  matcher: [
    "/((?!_next/static|_next/image|assets/|favicon\\.png|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|memlace-extension\\.zip).*)",
  ],
};

// Strict CSP.
//
// `script-src` includes `'unsafe-inline'` because TanStack Start's SSR emits a
// small hydration script inline. Modern browsers ignore `'unsafe-inline'` when
// `'strict-dynamic'` is present, but we keep it as a fallback for older
// browsers that don't understand `'strict-dynamic'`. When we introduce
// per-request nonces (v1.2), swap `'unsafe-inline'` for `'nonce-<value>'`.
//
// `style-src` allows `'unsafe-inline'` for Tailwind-injected styles and Google
// Fonts stylesheet, plus the Google Fonts host.
//
// `connect-src` is `'self'` — the landing page has no third-party API calls.
const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'strict-dynamic'"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "connect-src": ["'self'"],
  "media-src": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "manifest-src": ["'self'"],
  "worker-src": ["'self'", "blob:"],
  "upgrade-insecure-requests": [],
};

const CSP = Object.entries(CSP_DIRECTIVES)
  .map(([directive, values]) => (values.length ? `${directive} ${values.join(" ")}` : directive))
  .join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};

export default function middleware(_request: Request) {
  const response = next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
