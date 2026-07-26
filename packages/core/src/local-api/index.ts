/**
 * Local API — the contract other Memlace clients (Desktop, VS Code,
 * Cursor, future Mobile) call over IPC / localhost / message ports.
 *
 * Serverless: this file defines the JSON message shape only. Each
 * platform adapter wires it to the appropriate transport
 * (chrome.runtime.onMessageExternal, Electron IPC, VS Code webview,
 * Node localhost, WebSocket, …). Nothing here opens a socket.
 */

export const LOCAL_API_VERSION = 1;

export type LocalApiMethod =
  | "ping"
  | "search"
  | "ask"
  | "listConversations"
  | "getConversation"
  | "listProjects"
  | "getProject"
  | "buildContext"
  | "importArchive"
  | "exportArchive"
  | "listProviders";

export interface LocalApiRequest<M extends LocalApiMethod = LocalApiMethod> {
  version: typeof LOCAL_API_VERSION;
  id: string;
  method: M;
  params?: Record<string, unknown>;
  /** Caller identity, e.g. "memlace-desktop@0.1.0". */
  client: string;
}

export interface LocalApiResponse<T = unknown> {
  version: typeof LOCAL_API_VERSION;
  id: string;
  ok: boolean;
  result?: T;
  error?: { code: string; message: string };
}

/** Handler signature clients register per method. */
export type LocalApiHandler = (params: unknown) => Promise<unknown>;

const handlers = new Map<LocalApiMethod, LocalApiHandler>();

export function registerHandler(method: LocalApiMethod, handler: LocalApiHandler): void {
  handlers.set(method, handler);
}

export async function dispatch(request: LocalApiRequest): Promise<LocalApiResponse> {
  if (request.version !== LOCAL_API_VERSION) {
    return {
      version: LOCAL_API_VERSION,
      id: request.id,
      ok: false,
      error: { code: "version_mismatch", message: `expected v${LOCAL_API_VERSION}` },
    };
  }
  const handler = handlers.get(request.method);
  if (!handler) {
    return {
      version: LOCAL_API_VERSION,
      id: request.id,
      ok: false,
      error: { code: "unknown_method", message: request.method },
    };
  }
  try {
    const result = await handler(request.params ?? {});
    return { version: LOCAL_API_VERSION, id: request.id, ok: true, result };
  } catch (err) {
    return {
      version: LOCAL_API_VERSION,
      id: request.id,
      ok: false,
      error: {
        code: "handler_error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/** Built-in ping handler so any transport can smoke-test its wiring. */
registerHandler("ping", async () => ({ pong: true, ts: Date.now() }));
