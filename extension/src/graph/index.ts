/**
 * Memory Graph — public surface.
 *
 * Persistent semantic graph connecting every saved object. Updated
 * incrementally by the Orchestrator; read by Search, Ask Memlace,
 * Continue Anywhere, Workspace and Project Brain.
 *
 * No UI. No user editing. Derived data only.
 */
export type * from "./types";
export {
  updateGraphForConversation,
  removeConversationFromGraph,
  nodeId,
  decayedWeight,
} from "./GraphEngine";
export { neighbours, expand, graphBoost, graphStats } from "./GraphSearch";
