import { BaseChatAdapter, findToolbarByButtonCluster, hashString } from "../base/BaseChatAdapter";
import type { CapturedMessage, MessageRole } from "../base/types";
import { extractText, htmlToMarkdown } from "../base/dom";

// DeepSeek marks each turn with a role hint on the message container.
const MESSAGE_SELECTOR =
  '[class*="_message_"], [class*="fbb737a4"], [data-role="user"], [data-role="assistant"]';

export class DeepSeekAdapter extends BaseChatAdapter {
  readonly id = "deepseek" as const;
  readonly name = "DeepSeek";

  protected readonly hostPattern = /(^|\.)chat\.deepseek\.com$/i;
  protected readonly messageSelector = MESSAGE_SELECTOR;
  protected readonly observeRootSelectors = ["main", "#root", "body"];
  protected readonly buttonId = "memlace-save-btn-deepseek";

  getConversationId(): string | null {
    const match = location.pathname.match(/\/a\/chat\/s\/([\w-]+)/) ||
      location.pathname.match(/\/chat\/([\w-]+)/);
    if (match) return match[1]!;
    const first = document.querySelector(MESSAGE_SELECTOR);
    if (first) return `draft:${hashString(extractText(first).slice(0, 120))}`;
    return null;
  }

  getTitle(): string {
    const active = document.querySelector<HTMLElement>(
      '.chat-history-item.active, [class*="active"][class*="history"], [aria-current="page"]',
    );
    const fromNav = active ? extractText(active) : "";
    if (fromNav) return fromNav;

    const docTitle = document.title.replace(/\s*[-|·]\s*DeepSeek.*$/i, "").trim();
    if (docTitle && docTitle.toLowerCase() !== "deepseek") return docTitle;

    const firstUser = document.querySelector<HTMLElement>(
      '[data-role="user"], [class*="_message_"][class*="user"]',
    );
    if (firstUser) return extractText(firstUser).slice(0, 80) || "DeepSeek conversation";
    return "DeepSeek conversation";
  }

  getMessages(): CapturedMessage[] {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
    const messages: CapturedMessage[] = [];
    nodes.forEach((node, idx) => {
      const role = classifyRole(node);
      if (!role) return;
      const contentEl =
        node.querySelector<HTMLElement>('[class*="markdown"], .ds-markdown, .prose') ?? node;
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
        '[class*="thinking"], [class*="reasoning"]',
      );

      messages.push({
        id, role, content, markdown, images, attachments, order: idx,
        metadata: { ...(thinking ? { thinking: extractText(thinking) } : {}) },
      });
    });
    return messages;
  }

  protected getModel(): string | null {
    const el = document.querySelector<HTMLElement>(
      '[class*="model-select"], [class*="ModelSwitch"], button[aria-haspopup="listbox"]',
    );
    const t = el ? extractText(el) : "";
    return t || null;
  }

  protected findComposerToolbar(): HTMLElement | null {
    const send = document.querySelector<HTMLElement>(
      'div[role="button"][aria-label*="Send" i], button[aria-label*="Send" i], .send-button, [class*="_send_"]',
    );
    return findToolbarByButtonCluster(send);
  }
}

function classifyRole(node: HTMLElement): MessageRole | null {
  const dataRole = node.getAttribute("data-role");
  if (dataRole === "user" || dataRole === "assistant") return dataRole;
  const cls = node.className || "";
  if (/user|human/i.test(cls)) return "user";
  if (/assistant|response|answer|ai/i.test(cls)) return "assistant";
  // DeepSeek alternates turns; fall back to structural heuristic:
  return node.querySelector('[contenteditable="true"]') ? null : "assistant";
}
