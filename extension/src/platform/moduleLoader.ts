/**
 * Chrome Extension module loader.
 *
 * MV3 content scripts run in the page's origin. Any relative `import(...)`
 * or Vite-emitted chunk URL is therefore resolved against the host page
 * (e.g. `https://chatgpt.com/assets/foo.js`) and 404s.
 *
 * `loadExtensionModule(path)` guarantees the request is rewritten to the
 * extension origin via `chrome.runtime.getURL()`.
 *
 * Rules for the codebase:
 *   - Never write `import("./x.js")` or `import("/assets/x.js")` inside
 *     content-script-reachable code.
 *   - Prefer static `import x from "@/x"`. Only reach for
 *     `loadExtensionModule` when true lazy loading is required (large
 *     optional feature, opt-in path, etc.).
 */

export function extensionUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(clean);
  }
  // Fallback for tests / non-extension environments.
  return `/${clean}`;
}

export function loadExtensionModule<T = unknown>(path: string): Promise<T> {
  return import(/* @vite-ignore */ extensionUrl(path)) as Promise<T>;
}
