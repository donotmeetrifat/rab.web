/**
 * Local API bridge — Chrome/Edge/Firefox transport.
 *
 * Wires @memlace/core's transport-agnostic `dispatch()` to
 * chrome.runtime.onMessageExternal so companion Memlace clients
 * (Desktop, VS Code extension, Cursor, Windsurf) can talk to the
 * user's local Memlace brain without any cloud.
 *
 * Only whitelisted extension IDs are accepted; the user must
 * explicitly install the companion first.
 */

import { dispatch, registerHandler } from "@memlace/core/local-api";
import type { LocalApiRequest } from "@memlace/core/local-api";

// Handlers translate protocol-level calls into internal services.
// Kept minimal by design; more can be added later without touching
// the transport.
registerHandler("listProviders", async () => {
  const { listProviders } = await import("@memlace/core/provider-sdk");
  return { providers: listProviders() };
});

registerHandler("listConversations", async () => {
  const { listConversations } = await import("@/services/conversations");
  const rows = await listConversations();
  return { conversations: rows.map((r) => ({
    id: r.id, title: r.title, provider: r.provider, updatedAt: r.updatedAt,
  })) };
});

registerHandler("search", async (params) => {
  const q = (params as { query?: string }).query ?? "";
  if (!q.trim()) return { results: [] };
  const { searchConversations } = await import("@/services/conversations");
  const hits = await searchConversations({ query: q });
  return { results: hits.slice(0, 20) };
});

export function installLocalApiTransport(): void {
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessageExternal) return;
  chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    const req = msg as LocalApiRequest;
    if (!req || typeof req !== "object" || req.version !== 1) {
      sendResponse({ ok: false, error: { code: "bad_request", message: "invalid envelope" } });
      return;
    }
    // Async — return true so Chrome keeps the port open.
    dispatch(req)
      .then((res) => sendResponse(res))
      .catch((err) =>
        sendResponse({
          version: 1,
          id: req.id,
          ok: false,
          error: { code: "internal", message: String(err) },
        }),
      );
    return true;
  });
}
