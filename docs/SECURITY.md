# Security

## Model
- **Local-first.** All user data lives in the browser (`chrome.storage.local` + IndexedDB).
- **No backend.** Memlace has no server, no account system, no auth tokens.
- **No remote code.** All JavaScript is bundled at build time. No `eval`, no dynamic `<script>` injection, no remote imports.
- **CSP.** The extension inherits Manifest V3's strict CSP (`script-src 'self'`, `object-src 'self'`). Inline scripts are not used.
- **Optional AI keys** are stored locally and never leave the browser except to the provider you configured.

## Reporting a vulnerability
Please email **security@memlace.app** (placeholder). We aim to acknowledge within 72 hours.
Please do not open a public issue for suspected vulnerabilities.

## Scope
In scope: the extension bundle shipped on the Chrome Web Store.
Out of scope: third-party AI providers, host websites, user-supplied API keys.
