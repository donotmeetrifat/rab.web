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
    // Anchor next to the composer's action buttons.
    const host =
      document.querySelector('form [data-testid="send-button"]')?.parentElement ??
      document.querySelector("main form") ??
      document.body;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.setAttribute("aria-label", "Save conversation to Memlace");
    btn.innerHTML = BUTTON_MARKUP;
    Object.assign(btn.style, BUTTON_BASE_STYLES);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.handlers?.onSave();
    });
    // Prefer floating anchor to avoid CLS in the composer.
    document.body.appendChild(btn);
    this.buttonEl = btn;
    this.applyButtonState(this.handlers?.getState() ?? "idle");
    // Reference host to avoid unused-var warnings and pin lifetime intent.
    void host;
  }

  private applyButtonState(state: SaveButtonState): void {
    if (!this.buttonEl) return;
    const label = this.buttonEl.querySelector<HTMLSpanElement>(".memlace-btn-label");
    const dot = this.buttonEl.querySelector<HTMLSpanElement>(".memlace-btn-dot");
    const map: Record<SaveButtonState, { text: string; color: string; bg: string }> = {
      idle:    { text: "Save to Memlace", color: "#FFFFFF", bg: "#2563EB" },
      saving:  { text: "Saving…",         color: "#FFFFFF", bg: "#1D4ED8" },
      saved:   { text: "Saved",           color: "#FFFFFF", bg: "#059669" },
      updated: { text: "Updated",         color: "#FFFFFF", bg: "#059669" },
      error:   { text: "Save failed",     color: "#FFFFFF", bg: "#DC2626" },
    };
    const cfg = map[state];
    if (label) label.textContent = cfg.text;
    if (dot) dot.style.background = state === "saving" ? "#FDE68A" : "#FFFFFF";
    this.buttonEl.style.background = cfg.bg;
    this.buttonEl.style.color = cfg.color;
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

const BUTTON_BASE_STYLES: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  right: "20px",
  bottom: "88px",
  zIndex: "2147483000",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#2563EB",
  color: "#FFFFFF",
  font: "500 13px/1 Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(37,99,235,0.28), 0 2px 4px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.24)",
  transition: "transform 140ms ease, background 140ms ease, box-shadow 140ms ease",
  userSelect: "none",
};

const BUTTON_MARKUP = `
  <span class="memlace-btn-dot" style="width:8px;height:8px;border-radius:50%;background:#FFFFFF;box-shadow:0 0 0 3px rgba(255,255,255,0.18);"></span>
  <span class="memlace-btn-label">Save to Memlace</span>
`;
