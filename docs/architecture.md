# Memlace OS — Phase 13 Architecture

## Overview

Phase 13 unifies every engine behind three primitives:

1. **Event Bus** (`extension/src/core/EventBus.ts`) — pub/sub, zero deps.
2. **Orchestrator** (`extension/src/core/Orchestrator.ts`) — the only place
   that knows the full post-save pipeline.
3. **Shared Cache** (`extension/src/core/Cache.ts`) — scoped, versioned,
   invalidated by bus events.

Plus a **Background Queue** (`Queue.ts`) that serializes expensive work.

Public surface: `import { bus, cache, queue, dispatchConversationSaved, engineHealth } from "@/core"`.

## Pipeline

```
saveConversation()
    │
    ▼
dispatchConversationSaved()  ── emits ──► "conversation.saved"
    │                                       │
    │                                       ├── cache scopes invalidated
    │                                       ├── onboarding checklist
    │                                       └── UI subscribers refresh
    ▼
Queue.enqueue("pipeline:<id>")
    ├── knowledge.onConversationSaved()  → emit "knowledge.updated"
    ├── projectDetection.detectProjectFor() → emit "project.updated"
    ├── pie.onConversationLearned()
    ├── emit "workspace.updated"
    ├── emit "context.updated"
    └── optional AI enrichment (if opted in)
```

Every step is timed and recorded (`pipelineSnapshot()`).

## Rules

- **No direct engine-to-engine calls.** Engines emit or subscribe.
- **All caches** go through `cache.getOrSet(scope, key, ttl, loader)`.
- **All heavy work** goes through `queue.enqueue(id, label, run)`.
- **Provider adapters** register themselves in `providers/registry.ts`
  (existing plugin architecture is preserved and documented in
  `docs/plugin-guide.md`).

## Cross-platform core

`extension/src/core/` + `knowledge/`, `context/`, `pie/`, `services/`
have no `chrome.*` dependencies at their public surface, so they can be
lifted verbatim into `@memlace/core` for VS Code / Desktop / Cloud
targets. Storage (`lib/db.ts`) is the only Dexie-bound module and is
already isolated behind a repository-shaped API.
