import { BaseChatAdapter, findToolbarByButtonCluster, hashString } from "../base/BaseChatAdapter";
import type { CapturedMessage, MessageRole } from "../base/types";
import { extractText, htmlToMarkdown } from "../base/dom";

const MESSAGE_SELECTOR = "[data-message-author-role]";

export class ChatGPTAdapter extends BaseChatAdapter {
  readonly id = "chatgpt" as const;
  readonly name = "ChatGPT";

  protected readonly hostPattern = /^(chatgpt\.com|chat\.openai\.com)$/i;
  protected readonly messageSelector = MESSAGE_SELECTOR;
  protected readonly observeRootSelectors = ["main", "#__next", "body"];
  protected readonly buttonId = "memlace-save-btn-chatgpt";

  getConversationId(): string | null {
    const match = location.pathname.match(/\/c\/([\w-]+)/);
    if (match) return match[1]!;
    const first = document.querySelector(MESSAGE_SELECTOR);
    if (first) return `draft:${hashString(extractText(first).slice(0, 120))}`;
    return null;
  }

  getTitle(): string {
    const active = document.querySelector<HTMLElement>(
      'nav a[aria-current="page"], nav a[data-active="true"]',
    );
    const fromNav = active ? extractText(active) : "";
    if (fromNav) return fromNav;

    const docTitle = document.title.replace(/\s*[|·-]\s*ChatGPT\s*$/i, "").trim();
    if (docTitle && docTitle.toLowerCase() !== "chatgpt") return docTitle;

    const firstUser = document.querySelector<HTMLElement>('[data-message-author-role="user"]');
    if (firstUser) return extractText(firstUser).slice(0, 80) || "ChatGPT conversation";
    return "ChatGPT conversation";
  }

  getMessages(): CapturedMessage[] {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
    const messages: CapturedMessage[] = [];
    nodes.forEach((node, idx) => {
      const role = normalizeRole(node.getAttribute("data-message-author-role"));
      if (!role) return;
      const contentEl =
        node.querySelector<HTMLElement>(".markdown") ??
        node.querySelector<HTMLElement>(".whitespace-pre-wrap") ??
        node;
      const markdown = htmlToMarkdown(contentEl);
      const content = extractText(contentEl);
      if (!markdown && !content) return;

      const images = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
        .map((img) => img.src).filter((s) => s && !s.startsWith("data:"));
      const attachments = Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
        .slice(0, 8)
        .map((a) => ({ kind: "link" as const, url: a.href, name: extractText(a) }));

      const id = node.getAttribute("data-message-id")
        ?? `${role}:${idx}:${hashString(markdown || content)}`;
      const thinking = node.querySelector<HTMLElement>(
        '[data-testid="reasoning"], [data-message-metadata*="thinking"]',
      );

      messages.push({
        id, role, content, markdown, images, attachments, order: idx,
        metadata: { ...(thinking ? { thinking: extractText(thinking) } : {}) },
      });
    });
    return messages;
  }

  protected getModel(): string | null {
    const btn = document.querySelector<HTMLElement>(
      '[data-testid="model-switcher-dropdown-button"], [aria-label*="Model"]',
    );
    const t = btn ? extractText(btn) : "";
    return t || null;
  }

  protected findComposerToolbar(): HTMLElement | null {
    const send = document.querySelector<HTMLElement>(
      'form [data-testid="send-button"], form button[aria-label*="Send" i]',
    );
    return findToolbarByButtonCluster(send);
  }

  protected placeButton(toolbar: HTMLElement, btn: HTMLButtonElement): void {
    const sendBtn = toolbar.querySelector<HTMLElement>(
      '[data-testid="send-button"], button[aria-label*="Send" i]',
    );
    if (sendBtn && sendBtn.parentElement === toolbar) toolbar.insertBefore(btn, sendBtn);
    else toolbar.appendChild(btn);
  }
}

function normalizeRole(raw: string | null): MessageRole | null {
  switch (raw) {
    case "user": case "assistant": case "system": case "tool": return raw;
    default: return null;
  }
}
