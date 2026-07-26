/**
 * Memlace OS — Orchestrator (Phase 13).
 *
 * Every save/delete event flows through here. Modules subscribe via
 * the Event Bus; nothing calls another module directly. The pipeline is
 * declarative and observable via `pipelineSnapshot()` for diagnostics.
 *
 *   Conversation Saved
 *      → Knowledge
 *      → Project Brain
 *      → Personal Intelligence
 *      → Relationships (via PIE)
 *      → Workspace (cache bust)
 *      → Context (cache bust)
 *      → Ask Memlace cache (via cache scope)
 *      → Finished
 */

import type { StoredConversation } from "@/types";
import { emit } from "./EventBus";
import { enqueue } from "./Queue";

interface PipelineStat {
  step: string;
  ok: number;
  err: number;
  lastMs: number;
}
const pipelineStats = new Map<string, PipelineStat>();

function record(step: string, started: number, ok: boolean) {
  const cur =
    pipelineStats.get(step) ?? { step, ok: 0, err: 0, lastMs: 0 };
  cur.lastMs = Math.round(performance.now() - started);
  if (ok) cur.ok++;
  else cur.err++;
  pipelineStats.set(step, cur);
}

async function runStep(step: string, fn: () => Promise<void>) {
  const t = performance.now();
  try {
    await fn();
    record(step, t, true);
  } catch (err) {
    record(step, t, false);
    console.warn(`[memlace:orch] ${step} failed`, err);
  }
}

/**
 * Fire the full post-save pipeline. Runs asynchronously; the caller's
 * DB write has already committed.
 */
export function dispatchConversationSaved(
  conversation: StoredConversation,
  created: boolean,
  source: "manual" | "auto" | "initial",
): void {
  // 1. Broadcast the primary event — cache manager listens too.
  emit("conversation.saved", { conversation, created, source });

  // 2. Enqueue the heavy pipeline on the background queue. Sequential,
  //    deduped by conversation id.
  enqueue(
    `pipeline:${conversation.id}`,
    `Pipeline: ${conversation.title || conversation.id}`,
    async () => {
      await runStep("knowledge", async () => {
        const { onConversationSaved } = await import("@/knowledge/engine");
        await onConversationSaved(conversation);
        emit("knowledge.updated", { conversationId: conversation.id });
      });

      await runStep("projectDetection", async () => {
        const { detectProjectFor } = await import("@/services/projectDetection");
        await detectProjectFor(conversation);
        emit("project.updated", { projectId: conversation.projectId });
      });

      await runStep("personalIntelligence", async () => {
        const { onConversationLearned } = await import("@/pie");
        await onConversationLearned(conversation);
      });

      await runStep("graph", async () => {
        const { updateGraphForConversation } = await import("@/graph");
        await updateGraphForConversation(conversation);
      });

      await runStep("workspace", async () => {
        emit("workspace.updated", {});
      });

      await runStep("context", async () => {
        emit("context.updated", { conversationId: conversation.id });
      });

      // Optional AI enrichment — only if user opted in.
      await runStep("aiEnrichment", async () => {
        const { getSettings } = await import("@/ai/AIManager");
        const s = await getSettings();
        if (!s.enabled || !s.autoEnrich) return;
        const { aiQueue } = await import("@/ai/AIQueue");
        const { enrichConversation } = await import("@/ai/MemoryEngine");
        await aiQueue.enqueue({
          kind: "memory",
          label: `Enrich: ${conversation.title || "(untitled)"}`,
          conversationId: conversation.id,
          estInputTokens: 4000,
          estOutputTokens: 900,
          runner: async () => enrichConversation(conversation.id),
        });
      });
    },
  );
}

export function dispatchConversationDeleted(id: string): void {
  emit("conversation.deleted", { id });
  enqueue(`delete:${id}`, `Cleanup: ${id}`, async () => {
    await runStep("knowledge.cleanup", async () => {
      const { onConversationDeleted } = await import("@/knowledge/engine");
      await onConversationDeleted(id);
    });
    await runStep("graph.cleanup", async () => {
      const { removeConversationFromGraph } = await import("@/graph");
      await removeConversationFromGraph(id);
    });
    emit("workspace.updated", {});
    emit("project.updated", {});
    emit("context.updated", { conversationId: id });
  });
}

export function pipelineSnapshot() {
  return Array.from(pipelineStats.values());
}
