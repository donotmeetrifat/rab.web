/**
 * ContextCache — small in-memory LRU keyed by
 * `${conversationHash}:${target}`. Invalidated when the conversation
 * hash flips (write path) or when knowledge/project mapping change.
 *
 * Deliberately memory-only: context packages are cheap to rebuild and
 * writing them to IndexedDB would double the storage cost with no
 * user-visible benefit.
 */
import type { ContextPackage } from "./types";
import type { ProviderId } from "@/types";

const MAX = 64;
const cache = new Map<string, ContextPackage>();

function key(conversationId: string, hash: string, target: ProviderId): string {
  return `${conversationId}@${hash}::${target}`;
}

export function getCached(
  conversationId: string,
  hash: string,
  target: ProviderId,
): ContextPackage | null {
  const k = key(conversationId, hash, target);
  const hit = cache.get(k);
  if (!hit) return null;
  // Refresh LRU position.
  cache.delete(k);
  cache.set(k, hit);
  return hit;
}

export function setCached(
  conversationId: string,
  hash: string,
  pkg: ContextPackage,
): void {
  const k = key(conversationId, hash, pkg.target);
  cache.set(k, pkg);
  if (cache.size > MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

export function invalidateContext(conversationId?: string): void {
  if (!conversationId) {
    cache.clear();
    return;
  }
  const prefix = `${conversationId}@`;
  for (const k of [...cache.keys()]) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}
