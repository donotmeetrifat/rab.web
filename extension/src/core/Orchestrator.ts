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

// STATIC imports — every module in the post-save pipeline is bundled
// into the caller's entry (content script, popup, background). This is
// mandatory for MV3 content scripts, where dynamic `import()` chunks
// resolve against the host page origin (chatgpt.com/…) and 404. Do NOT
// convert these back to `await import(...)`.
import { onConversationSaved, onConversationDeleted } from "@/knowledge/engine";
import { detectProjectFor } from "@/services/projectDetection";
import { onConversationLearned } from "@/pie";
import {
  updateGraphForConversation,
  removeConversationFromGraph,
} from "@/graph";
import { getSettings } from "@/ai/AIManager";
import { aiQueue } from "@/ai/AIQueue";
import { enrichConversation } from "@/ai/MemoryEngine";

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
    // Secondary engines must never block the save — log and move on.
    console.warn(`[Memlace] pipeline stage failed: ${step}`, err);
  }
}

/**
 * Fire the full post-save pipeline. Runs asynchronously; the caller's
 * DB write has already committed. Any stage that throws is isolated so
 * the conversation stays safely stored even if downstream engines fail.
 */
export function dispatchConversationSaved(
  conversation: StoredConversation,
  created: boolean,
  source: "manual" | "auto" | "initial",
): void {
  emit("conversation.saved", { conversation, created, source });

  enqueue(
    `pipeline:${conversation.id}`,
    `Pipeline: ${conversation.title || conversation.id}`,
    async () => {
      await runStep("knowledge", async () => {
        await onConversationSaved(conversation);
        emit("knowledge.updated", { conversationId: conversation.id });
      });

      await runStep("projectDetection", async () => {
        await detectProjectFor(conversation);
        emit("project.updated", { projectId: conversation.projectId });
      });

      await runStep("personalIntelligence", async () => {
        await onConversationLearned(conversation);
      });

      await runStep("graph", async () => {
        await updateGraphForConversation(conversation);
      });

      await runStep("workspace", async () => {
        emit("workspace.updated", {});
      });

      await runStep("context", async () => {
        emit("context.updated", { conversationId: conversation.id });
      });

      await runStep("aiEnrichment", async () => {
        const s = await getSettings();
        if (!s.enabled || !s.autoEnrich) return;
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
      await onConversationDeleted(id);
    });
    await runStep("graph.cleanup", async () => {
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
