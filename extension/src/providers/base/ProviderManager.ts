import type { IndicatorHandlers, ProviderAdapter, WatchState } from "./ProviderAdapter";
import type { CapturedConversation } from "./types";
import { hashConversation } from "./hash";

export type SaveOutcome =
  | { ok: true; verified: boolean; conversationId: string }
  | { ok: false; stage: string; error: unknown };

export interface ManagerEvents {
  onConversationChanged: (payload: {
    conversation: CapturedConversation;
    hash: string;
    reason: "auto" | "initial";
  }) => Promise<SaveOutcome> | SaveOutcome;
  /** Master kill-switch. Default: on. When false, the indicator still shows
   *  "Watching" but no snapshots are written. */
  isAutoSaveEnabled: () => boolean;
}

/**
 * Owns the lifecycle of a single active provider adapter for the current page.
 *
 * Invisible Auto Memory algorithm:
 *   1. Adapter fires `observeChanges` on any DOM mutation.
 *   2. Manager schedules a *quiet-window* timer (QUIET_WINDOW_MS, default
 *      2500ms). Every subsequent mutation resets the timer.
 *   3. When the timer finally elapses — meaning the DOM has been idle for
 *      the full window and the AI response has stopped streaming — the
 *      manager takes a snapshot.
 *   4. The snapshot is hashed and compared to the last saved hash. If the
 *      content is unchanged (scrolls, hovers, UI-only mutations, typing
 *      indicators that disappear without new text) the save is skipped.
 *   5. Otherwise the snapshot is persisted through the caller-supplied
 *      `onConversationChanged`. That handler is responsible for writing to
 *      IndexedDB — meaning the data is durable across crashes as soon as
 *      the transaction commits.
 *
 * Deduplication is enforced by `(provider, providerConversationId)` inside
 * the storage layer, so re-mounts and SPA re-hydration never create
 * duplicates.
 */
export class ProviderManager {
  /** Time the DOM must remain idle before we treat the response as complete. */
  private static readonly QUIET_WINDOW_MS = 2500;
  /** Minimum gap between two consecutive writes for the same conversation. */
  private static readonly WRITE_COOLDOWN_MS = 750;

  private adapters: ProviderAdapter[];
  private active: ProviderAdapter | null = null;
  private disposeObserver: (() => void) | null = null;
  private disposeIndicator: (() => void) | null = null;
  private lastHash: string | null = null;
  private lastConversationId: string | null = null;
  private lastWriteAt = 0;
  private watchState: WatchState = "watching";
  private quietTimer: number | null = null;
  private stateResetTimer: number | null = null;
  private urlPollTimer: number | null = null;
  private currentUrl = "";
  private disposed = false;
  private savingInFlight = false;

  constructor(adapters: ProviderAdapter[], private events: ManagerEvents) {
    this.adapters = adapters;
  }

  start(): void {
    this.currentUrl = location.href;
    this.reconcile();
    hookHistory(() => this.onUrlMaybeChanged());
    window.addEventListener("popstate", this.onUrlMaybeChanged);
    this.urlPollTimer = window.setInterval(this.onUrlMaybeChanged, 1500);
  }

  cleanup(): void {
    this.disposed = true;
    window.removeEventListener("popstate", this.onUrlMaybeChanged);
    if (this.urlPollTimer !== null) clearInterval(this.urlPollTimer);
    if (this.quietTimer !== null) clearTimeout(this.quietTimer);
    if (this.stateResetTimer !== null) clearTimeout(this.stateResetTimer);
    this.tearDownActive();
  }

  private onUrlMaybeChanged = (): void => {
    if (this.disposed) return;
    if (location.href === this.currentUrl) return;
    this.currentUrl = location.href;
    this.reconcile();
  };

  private reconcile(): void {
    const url = location.href;
    const next = this.adapters.find((a) => a.matches(url)) ?? null;

    if (next !== this.active) {
      this.tearDownActive();
      this.active = next;
      this.lastHash = null;
      this.lastConversationId = null;
      this.setWatchState("watching");
    }

    if (!this.active) return;

    waitFor(
      () => this.active?.detect() === true,
      () => this.wireActive(),
    );
  }

  private wireActive(): void {
    if (!this.active || this.disposed) return;

    if (!this.disposeObserver) {
      this.disposeObserver = this.active.observeChanges(() => this.armQuietWindow());
    }
    if (!this.disposeIndicator) {
      const handlers: IndicatorHandlers = { getState: () => this.watchState };
      this.disposeIndicator = this.active.injectIndicator(handlers);
    }
    // Initial pass — capture whatever's already rendered.
    this.armQuietWindow();
  }

  /**
   * Reset the "response finished streaming" timer. Every DOM mutation
   * bumps it forward, so we only fire once the page has been fully quiet
   * for QUIET_WINDOW_MS.
   */
  private armQuietWindow(): void {
    if (this.disposed) return;
    if (this.quietTimer !== null) clearTimeout(this.quietTimer);
    this.quietTimer = window.setTimeout(() => {
      this.quietTimer = null;
      void this.snapshot();
    }, ProviderManager.QUIET_WINDOW_MS);
  }

  private async snapshot(): Promise<void> {
    if (!this.active || this.disposed) return;
    if (this.savingInFlight) return;

    // Stage 1: extract
    this.setWatchState("extracting");
    const convo = this.active.getConversation();

    // No conversation, or partial (empty) DOM — treat as UI noise and stay
    // in "watching". Never persist an empty conversation.
    if (!convo || convo.messages.length === 0) {
      this.setWatchState("watching");
      return;
    }

    // Guard against writing a half-streamed final message: the last
    // assistant message must have non-empty content.
    const last = convo.messages[convo.messages.length - 1];
    if (last.role === "assistant" && !(last.content || last.markdown || "").trim()) {
      this.setWatchState("watching");
      return;
    }

    // Detect conversation switch inside the same provider.
    if (this.lastConversationId && this.lastConversationId !== convo.conversationId) {
      this.lastHash = null;
    }
    this.lastConversationId = convo.conversationId;

    const hash = hashConversation(convo);
    console.debug(
      "[Memlace] conversation detected",
      { provider: convo.provider, messages: convo.messages.length, hash: hash.slice(0, 8) },
    );

    if (hash === this.lastHash) {
      // No new content — flash "No changes" briefly, then return to watch.
      this.setWatchState("skipped");
      this.scheduleStateReset(900);
      return;
    }

    if (!this.events.isAutoSaveEnabled()) {
      // Kill-switch off: still track the hash so we don't re-fire on the
      // same content once the user re-enables auto memory.
      this.lastHash = hash;
      this.setWatchState("watching");
      return;
    }

    // Cooldown: coalesce bursts (e.g. two mutations 100ms apart that both
    // survived the quiet window somehow) into a single write.
    const now = Date.now();
    if (now - this.lastWriteAt < ProviderManager.WRITE_COOLDOWN_MS) {
      this.setWatchState("watching");
      return;
    }

    this.savingInFlight = true;
    const started = performance.now();
    try {
      console.log("[Memlace] Saving…", {
        provider: convo.provider,
        messages: convo.messages.length,
      });
      this.setWatchState("saving");
      // Hard 8s timeout: the primary save must never pin the indicator.
      // If the handler stalls (e.g. a background message never resolves),
      // we surface the failure and reset the pill instead of hanging.
      const savePromise = this.events.onConversationChanged({
        conversation: convo,
        hash,
        reason: this.lastHash === null ? "initial" : "auto",
      });
      const outcome = (await Promise.race([
        savePromise,
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: false, stage: "timeout", error: new Error("save timed out after 8s") } as const), 8000),
        ),
      ])) as Awaited<ReturnType<ManagerEvents["onConversationChanged"]>>;
      if (!outcome.ok) {
        throw new Error(`stage:${outcome.stage}`);
      }
      // DB has committed. Downstream engines (knowledge, project, PIE,
      // graph, workspace, context) fire on the Orchestrator's queue and
      // never block us here.
      this.setWatchState("indexing");
      this.lastHash = hash;
      this.lastWriteAt = Date.now();
      const duration = Math.round(performance.now() - started);
      if (outcome.verified) {
        this.setWatchState("synced");
        console.log("[Memlace] Saved successfully", {
          conversationId: outcome.conversationId,
          provider: convo.provider,
          messages: convo.messages.length,
          hash: hash.slice(0, 8),
          ms: duration,
        });
      } else {
        this.setWatchState("error");
        console.warn("[Memlace] Storage verification failed", {
          conversationId: outcome.conversationId,
        });
      }
      this.scheduleStateReset(1600);
    } catch (err) {
      console.warn("[Memlace] auto-save failed", err);
      this.setWatchState("error");
      this.scheduleStateReset(3000);
    } finally {
      this.savingInFlight = false;
    }
  }

  private setWatchState(state: WatchState): void {
    this.watchState = state;
    window.dispatchEvent(new CustomEvent("memlace:watch-state", { detail: state }));
  }

  private scheduleStateReset(ms: number): void {
    if (this.stateResetTimer !== null) clearTimeout(this.stateResetTimer);
    this.stateResetTimer = window.setTimeout(() => {
      this.stateResetTimer = null;
      this.setWatchState("watching");
    }, ms);
  }

  private tearDownActive(): void {
    this.disposeObserver?.();
    this.disposeObserver = null;
    this.disposeIndicator?.();
    this.disposeIndicator = null;
    this.active?.cleanup();
  }
}

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

function hookHistory(onChange: () => void): void {
  const w = window as unknown as { __memlaceHistoryHooked?: boolean };
  if (w.__memlaceHistoryHooked) {
    window.addEventListener("memlace:locationchange", onChange);
    return;
  }
  w.__memlaceHistoryHooked = true;
  const fire = () => window.dispatchEvent(new Event("memlace:locationchange"));
  const push = history.pushState;
  const replace = history.replaceState;
  history.pushState = function (...args) {
    const r = push.apply(this, args);
    fire();
    return r;
  };
  history.replaceState = function (...args) {
    const r = replace.apply(this, args);
    fire();
    return r;
  };
  window.addEventListener("memlace:locationchange", onChange);
}

/** Poll for a condition with backoff, then invoke `done`. Bounded to ~30s. */
function waitFor(pred: () => boolean, done: () => void): void {
  const started = Date.now();
  const tick = () => {
    if (pred()) {
      done();
      return;
    }
    if (Date.now() - started > 30_000) return;
    window.setTimeout(tick, 400);
  };
  tick();
}
