import type { ProviderId } from "@/types";
import type { WatchState } from "./ProviderAdapter";

export interface StateTraceContext {
  conversationId?: string | null;
  provider?: ProviderId | null;
  currentWatchState?: WatchState;
  previousWatchState?: WatchState;
  detail?: unknown;
}

export interface StateTraceEntry extends StateTraceContext {
  stage: string;
  functionName: string;
  timestamp: string;
}

declare global {
  interface Window {
    __memlaceStateTrace?: StateTraceEntry[];
  }
}

const TRACE_LIMIT = 500;

/** Diagnostic-only state-flow logger. It does not mutate pipeline state. */
export function traceStateFlow(
  stage: string,
  functionName: string,
  context: StateTraceContext = {},
): StateTraceEntry {
  const entry: StateTraceEntry = {
    stage,
    functionName,
    timestamp: new Date().toISOString(),
    conversationId: context.conversationId ?? null,
    provider: context.provider ?? null,
    currentWatchState: context.currentWatchState,
    previousWatchState: context.previousWatchState,
    detail: context.detail,
  };

  console.log("[Memlace][StateFlow]", entry);
  if (
    context.currentWatchState &&
    context.previousWatchState &&
    context.currentWatchState !== context.previousWatchState
  ) {
    console.log(
      `[Memlace]\nSTATE:\n${context.previousWatchState}\n→ ${context.currentWatchState}`,
      {
        conversationId: entry.conversationId,
        provider: entry.provider,
        timestamp: entry.timestamp,
      },
    );
  }

  try {
    const trace = window.__memlaceStateTrace ?? [];
    trace.push(entry);
    if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
    window.__memlaceStateTrace = trace;
  } catch {
    // Diagnostics must never affect the save pipeline.
  }

  return entry;
}