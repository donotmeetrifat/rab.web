/**
 * Memlace OS — public core surface.
 *
 * Every module that needs to react to system events, share cache, or
 * enqueue background work goes through here. Nothing else.
 */

export * as bus from "./EventBus";
export * as cache from "./Cache";
export * as queue from "./Queue";
export {
  dispatchConversationSaved,
  dispatchConversationDeleted,
  pipelineSnapshot,
} from "./Orchestrator";
import { snapshot as cacheSnapshot } from "./Cache";
import { snapshot as queueSnapshot } from "./Queue";
import { _subscriberCount } from "./EventBus";
import { pipelineSnapshot } from "./Orchestrator";

/** Engine Health — for the internal diagnostics panel only. */
export function engineHealth() {
  return {
    cache: cacheSnapshot(),
    queue: queueSnapshot(),
    subscribers: _subscriberCount(),
    pipeline: pipelineSnapshot(),
    ts: Date.now(),
  };
}
