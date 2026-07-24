import { BaseChatAdapter, findToolbarByButtonCluster, hashString } from "../base/BaseChatAdapter";
import type { CapturedMessage, MessageRole } from "../base/types";
import { extractText, htmlToMarkdown } from "../base/dom";

// Gemini turns are Angular components: <user-query> and <model-response>.
const MESSAGE_SELECTOR = "user-query, model-response";

export class GeminiAdapter extends BaseChatAdapter {
  readonly id = "gemini" as const;
  readonly name = "Gemini";

  protected readonly hostPattern = /(^|\.)gemini\.google\.com$/i;
  protected readonly messageSelector = MESSAGE_SELECTOR;
  protected readonly observeRootSelectors = ["chat-window", "main", "body"];
  protected readonly buttonId = "memlace-save-btn-gemini";

  getConversationId(): string | null {
    const match = location.pathname.match(/\/app\/([\w-]+)/);
    if (match) return match[1]!;
    const first = document.querySelector(MESSAGE_SELECTOR);
    if (first) return `draft:${hashString(extractText(first).slice(0, 120))}`;
    return null;
  }

  getTitle(): string {
    const sidebarActive = document.querySelector<HTMLElement>(
      'conversations-list [data-test-id="conversation"].selected, [aria-current="page"]',
    );
    const fromNav = sidebarActive ? extractText(sidebarActive) : "";
    if (fromNav) return fromNav;

    const docTitle = document.title.replace(/\s*[-|·]\s*Gemini\s*$/i, "").trim();
    if (docTitle && docTitle.toLowerCase() !== "gemini") return docTitle;

    const firstUser = document.querySelector<HTMLElement>("user-query");
    if (firstUser) return extractText(firstUser).slice(0, 80) || "Gemini conversation";
    return "Gemini conversation";
  }

  getMessages(): CapturedMessage[] {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
    const messages: CapturedMessage[] = [];
    nodes.forEach((node, idx) => {
      const tag = node.tagName.toLowerCase();
      const role: MessageRole = tag === "user-query" ? "user" : "assistant";
      const contentEl =
        node.querySelector<HTMLElement>(
          "message-content, .query-text, .markdown, .model-response-text",
        ) ?? node;
      const markdown = htmlToMarkdown(contentEl);
      const content = extractText(contentEl);
      if (!markdown && !content) return;

      const images = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
        .map((img) => img.src).filter((s) => s && !s.startsWith("data:"));
      const attachments = Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
        .slice(0, 8)
        .map((a) => ({ kind: "link" as const, url: a.href, name: extractText(a) }));

      const id = node.getAttribute("id") ?? `${role}:${idx}:${hashString(markdown || content)}`;
      const thinking = node.querySelector<HTMLElement>('[class*="thought"], model-thoughts');

      messages.push({
        id, role, content, markdown, images, attachments, order: idx,
        metadata: { ...(thinking ? { thinking: extractText(thinking) } : {}) },
      });
    });
    return messages;
  }

  protected getModel(): string | null {
    const el = document.querySelector<HTMLElement>(
      'bard-mode-switcher, [data-test-id="bard-mode-menu-button"], [aria-label*="model" i]',
    );
    const t = el ? extractText(el) : "";
    return t || null;
  }

  protected findComposerToolbar(): HTMLElement | null {
    const send = document.querySelector<HTMLElement>(
      'button[aria-label*="Send" i], button.send-button, [data-test-id="send-button"]',
    );
    return findToolbarByButtonCluster(send);
  }
}
