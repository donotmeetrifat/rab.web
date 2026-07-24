import type { ProviderAdapter, SaveButtonState } from "./ProviderAdapter";
import type { CapturedConversation } from "./types";
import { hashConversation } from "./hash";

export interface ManagerEvents {
  onConversationChanged: (payload: {
    conversation: CapturedConversation;
    hash: string;
    reason: "auto" | "manual" | "initial";
  }) => Promise<void> | void;
  isAutoSaveEnabled: () => boolean;
}

/**
 * Owns the lifecycle of a single active provider adapter for the current page.
 * Detects SPA navigations, swaps adapters, keeps a single MutationObserver
 * chain alive, and dedupes updates by content hash.
 */
export class ProviderManager {
  private adapters: ProviderAdapter[];
  private active: ProviderAdapter | null = null;
  private disposeObserver: (() => void) | null = null;
  private disposeButton: (() => void) | null = null;
  private lastHash: string | null = null;
  private lastConversationId: string | null = null;
  private saveState: SaveButtonState = "idle";
  private pendingSaveTimer: number | null = null;
  private urlPollTimer: number | null = null;
  private currentUrl = "";
  private disposed = false;

  constructor(adapters: ProviderAdapter[], private events: ManagerEvents) {
    this.adapters = adapters;
  }

  start(): void {
    this.currentUrl = location.href;
    this.reconcile("initial");
    // Patch history APIs once to detect SPA route changes.
    hookHistory(() => this.onUrlMaybeChanged());
    window.addEventListener("popstate", this.onUrlMaybeChanged);
    // Safety net for providers that mutate URL without dispatching events.
    this.urlPollTimer = window.setInterval(this.onUrlMaybeChanged, 1500);
  }

  cleanup(): void {
    this.disposed = true;
    window.removeEventListener("popstate", this.onUrlMaybeChanged);
    if (this.urlPollTimer !== null) clearInterval(this.urlPollTimer);
    if (this.pendingSaveTimer !== null) clearTimeout(this.pendingSaveTimer);
    this.tearDownActive();
  }

  /** Force a manual save regardless of auto-save state / hash equality. */
  async saveNow(): Promise<{ ok: boolean; error?: string }> {
    if (!this.active) return { ok: false, error: "No supported AI page detected" };
    const convo = this.active.getConversation();
    if (!convo) return { ok: false, error: "No conversation on this page yet" };
    try {
      this.setSaveState("saving");
      const hash = hashConversation(convo);
      const isUpdate = this.lastHash !== null && this.lastHash !== hash;
      await this.events.onConversationChanged({
        conversation: convo,
        hash,
        reason: "manual",
      });
      this.lastHash = hash;
      this.setSaveState(isUpdate ? "updated" : "saved");
      window.setTimeout(() => this.setSaveState("idle"), 2200);
      return { ok: true };
    } catch (err) {
      this.setSaveState("error");
      window.setTimeout(() => this.setSaveState("idle"), 2600);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Save failed",
      };
    }
  }

  private onUrlMaybeChanged = (): void => {
    if (this.disposed) return;
    if (location.href === this.currentUrl) return;
    this.currentUrl = location.href;
    this.reconcile("initial");
  };

  private reconcile(reason: "initial" | "auto"): void {
    const url = location.href;
    const next = this.adapters.find((a) => a.matches(url)) ?? null;

    if (next !== this.active) {
      this.tearDownActive();
      this.active = next;
      this.lastHash = null;
      this.lastConversationId = null;
    }

    if (!this.active) return;

    // Wait until the conversation actually renders before wiring things up.
    waitFor(
      () => this.active?.detect() === true,
      () => this.wireActive(reason),
    );
  }

  private wireActive(reason: "initial" | "auto"): void {
    if (!this.active || this.disposed) return;

    // Observer: schedule a debounced snapshot on any change.
    if (!this.disposeObserver) {
      this.disposeObserver = this.active.observeChanges(() =>
        this.scheduleSnapshot(),
      );
    }
    // Button: injected once; adapter keeps it alive against re-renders.
    if (!this.disposeButton) {
      this.disposeButton = this.active.injectButton({
        onSave: () => this.saveNow(),
        getState: () => this.saveState,
      });
    }
    // Initial snapshot.
    this.scheduleSnapshot(reason);
  }

  private scheduleSnapshot(reason: "initial" | "auto" = "auto"): void {
    if (this.pendingSaveTimer !== null) clearTimeout(this.pendingSaveTimer);
    this.pendingSaveTimer = window.setTimeout(() => {
      this.pendingSaveTimer = null;
      this.snapshot(reason);
    }, 700);
  }

  private async snapshot(reason: "initial" | "auto"): Promise<void> {
    if (!this.active || this.disposed) return;
    const convo = this.active.getConversation();
    if (!convo || convo.messages.length === 0) return;

    // Detect conversation switch inside the same provider.
    if (
      this.lastConversationId &&
      this.lastConversationId !== convo.conversationId
    ) {
      this.lastHash = null;
    }
    this.lastConversationId = convo.conversationId;

    const hash = hashConversation(convo);
    if (hash === this.lastHash) return;

    if (!this.events.isAutoSaveEnabled() && reason !== "initial") {
      // Track hash locally so manual save reports Updated vs Saved correctly.
      this.lastHash = hash;
      return;
    }
    if (!this.events.isAutoSaveEnabled()) {
      this.lastHash = hash;
      return;
    }

    try {
      this.setSaveState("saving");
      await this.events.onConversationChanged({ conversation: convo, hash, reason: "auto" });
      const wasUpdate = this.lastHash !== null;
      this.lastHash = hash;
      this.setSaveState(wasUpdate ? "updated" : "saved");
      window.setTimeout(() => this.setSaveState("idle"), 1800);
    } catch {
      this.setSaveState("error");
      window.setTimeout(() => this.setSaveState("idle"), 2400);
    }
  }

  private setSaveState(state: SaveButtonState): void {
    this.saveState = state;
    // Adapter reads via handlers.getState(); notify by dispatching a custom event
    // so the button can re-render without us holding a DOM ref here.
    window.dispatchEvent(
      new CustomEvent("memlace:save-state", { detail: state }),
    );
  }

  private tearDownActive(): void {
    this.disposeObserver?.();
    this.disposeObserver = null;
    this.disposeButton?.();
    this.disposeButton = null;
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
  const fire = () =>
    window.dispatchEvent(new Event("memlace:locationchange"));
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
