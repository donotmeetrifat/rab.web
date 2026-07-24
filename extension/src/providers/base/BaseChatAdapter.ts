import type { ProviderId } from "@/types";
import type { ProviderAdapter, SaveButtonHandlers, SaveButtonState } from "./ProviderAdapter";
import type { CapturedConversation, CapturedMessage } from "./types";
import { debounce } from "./dom";

/**
 * Shared skeleton for provider adapters. Owns the parts that are identical
 * across every AI site: MutationObserver plumbing, save-button lifecycle,
 * state-machine wiring, and CSS injection. Provider modules subclass this
 * and implement the site-specific hooks below.
 */
export abstract class BaseChatAdapter implements ProviderAdapter {
  abstract readonly id: ProviderId;
  abstract readonly name: string;

  protected observer: MutationObserver | null = null;
  protected buttonReinjectObserver: MutationObserver | null = null;
  protected stateListener: ((e: Event) => void) | null = null;
  protected buttonEl: HTMLButtonElement | null = null;
  protected handlers: SaveButtonHandlers | null = null;

  /* ---------------- Provider-specific hooks ---------------- */

  /** Hostname regex – used by matches(). */
  protected abstract readonly hostPattern: RegExp;
  /** DOM selector matching one message element. Used by detect(). */
  protected abstract readonly messageSelector: string;
  /** Preferred observer roots; first match wins, falls back to body. */
  protected readonly observeRootSelectors: string[] = ["main", "body"];
  /** Debounce for change notifications. Providers can override. */
  protected readonly changeDebounceMs: number = 900;
  /** DOM id for the injected button. Must be unique per provider. */
  protected abstract readonly buttonId: string;

  abstract getConversationId(): string | null;
  abstract getTitle(): string;
  abstract getMessages(): CapturedMessage[];
  /** Provider-specific model detection. Default: none. */
  protected getModel(): string | null { return null; }
  /**
   * Provider-specific toolbar hunt. Return the element to inject the pill
   * button into, or null for the floating fallback. Default: null.
   */
  protected findComposerToolbar(): HTMLElement | null { return null; }
  /**
   * Given the toolbar and the button, decide where to place it. Default:
   * before the last child (usually the send button), else append.
   */
  protected placeButton(toolbar: HTMLElement, btn: HTMLButtonElement): void {
    const last = toolbar.lastElementChild;
    if (last) toolbar.insertBefore(btn, last);
    else toolbar.appendChild(btn);
  }

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
        const t = m.target as HTMLElement;
        if (t && t.id === this.buttonId) continue;
        debounced();
        return;
      }
    });
    this.observer.observe(target, { subtree: true, childList: true, characterData: true });
    return () => this.observer?.disconnect();
  }

  injectButton(handlers: SaveButtonHandlers): () => void {
    this.handlers = handlers;
    this.mountButton();

    this.buttonReinjectObserver?.disconnect();
    this.buttonReinjectObserver = new MutationObserver(() => {
      if (!document.getElementById(this.buttonId)) this.mountButton();
    });
    this.buttonReinjectObserver.observe(document.body, {
      subtree: true, childList: true,
    });

    this.stateListener = (e: Event) => {
      const detail = (e as CustomEvent<SaveButtonState>).detail;
      this.applyButtonState(detail);
    };
    window.addEventListener("memlace:save-state", this.stateListener);

    return () => {
      this.buttonReinjectObserver?.disconnect();
      this.buttonReinjectObserver = null;
      if (this.stateListener) {
        window.removeEventListener("memlace:save-state", this.stateListener);
        this.stateListener = null;
      }
      this.buttonEl?.remove();
      this.buttonEl = null;
    };
  }

  cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.buttonReinjectObserver?.disconnect();
    this.buttonReinjectObserver = null;
    if (this.stateListener) {
      window.removeEventListener("memlace:save-state", this.stateListener);
      this.stateListener = null;
    }
    this.buttonEl?.remove();
    this.buttonEl = null;
    this.handlers = null;
  }

  /* ---------------- Button internals ---------------- */

  protected mountButton(): void {
    if (document.getElementById(this.buttonId)) return;

    const toolbarHost = this.findComposerToolbar();
    const btn = document.createElement("button");
    btn.id = this.buttonId;
    btn.type = "button";
    btn.setAttribute("aria-label", "Save conversation to Memlace");
    btn.setAttribute("data-memlace", "save-btn");
    btn.setAttribute("data-provider", this.id);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handlers?.onSave();
    });

    if (toolbarHost) {
      btn.className = "memlace-save-btn memlace-save-btn--native";
      btn.innerHTML = BUTTON_MARKUP;
      this.placeButton(toolbarHost, btn);
    } else {
      btn.className = "memlace-save-btn memlace-save-btn--floating";
      btn.innerHTML = BUTTON_MARKUP;
      Object.assign(btn.style, FLOATING_BASE_STYLES);
      document.body.appendChild(btn);
    }

    ensureStylesInjected();
    this.buttonEl = btn;
    this.applyButtonState(this.handlers?.getState() ?? "idle");
  }

  protected applyButtonState(state: SaveButtonState): void {
    if (!this.buttonEl) return;
    const label = this.buttonEl.querySelector<HTMLSpanElement>(".memlace-btn-label");
    const icon = this.buttonEl.querySelector<HTMLSpanElement>(".memlace-btn-icon");
    const cfg = STATE_MAP[state];
    if (label) label.textContent = cfg.text;
    if (icon) icon.innerHTML = cfg.iconSvg;
    this.buttonEl.dataset.state = state;
    this.buttonEl.setAttribute("aria-busy", state === "saving" ? "true" : "false");
    this.buttonEl.title = cfg.tooltip;
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

export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

/**
 * Walk up from `start` looking for a container that holds at least
 * `minButtons` <button> children (direct or one level deep). Used to find a
 * composer toolbar without depending on brittle per-site classnames.
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

type StateConfig = { text: string; iconSvg: string; tooltip: string };

const ICON_BOOKMARK =
  '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h10v13l-5-3-5 3v-13z"/></svg>';
const ICON_SPINNER =
  '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="memlace-spin"><path d="M10 2.5a7.5 7.5 0 1 1-7.5 7.5" opacity=".9"/></svg>';
const ICON_CHECK =
  '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9"/></svg>';
const ICON_RETRY =
  '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9"/><path d="M15.5 4v3.5H12"/></svg>';

const STATE_MAP: Record<SaveButtonState, StateConfig> = {
  idle:    { text: "Save to Memlace", iconSvg: ICON_BOOKMARK, tooltip: "Save this conversation to Memlace" },
  saving:  { text: "Saving…",         iconSvg: ICON_SPINNER,  tooltip: "Saving conversation…" },
  saved:   { text: "Saved ✓",         iconSvg: ICON_CHECK,    tooltip: "Saved to Memlace" },
  updated: { text: "Updated ✓",       iconSvg: ICON_CHECK,    tooltip: "Updated in Memlace" },
  error:   { text: "Retry",           iconSvg: ICON_RETRY,    tooltip: "Save failed — click to retry" },
};

const BUTTON_MARKUP = `
  <span class="memlace-btn-icon" aria-hidden="true">${ICON_BOOKMARK}</span>
  <span class="memlace-btn-label">Save to Memlace</span>
`;

const FLOATING_BASE_STYLES: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  right: "20px",
  bottom: "104px",
  zIndex: "2147483000",
};

const STYLE_ID = "memlace-save-btn-styles";
function ensureStylesInjected(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .memlace-save-btn {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      user-select: none;
      font: 500 13px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      transition: background 140ms ease, color 140ms ease, border-color 140ms ease, transform 120ms ease;
    }
    .memlace-save-btn:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
    .memlace-save-btn .memlace-btn-icon { display: inline-flex; align-items: center; justify-content: center; }
    .memlace-save-btn .memlace-spin { animation: memlace-spin 900ms linear infinite; transform-origin: 50% 50%; }
    @keyframes memlace-spin { to { transform: rotate(360deg); } }

    .memlace-save-btn--native {
      height: 32px; padding: 0 10px; margin: 0 4px;
      border-radius: 9999px; color: inherit; background: transparent;
      border: 1px solid rgba(0,0,0,0.12);
    }
    .memlace-save-btn--native:hover { background: rgba(0,0,0,0.05); }
    @media (prefers-color-scheme: dark) {
      .memlace-save-btn--native { border-color: rgba(255,255,255,0.16); color: rgba(255,255,255,0.92); }
      .memlace-save-btn--native:hover { background: rgba(255,255,255,0.08); }
    }
    .memlace-save-btn--native[data-state="saved"],
    .memlace-save-btn--native[data-state="updated"] {
      color: #047857; border-color: rgba(4,120,87,0.35); background: rgba(16,185,129,0.10);
    }
    .memlace-save-btn--native[data-state="saving"] {
      color: #2563EB; border-color: rgba(37,99,235,0.35); background: rgba(37,99,235,0.08);
    }
    .memlace-save-btn--native[data-state="error"] {
      color: #B91C1C; border-color: rgba(185,28,28,0.35); background: rgba(220,38,38,0.08);
    }

    .memlace-save-btn--floating {
      height: 40px; padding: 0 14px; border-radius: 10px;
      color: #FFFFFF; background: #2563EB; border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 10px 24px rgba(37,99,235,0.28), 0 2px 4px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.24);
    }
    .memlace-save-btn--floating:hover { transform: translateY(-1px); }
    .memlace-save-btn--floating[data-state="saving"]  { background: #1D4ED8; }
    .memlace-save-btn--floating[data-state="saved"],
    .memlace-save-btn--floating[data-state="updated"] { background: #059669; }
    .memlace-save-btn--floating[data-state="error"]   { background: #DC2626; }
  `;
  (document.head || document.documentElement).appendChild(style);
}
