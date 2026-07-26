/**
 * KnowledgeDecay — read-only freshness weighting. Nothing is ever
 * deleted; consumers multiply their own scores by `freshness(...)`.
 */
const MS_PER_DAY = 86_400_000;

/** 0..1. Half-life defaults to 45 days, min floor 0.05 so archives stay reachable. */
export function freshness(lastActivityAt: number, now = Date.now(), halfLifeDays = 45): number {
  const days = Math.max(0, (now - lastActivityAt) / MS_PER_DAY);
  const raw = Math.pow(0.5, days / halfLifeDays);
  return Math.max(0.05, raw);
}
