/**
 * Universal Provider SDK.
 *
 * A provider is a plugin. registerProvider() takes one manifest;
 * everything downstream (Continue Anywhere, Search, Timeline,
 * Knowledge, Projects) picks it up automatically.
 */

export type ProviderCapability =
  | "capture"          // can capture live conversations
  | "continue"         // can accept a pasted continuation
  | "import"           // can parse exported archives
  | "codeAware"        // exposes rich code blocks
  | "images"
  | "attachments";

export interface ProviderSelectors {
  /** CSS/XPath selectors used by the capture pipeline. Adapter-specific. */
  root?: string;
  message?: string;
  userMessage?: string;
  assistantMessage?: string;
  composer?: string;
  submitButton?: string;
  [k: string]: string | undefined;
}

export interface ContinueAdapterSpec {
  /** URL that opens a fresh chat for a paste-and-go continuation. */
  newChatUrl: string;
  /** Approx max context characters the destination model accepts. */
  maxContextChars: number;
  /** Optional focus selector to place caret in the composer. */
  focusSelector?: string;
}

export interface ProviderManifest {
  id: string;
  displayName: string;
  hostPatterns: string[];
  capabilities: ProviderCapability[];
  selectors?: ProviderSelectors;
  continueAdapter?: ContinueAdapterSpec;
  /** Optional parser for capturing rendered DOM into CapturedConversation.
   *  When omitted, the platform's default DOM parser is used. */
  parseConversation?: (root: unknown) => unknown;
  /** Optional import parser for offline archives. */
  parseImport?: (source: unknown) => Promise<unknown>;
}

const registry = new Map<string, ProviderManifest>();

export function registerProvider(manifest: ProviderManifest): () => void {
  if (registry.has(manifest.id)) {
    console.warn(`[provider-sdk] "${manifest.id}" already registered — overwriting`);
  }
  registry.set(manifest.id, manifest);
  return () => registry.delete(manifest.id);
}

export function listProviders(): ProviderManifest[] {
  return Array.from(registry.values());
}

export function getProvider(id: string): ProviderManifest | undefined {
  return registry.get(id);
}

export function matchProviderByHost(hostname: string): ProviderManifest | undefined {
  const h = hostname.toLowerCase();
  for (const m of registry.values()) {
    for (const p of m.hostPatterns) {
      if (h === p || h.endsWith(`.${p}`)) return m;
    }
  }
  return undefined;
}
