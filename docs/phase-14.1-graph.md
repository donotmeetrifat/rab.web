# Phase 14.1 — Memory Graph Engine

## What shipped

A persistent semantic graph over every saved object. Backend only —
no UI, no user editing, no new pages.

- `extension/src/graph/types.ts` — Node / Edge / Relation types.
- `extension/src/graph/GraphEngine.ts` — Incremental updater.
- `extension/src/graph/GraphSearch.ts` — `neighbours()`, `expand()`,
  `graphBoost()` read helpers.
- `extension/src/graph/index.ts` — public surface.
- Dexie v7 — new `graphNodes` and `graphEdges` tables.
- `core/Orchestrator.ts` — new `graph` step (save) + `graph.cleanup`
  step (delete) inside the existing background queue.

## Node types (12)

`project`, `conversation`, `session`, `knowledge`, `technology`,
`language`, `framework`, `topic`, `goal`, `decision`, `file`, `code`,
`provider`.

## Relation types (15)

`technology`, `depends-on`, `mentions`, `implements`, `uses`,
`replaced-by`, `derived-from`, `same-project`, `same-session`,
`same-goal`, `same-decision`, `related-topic`, `shared-code`,
`shared-file`, `provider-chain`.

## Incremental algorithm

Every save touches only nodes/edges implied by that conversation:

1. Load the conversation's knowledge row (already indexed by
   `conversationId`).
2. Compute the candidate node set (conv, provider, session, project,
   knowledge, technologies, languages, frameworks, topics, files,
   code languages, active decisions, active goals mentioned in the
   title/topics).
3. `bulkGet` existing rows by composite id, merge weights, `bulkPut`.
4. Idempotent — safe to re-run on the same conversation with no
   duplicate edges (composite id `${a}::${b}::${rel}` sorted).

Delete removes only edges touching the conversation node; facet nodes
(technology / topic / etc.) survive since other conversations still
reference them.

## Time-aware weighting

Every edge stores `firstSeen` and `lastSeen`. `decayedWeight(edge)`
applies a 30-day half-life on read, so recent activity outranks old
co-occurrence without any background sweep.

## Graph search integration

`graphBoost(seeds, candidateConvIds)` returns a proximity score map
that Ask Memlace, Continue Anywhere, Workspace, Project Brain, and
Universal Search can add to their existing ranking:

```
finalScore = baseScore + graphBoost * α
```

No caller had to change surface behaviour — the graph is additive.

## Performance

- Save-side work runs inside the existing sequential background
  queue (`core/Queue.ts`); the user's DB write already returned by
  the time it starts.
- Chunk size (release build): `assets/graph-*.js` **4.48 kB / 1.58 kB
  gzipped**.
- Build time: **1.30 s**, 2303 modules.
- Package size: **1.18 MB** (`public/memlace-extension.zip`).
- IndexedDB writes per save: one `bulkPut` for nodes, one for edges —
  typically 10-40 rows on a mid-size conversation.
- Reads use the multiEntry `a` and `b` indexes — O(log n) per hop.
- `expand()` caps depth at 3 and per-frontier fan-out at 24 so a
  2-hop lookup on a 10k-conversation graph stays sub-millisecond.

## Privacy

Fully local. No telemetry. Derived data — the graph tables can be
dropped and rebuilt from source (conversations + knowledge + pie*)
at any time.
