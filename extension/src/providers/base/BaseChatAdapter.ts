import type { ProviderId } from "@/types";
import type { IndicatorHandlers, ProviderAdapter, WatchState } from "./ProviderAdapter";
import type { CapturedConversation, CapturedMessage } from "./types";
import { debounce } from "./dom";
import { consumePendingHandoff } from "@/lib/handoff";
import type { ContinuationProviderId } from "@/lib/continuation";
import { traceStateFlow } from "./stateTrace";


/**
 * Shared skeleton for provider adapters. Owns the parts that are identical
 * across every AI site: MutationObserver plumbing, indicator lifecycle,
 * state-machine wiring, and CSS injection. Provider modules subclass this
 * and implement the site-specific hooks below.
 *
 * The Invisible Auto Memory replaces the old "Save to Memlace" button with
 * a passive status pill. Users never click anything — the ProviderManager
 * decides when to snapshot based on a quiet window after DOM mutations.
 */
export abstract class BaseChatAdapter implements ProviderAdapter {
  abstract readonly id: ProviderId;
  abstract readonly name: string;

  protected observer: MutationObserver | null = null;
  protected reinjectObserver: MutationObserver | null = null;
  protected stateListener: ((e: Event) => void) | null = null;
  protected indicatorEl: HTMLDivElement | null = null;
  protected handlers: IndicatorHandlers | null = null;
  /** Diagnostic mirror of the last state actually applied to the pill. */
  protected renderedState: WatchState | null = null;

  /* ---------------- Provider-specific hooks ---------------- */

  /** Hostname regex – used by matches(). */
  protected abstract readonly hostPattern: RegExp;
  /** DOM selector matching one message element. Used by detect(). */
  protected abstract readonly messageSelector: string;
  /** Preferred observer roots; first match wins, falls back to body. */
  protected readonly observeRootSelectors: string[] = ["main", "body"];
  /** Debounce for change notifications (raw mutations → onChange). */
  protected readonly changeDebounceMs: number = 250;
  /**
   * DOM id for the indicator. Historically named `buttonId` — kept for
   * backward compatibility with existing provider adapters. Must be unique.
   */
  protected abstract readonly buttonId: string;

  abstract getConversationId(): string | null;
  abstract getTitle(): string;
  abstract getMessages(): CapturedMessage[];
  /** Provider-specific model detection. Default: none. */
  protected getModel(): string | null { return null; }

  /* ---------------- ProviderAdapter surface ---------------- */

  matches(url: string): boolean {
    try { return this.hostPattern.test(new URL(url).hostname); }
    catch { return false; }
  }

  detect(): boolean {
    return document.querySelector(this.messageSelector) !== null;
  }

  getConversation(): CapturedConversation | null {
    const conversationId = this.getConversationId();
    if (!conversationId) return null;
    const messages = this.getMessages();
    if (messages.length === 0) return null;
    return {
      provider: this.id,
      conversationId,
      title: this.getTitle(),
      url: location.href,
      model: this.getModel(),
      messages,
      capturedAt: Date.now(),
    };
  }

  observeChanges(onChange: () => void): () => void {
    const target = firstMatching(this.observeRootSelectors) ?? document.body;
    const debounced = debounce(onChange, this.changeDebounceMs);
    this.observer?.disconnect();
    this.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // Ignore self-mutations (indicator DOM updates would otherwise loop).
        const t = m.target as HTMLElement | null;
        if (t && (t.id === this.buttonId || t.closest?.(`#${this.buttonId}`))) continue;
        traceStateFlow("MutationObserver callback", "BaseChatAdapter.observeChanges", {
          conversationId: this.getConversationId(),
          provider: this.id,
          currentWatchState: this.handlers?.getState(),
          previousWatchState: this.handlers?.getState(),
          detail: { mutationType: m.type, target: t?.tagName ?? null },
        });
        debounced();
        return;
      }
    });
    this.observer.observe(target, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => this.observer?.disconnect();
  }

  injectIndicator(handlers: IndicatorHandlers): () => void {
    this.handlers = handlers;
    traceStateFlow("injectIndicator() entered", "BaseChatAdapter.injectIndicator", {
      conversationId: this.getConversationId(),
      provider: this.id,
      currentWatchState: handlers.getState(),
      previousWatchState: handlers.getState(),
      detail: { existingElement: Boolean(document.getElementById(this.buttonId)) },
    });
    this.mountIndicator();

    this.reinjectObserver?.disconnect();
    this.reinjectObserver = new MutationObserver(() => {
      if (!document.getElementById(this.buttonId)) this.mountIndicator();
    });
    this.reinjectObserver.observe(document.body, { subtree: true, childList: true });

    this.stateListener = (e: Event) => {
      const detail = (e as CustomEvent<WatchState>).detail;
      traceStateFlow("memlace:watch-state listener received", "BaseChatAdapter.stateListener", {
        conversationId: this.getConversationId(),
        provider: this.id,
        currentWatchState: detail,
        previousWatchState: this.renderedState ?? undefined,
        detail: { eventName: e.type, payload: detail, indicatorOwned: Boolean(this.indicatorEl) },
      });
      this.applyIndicatorState(detail);
    };
    window.addEventListener("memlace:watch-state", this.stateListener);
    traceStateFlow("memlace:watch-state listener installed", "BaseChatAdapter.injectIndicator", {
      conversationId: this.getConversationId(),
      provider: this.id,
      currentWatchState: handlers.getState(),
      previousWatchState: handlers.getState(),
      detail: { target: "window", eventName: "memlace:watch-state" },
    });

    return () => {
      this.reinjectObserver?.disconnect();
      this.reinjectObserver = null;
      if (this.stateListener) {
        window.removeEventListener("memlace:watch-state", this.stateListener);
        traceStateFlow("memlace:watch-state listener removed", "BaseChatAdapter.injectIndicator disposer", {
          conversationId: this.getConversationId(),
          provider: this.id,
          currentWatchState: this.handlers?.getState(),
          previousWatchState: this.handlers?.getState(),
        });
        this.stateListener = null;
      }
      this.indicatorEl?.remove();
      this.indicatorEl = null;
      this.renderedState = null;
    };
  }

  cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.reinjectObserver?.disconnect();
    this.reinjectObserver = null;
    if (this.stateListener) {
      window.removeEventListener("memlace:watch-state", this.stateListener);
      this.stateListener = null;
    }
    this.indicatorEl?.remove();
    this.indicatorEl = null;
    this.renderedState = null;
    this.handlers = null;
  }

  /* ---------------- Indicator internals ---------------- */

  protected mountIndicator(): void {
    const existing = document.getElementById(this.buttonId);
    if (existing) {
      // A provider SPA or extension reload can leave the pill in the DOM after
      // the adapter instance that created it has gone away. Adopt that exact
      // node so the single active listener still owns the single visible pill.
      this.indicatorEl = existing as HTMLDivElement;
      traceStateFlow("Existing indicator adopted", "BaseChatAdapter.mountIndicator", {
        conversationId: this.getConversationId(),
        provider: this.id,
        currentWatchState: this.handlers?.getState(),
        previousWatchState: this.handlers?.getState(),
        detail: {
          existingText: existing.textContent?.trim() ?? "",
          existingClass: existing.className,
          existingDatasetState: existing.dataset.state ?? null,
          indicatorOwned: true,
        },
      });
      this.applyIndicatorState(this.handlers?.getState() ?? "watching");
      return;
    }

    const el = document.createElement("div");
    el.id = this.buttonId;
    el.className = "memlace-indicator";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("data-memlace", "indicator");
    el.setAttribute("data-provider", this.id);
    el.innerHTML = INDICATOR_MARKUP;

    document.body.appendChild(el);
    ensureStylesInjected();
    this.indicatorEl = el;
    traceStateFlow("Indicator mounted", "BaseChatAdapter.mountIndicator", {
      conversationId: this.getConversationId(),
      provider: this.id,
      currentWatchState: this.handlers?.getState(),
      previousWatchState: this.handlers?.getState(),
      detail: { elementId: this.buttonId },
    });
    this.applyIndicatorState(this.handlers?.getState() ?? "watching");
    void this.showHandoffReminder();
  }

  protected async showHandoffReminder(): Promise<void> {
    const pending = await consumePendingHandoff(this.id as ContinuationProviderId);
    if (!pending) return;
    showFloatingReminder(pending.message);
  }



  protected applyIndicatorState(state: WatchState): void {
    if (!this.indicatorEl) {
      const existing = document.getElementById(this.buttonId);
      traceStateFlow("EARLY EXIT: indicatorEl is null", "BaseChatAdapter.applyIndicatorState", {
        conversationId: this.getConversationId(),
        provider: this.id,
        currentWatchState: state,
        previousWatchState: this.renderedState ?? undefined,
        detail: {
          expectedText: STATE_MAP[state].text,
          existingDomText: existing?.textContent?.trim() ?? null,
          existingClass: existing?.className ?? null,
          existingDatasetState: existing?.dataset.state ?? null,
        },
      });
      return;
    }
    const label = this.indicatorEl.querySelector<HTMLSpanElement>(".memlace-indicator-label");
    const cfg = STATE_MAP[state];
    const previousWatchState = this.renderedState ?? undefined;
    if (label) label.textContent = cfg.text;
    this.indicatorEl.dataset.state = state;
    this.indicatorEl.setAttribute("aria-label", `Memlace: ${cfg.text}`);
    this.indicatorEl.title = cfg.tooltip;
    this.renderedState = state;
    traceStateFlow("DOM pill updated", "BaseChatAdapter.applyIndicatorState", {
      conversationId: this.getConversationId(),
      provider: this.id,
      currentWatchState: state,
      previousWatchState,
      detail: {
        currentDomText: label?.textContent ?? null,
        expectedDomText: cfg.text,
        currentCssClass: this.indicatorEl.className,
        currentDatasetState: this.indicatorEl.dataset.state ?? null,
      },
    });
  }
}

/* ---------------- Shared helpers ---------------- */

export function firstMatching(selectors: string[]): Element | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

/** Re-export of the shared FNV-1a hash so provider modules only need one
 *  import from BaseChatAdapter. Single implementation lives in `./hash`. */
export { fnv1a as hashString } from "./hash";

/**
 * Walk up from `start` looking for a container that holds at least
 * `minButtons` <button> children (direct or one level deep). Retained for
 * provider adapters that may still want toolbar discovery (unused by the
 * indicator itself, which is always floating).
 */
export function findToolbarByButtonCluster(
  start: Element | null,
  { minButtons = 2, maxDepth = 5 }: { minButtons?: number; maxDepth?: number } = {},
): HTMLElement | null {
  if (!start) return null;
  let node: HTMLElement | null = start.parentElement;
  for (let depth = 0; node && depth < maxDepth; depth++, node = node.parentElement) {
    const direct = node.querySelectorAll(":scope > button").length;
    if (direct >= minButtons) return node;
    const nested = node.querySelectorAll(":scope > div > button, :scope > span > button").length;
    if (direct + nested >= minButtons) return node;
  }
  return start.parentElement as HTMLElement | null;
}

/* ---------------- Indicator visuals ---------------- */

type StateConfig = { text: string; tooltip: string };

const STATE_MAP: Record<WatchState, StateConfig> = {
  watching:   { text: "Watching",   tooltip: "Memlace is watching this conversation" },
  extracting: { text: "Extracting", tooltip: "Reading the latest conversation…" },
  sending:    { text: "Sending",    tooltip: "Handing off to the background writer…" },
  saving:     { text: "Saving",     tooltip: "Writing to local storage…" },
  indexing:   { text: "Indexing",   tooltip: "Updating knowledge & projects…" },
  synced:     { text: "Synced",     tooltip: "Latest snapshot saved locally" },
  skipped:    { text: "No changes", tooltip: "Nothing new to save" },
  error:      { text: "Error",      tooltip: "Last save failed — will retry on next change" },
};

const INDICATOR_MARKUP = `
  <span class="memlace-indicator-dot" aria-hidden="true"></span>
  <span class="memlace-indicator-label">Watching</span>
`;

const STYLE_ID = "memlace-indicator-styles";
function ensureStylesInjected(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .memlace-indicator {
      all: unset;
      box-sizing: border-box;
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483000;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 22px;
      padding: 0 9px 0 8px;
      border-radius: 9999px;
      font: 500 11px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      color: rgba(15, 23, 42, 0.72);
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: saturate(180%) blur(10px);
      -webkit-backdrop-filter: saturate(180%) blur(10px);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
      opacity: 0.72;
      pointer-events: none;
      user-select: none;
      transition: opacity 200ms ease, color 200ms ease, background 200ms ease, border-color 200ms ease;
    }
    .memlace-indicator:hover { opacity: 1; }
    .memlace-indicator .memlace-indicator-dot {
      width: 6px; height: 6px; border-radius: 9999px;
      background: currentColor;
      box-shadow: 0 0 0 0 currentColor;
    }
    .memlace-indicator[data-state="watching"] { color: #64748B; }
    .memlace-indicator[data-state="watching"] .memlace-indicator-dot {
      animation: memlace-pulse 2.4s ease-in-out infinite;
    }
    .memlace-indicator[data-state="extracting"],
    .memlace-indicator[data-state="sending"],
    .memlace-indicator[data-state="saving"],
    .memlace-indicator[data-state="indexing"] { color: #2563EB; opacity: 0.95; }
    .memlace-indicator[data-state="extracting"] .memlace-indicator-dot,
    .memlace-indicator[data-state="sending"] .memlace-indicator-dot,
    .memlace-indicator[data-state="saving"] .memlace-indicator-dot,
    .memlace-indicator[data-state="indexing"] .memlace-indicator-dot {
      animation: memlace-pulse 900ms ease-in-out infinite;
    }
    .memlace-indicator[data-state="synced"] { color: #059669; opacity: 0.95; }
    .memlace-indicator[data-state="skipped"] { color: #64748B; opacity: 0.85; }
    .memlace-indicator[data-state="error"] { color: #B91C1C; opacity: 0.95; }
    @keyframes memlace-pulse {
      0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
      50%      { box-shadow: 0 0 0 4px rgba(0,0,0,0); opacity: 0.55; }
    }
    @media (prefers-color-scheme: dark) {
      .memlace-indicator {
        color: rgba(226, 232, 240, 0.75);
        background: rgba(15, 23, 42, 0.55);
        border-color: rgba(255, 255, 255, 0.08);
      }
      .memlace-indicator[data-state="watching"] { color: #94A3B8; }
      .memlace-indicator[data-state="extracting"],
      .memlace-indicator[data-state="sending"],
      .memlace-indicator[data-state="saving"],
      .memlace-indicator[data-state="indexing"] { color: #60A5FA; }
      .memlace-indicator[data-state="synced"]   { color: #34D399; }
      .memlace-indicator[data-state="skipped"]  { color: #94A3B8; }
      .memlace-indicator[data-state="error"]    { color: #FCA5A5; }
    }
    @media (prefers-reduced-motion: reduce) {
      .memlace-indicator, .memlace-indicator .memlace-indicator-dot { animation: none !important; transition: none !important; }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

/* ---------------- Handoff reminder (post-Continue tooltip) ---------------- */

const REMINDER_ID = "memlace-handoff-reminder";

function showFloatingReminder(message: string): void {
  if (document.getElementById(REMINDER_ID)) return;
  const el = document.createElement("div");
  el.id = REMINDER_ID;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    right: "16px",
    bottom: "48px",
    zIndex: "2147483000",
    padding: "8px 12px",
    borderRadius: "10px",
    font: '500 12px/1.3 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
    color: "#F8FAFC",
    background: "rgba(15, 23, 42, 0.92)",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.25)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    opacity: "0",
    transform: "translateY(6px)",
    transition: "opacity 200ms ease, transform 200ms ease",
    pointerEvents: "none",
    maxWidth: "260px",
  } as Partial<CSSStyleDeclaration>);

  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    setTimeout(() => el.remove(), 250);
  }, 6000);
}

