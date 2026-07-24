import type { ProviderAdapter, SaveButtonHandlers, SaveButtonState } from "../base/ProviderAdapter";
import type { CapturedConversation, CapturedMessage, MessageRole } from "../base/types";
import { debounce, extractText, htmlToMarkdown } from "../base/dom";

const HOSTS = /^(chatgpt\.com|chat\.openai\.com)$/i;
const BUTTON_ID = "memlace-save-btn";
const OBSERVE_ROOT_SELECTORS = ["main", "#__next", "body"];
const MESSAGE_SELECTOR = "[data-message-author-role]";

export class ChatGPTAdapter implements ProviderAdapter {
  readonly id = "chatgpt" as const;
  readonly name = "ChatGPT";

  private observer: MutationObserver | null = null;
  private buttonReinjectObserver: MutationObserver | null = null;
  private stateListener: ((e: Event) => void) | null = null;
  private buttonEl: HTMLButtonElement | null = null;
  private handlers: SaveButtonHandlers | null = null;

  matches(url: string): boolean {
    try {
      return HOSTS.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  detect(): boolean {
    return document.querySelector(MESSAGE_SELECTOR) !== null;
  }

  getConversationId(): string | null {
    const match = location.pathname.match(/\/c\/([\w-]+)/);
    if (match) return match[1]!;
    // New conversation not yet persisted — derive a stable id from title+first message
    const first = document.querySelector(MESSAGE_SELECTOR);
    if (first) {
      const text = extractText(first).slice(0, 120);
      return `draft:${hashString(text)}`;
    }
    return null;
  }

  getTitle(): string {
    // Sidebar active item is the most reliable when it exists.
    const active = document.querySelector<HTMLElement>(
      'nav a[aria-current="page"], nav a[data-active="true"]',
    );
    const fromNav = active ? extractText(active) : "";
    if (fromNav) return fromNav;

    const docTitle = document.title.replace(/\s*[|·-]\s*ChatGPT\s*$/i, "").trim();
    if (docTitle && docTitle.toLowerCase() !== "chatgpt") return docTitle;

    const firstUser = document.querySelector<HTMLElement>(
      '[data-message-author-role="user"]',
    );
    if (firstUser) return extractText(firstUser).slice(0, 80) || "ChatGPT conversation";
    return "ChatGPT conversation";
  }

  getMessages(): CapturedMessage[] {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR),
    );
    const messages: CapturedMessage[] = [];
    nodes.forEach((node, idx) => {
      const role = normalizeRole(node.getAttribute("data-message-author-role"));
      if (!role) return;

      // The rendered content lives inside `.markdown` (assistant) or a
      // `whitespace-pre-wrap` div (user). Fall back to the whole node.
      const contentEl =
        node.querySelector<HTMLElement>(".markdown") ??
        node.querySelector<HTMLElement>(".whitespace-pre-wrap") ??
        node;

      const markdown = htmlToMarkdown(contentEl);
      const content = extractText(contentEl);
      if (!markdown && !content) return;

      const images = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
        .map((img) => img.src)
        .filter((s) => s && !s.startsWith("data:"));

      const attachments = Array.from(
        node.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'),
      )
        .slice(0, 8)
        .map((a) => ({ kind: "link" as const, url: a.href, name: extractText(a) }));

      const id =
        node.getAttribute("data-message-id") ??
        `${role}:${idx}:${hashString(markdown || content)}`;

      const thinking = node.querySelector<HTMLElement>(
        '[data-testid="reasoning"], [data-message-metadata*="thinking"]',
      );

      messages.push({
        id,
        role,
        content,
        markdown,
        images,
        attachments,
        order: idx,
        metadata: {
          ...(thinking ? { thinking: extractText(thinking) } : {}),
        },
      });
    });
    return messages;
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
    const target = firstMatching(OBSERVE_ROOT_SELECTORS) ?? document.body;
    const debounced = debounce(onChange, 900);
    this.observer?.disconnect();
    this.observer = new MutationObserver((mutations) => {
      // Ignore mutations wholly inside our injected button.
      for (const m of mutations) {
        const t = m.target as HTMLElement;
        if (t && t.id === BUTTON_ID) continue;
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

    // ChatGPT re-mounts the composer on every navigation — keep re-injecting.
    this.buttonReinjectObserver?.disconnect();
    this.buttonReinjectObserver = new MutationObserver(() => {
      if (!document.getElementById(BUTTON_ID)) this.mountButton();
    });
    this.buttonReinjectObserver.observe(document.body, {
      subtree: true,
      childList: true,
    });

    // Reflect state changes emitted by ProviderManager.
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

  /* ---------------- internals ---------------- */

  private getModel(): string | null {
    const btn = document.querySelector<HTMLElement>(
      '[data-testid="model-switcher-dropdown-button"], [aria-label*="Model"]',
    );
    const t = btn ? extractText(btn) : "";
    return t || null;
  }

  private mountButton(): void {
    if (document.getElementById(BUTTON_ID)) return;

    const toolbarHost = findComposerToolbar();
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.setAttribute("aria-label", "Save conversation to Memlace");
    btn.setAttribute("data-memlace", "save-btn");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handlers?.onSave();
    });

    if (toolbarHost) {
      // Native-style pill button that blends with ChatGPT composer toolbar.
      btn.className = "memlace-save-btn memlace-save-btn--native";
      btn.innerHTML = NATIVE_BUTTON_MARKUP;
      // Insert before send button when possible, otherwise append.
      const sendBtn = toolbarHost.querySelector<HTMLElement>(
        '[data-testid="send-button"], button[aria-label*="Send" i]',
      );
      if (sendBtn && sendBtn.parentElement === toolbarHost) {
        toolbarHost.insertBefore(btn, sendBtn);
      } else {
        toolbarHost.appendChild(btn);
      }
    } else {
      // Fallback: floating pill.
      btn.className = "memlace-save-btn memlace-save-btn--floating";
      btn.innerHTML = FLOATING_BUTTON_MARKUP;
      Object.assign(btn.style, FLOATING_BASE_STYLES);
      document.body.appendChild(btn);
    }

    ensureStylesInjected();
    this.buttonEl = btn;
    this.applyButtonState(this.handlers?.getState() ?? "idle");
  }

  private applyButtonState(state: SaveButtonState): void {
    if (!this.buttonEl) return;
    const label = this.buttonEl.querySelector<HTMLSpanElement>(".memlace-btn-label");
    const icon = this.buttonEl.querySelector<HTMLSpanElement>(".memlace-btn-icon");
    const cfg = STATE_MAP[state];
    if (label) label.textContent = cfg.text;
    if (icon) icon.innerHTML = cfg.iconSvg;

    // Tag with state so CSS can theme both native and floating variants.
    this.buttonEl.dataset.state = state;
    this.buttonEl.setAttribute("aria-busy", state === "saving" ? "true" : "false");
    this.buttonEl.title = cfg.tooltip;
  }
}

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

function normalizeRole(raw: string | null): MessageRole | null {
  switch (raw) {
    case "user":
    case "assistant":
    case "system":
    case "tool":
      return raw;
    default:
      return null;
  }
}

function firstMatching(selectors: string[]): Element | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

/**
 * Locate the row of action buttons at the bottom of ChatGPT's composer.
 * Walk up from the send button until we find a container that also holds
 * at least one sibling action button (attach, voice, tools). This is more
 * resilient than a hardcoded selector against ChatGPT's frequent redesigns.
 */
function findComposerToolbar(): HTMLElement | null {
  const send = document.querySelector<HTMLElement>(
    'form [data-testid="send-button"], form button[aria-label*="Send" i]',
  );
  if (!send) return null;

  let node: HTMLElement | null = send.parentElement;
  for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
    const buttonCount = node.querySelectorAll(":scope > button").length;
    if (buttonCount >= 2) return node;
    // Some layouts wrap send in its own div; check one level of children too.
    const nestedButtons = node.querySelectorAll(
      ":scope > div > button, :scope > span > button",
    ).length;
    if (buttonCount + nestedButtons >= 2) return node;
  }
  return send.parentElement;
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

const NATIVE_BUTTON_MARKUP = `
  <span class="memlace-btn-icon" aria-hidden="true">${ICON_BOOKMARK}</span>
  <span class="memlace-btn-label">Save to Memlace</span>
`;

const FLOATING_BUTTON_MARKUP = `
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
    .memlace-save-btn:focus-visible {
      outline: 2px solid #2563EB;
      outline-offset: 2px;
    }
    .memlace-save-btn .memlace-btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .memlace-save-btn .memlace-spin {
      animation: memlace-spin 900ms linear infinite;
      transform-origin: 50% 50%;
    }
    @keyframes memlace-spin { to { transform: rotate(360deg); } }

    /* -------- Native (inside ChatGPT composer toolbar) -------- */
    .memlace-save-btn--native {
      height: 32px;
      padding: 0 10px;
      margin: 0 4px;
      border-radius: 9999px;
      color: inherit;
      background: transparent;
      border: 1px solid rgba(0,0,0,0.12);
    }
    .memlace-save-btn--native:hover {
      background: rgba(0,0,0,0.05);
    }
    @media (prefers-color-scheme: dark) {
      .memlace-save-btn--native {
        border-color: rgba(255,255,255,0.16);
        color: rgba(255,255,255,0.92);
      }
      .memlace-save-btn--native:hover {
        background: rgba(255,255,255,0.08);
      }
    }
    .memlace-save-btn--native[data-state="saved"],
    .memlace-save-btn--native[data-state="updated"] {
      color: #047857;
      border-color: rgba(4,120,87,0.35);
      background: rgba(16,185,129,0.10);
    }
    .memlace-save-btn--native[data-state="saving"] {
      color: #2563EB;
      border-color: rgba(37,99,235,0.35);
      background: rgba(37,99,235,0.08);
    }
    .memlace-save-btn--native[data-state="error"] {
      color: #B91C1C;
      border-color: rgba(185,28,28,0.35);
      background: rgba(220,38,38,0.08);
    }

    /* -------- Floating fallback -------- */
    .memlace-save-btn--floating {
      height: 40px;
      padding: 0 14px;
      border-radius: 10px;
      color: #FFFFFF;
      background: #2563EB;
      border: 1px solid rgba(255,255,255,0.14);
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
