/**
 * Memlace OS — Shared Cache Manager (Phase 13).
 *
 * A single in-memory cache keyed by scope. Replaces the ad-hoc
 * per-engine caches (workspace, project brain, context, answers…).
 * Scopes are strings so any module can participate without a shared
 * enum. Values are opaque; TTL and version tags are optional.
 *
 * Invalidation is driven by the Event Bus: modules never call each
 * other; they emit `cache.invalidated` (or the higher-level domain
 * event) and interested caches wipe themselves.
 */

import { on, emit } from "./EventBus";

interface Entry<T> {
  value: T;
  expiresAt: number;
  version: number;
}

const store = new Map<string, Entry<unknown>>();
const versions = new Map<string, number>();
const stats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };

export function get<T>(scope: string, key: string): T | undefined {
  const full = `${scope}::${key}`;
  const e = store.get(full) as Entry<T> | undefined;
  if (!e) {
    stats.misses++;
    return undefined;
  }
  if (e.expiresAt && e.expiresAt < Date.now()) {
    store.delete(full);
    stats.misses++;
    return undefined;
  }
  const v = versions.get(scope) ?? 0;
  if (e.version !== v) {
    store.delete(full);
    stats.misses++;
    return undefined;
  }
  stats.hits++;
  return e.value;
}

export function set<T>(scope: string, key: string, value: T, ttlMs = 5 * 60_000): void {
  const full = `${scope}::${key}`;
  const v = versions.get(scope) ?? 0;
  store.set(full, {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    version: v,
  });
  stats.sets++;
}

export function invalidate(scope: string): void {
  versions.set(scope, (versions.get(scope) ?? 0) + 1);
  stats.invalidations++;
  emit("cache.invalidated", { scope });
}

export async function getOrSet<T>(
  scope: string,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = get<T>(scope, key);
  if (hit !== undefined) return hit;
  const value = await loader();
  set(scope, key, value, ttlMs);
  return value;
}

export function snapshot() {
  const ratio =
    stats.hits + stats.misses === 0 ? 0 : stats.hits / (stats.hits + stats.misses);
  return {
    entries: store.size,
    scopes: versions.size,
    hits: stats.hits,
    misses: stats.misses,
    sets: stats.sets,
    invalidations: stats.invalidations,
    hitRatio: Number(ratio.toFixed(3)),
  };
}

// Wire domain events → cache scope invalidations. This is the only
// place that translates between the two layers.
on("conversation.saved", () => {
  invalidate("workspace");
  invalidate("projects");
  invalidate("context");
  invalidate("answers");
  invalidate("search");
});
on("conversation.deleted", () => {
  invalidate("workspace");
  invalidate("projects");
  invalidate("context");
  invalidate("answers");
  invalidate("search");
});
on("knowledge.updated", () => {
  invalidate("knowledge");
  invalidate("answers");
  invalidate("search");
});
on("project.updated", () => {
  invalidate("projects");
  invalidate("workspace");
});
