/**
 * Plugin system — read-only, permission-controlled, isolated.
 *
 * Plugins never touch storage or the network directly. They receive
 * a scoped `PluginHost` interface with only the capabilities their
 * manifest requested (and the user granted).
 */

export type PluginPermission =
  | "read.files"
  | "read.notion"
  | "read.github"
  | "read.obsidian"
  | "read.gdrive"
  | "search.contribute";

export interface PluginManifest {
  id: string;
  displayName: string;
  description: string;
  version: string;
  permissions: PluginPermission[];
  /** When true, plugin cannot contribute to search until user opts in. */
  requiresExplicitEnable?: boolean;
}

export interface PluginSearchResult {
  id: string;
  title: string;
  snippet?: string;
  url?: string;
  score?: number;
}

export interface PluginHost {
  /** Emit a search contribution for the shared universal index. */
  contributeSearch(results: PluginSearchResult[]): void;
  log(msg: string, ...args: unknown[]): void;
}

export interface Plugin {
  manifest: PluginManifest;
  /** Called once when the user enables the plugin. */
  onEnable?: (host: PluginHost) => Promise<void>;
  /** Called on every universal search. Must be fast. */
  onSearch?: (query: string, host: PluginHost) => Promise<void>;
  /** Called when the user disables/uninstalls the plugin. */
  onDisable?: () => Promise<void>;
}

const registry = new Map<string, Plugin>();
const enabled = new Set<string>();
const grants = new Map<string, Set<PluginPermission>>();

export function registerPlugin(plugin: Plugin): void {
  registry.set(plugin.manifest.id, plugin);
}

export function listPlugins(): PluginManifest[] {
  return Array.from(registry.values()).map((p) => p.manifest);
}

export function isEnabled(id: string): boolean {
  return enabled.has(id);
}

export function hasPermission(id: string, permission: PluginPermission): boolean {
  return grants.get(id)?.has(permission) ?? false;
}

export async function enablePlugin(
  id: string,
  granted: PluginPermission[],
  host: PluginHost,
): Promise<void> {
  const p = registry.get(id);
  if (!p) throw new Error(`Unknown plugin: ${id}`);
  const missing = p.manifest.permissions.filter((perm) => !granted.includes(perm));
  if (missing.length) {
    throw new Error(`Plugin "${id}" missing permissions: ${missing.join(", ")}`);
  }
  grants.set(id, new Set(granted));
  enabled.add(id);
  await p.onEnable?.(host);
}

export async function disablePlugin(id: string): Promise<void> {
  const p = registry.get(id);
  enabled.delete(id);
  grants.delete(id);
  await p?.onDisable?.();
}

export async function runPluginSearch(query: string, host: PluginHost): Promise<void> {
  await Promise.allSettled(
    Array.from(enabled).map(async (id) => {
      const p = registry.get(id);
      if (!p?.onSearch) return;
      try {
        await p.onSearch(query, host);
      } catch (err) {
        host.log(`[plugin:${id}] search failed`, err);
      }
    }),
  );
}
