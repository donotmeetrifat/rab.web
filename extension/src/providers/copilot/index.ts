import { BaseChatAdapter, findToolbarByButtonCluster, hashString } from "../base/BaseChatAdapter";
import type { CapturedMessage, MessageRole } from "../base/types";
import { extractText, htmlToMarkdown } from "../base/dom";

// Microsoft Copilot uses `data-content="user-message" | "ai-message"` on each
// turn wrapper. Older builds use `[aria-label="Copilot response"]`.
const MESSAGE_SELECTOR =
  '[data-content="user-message"], [data-content="ai-message"], [data-testid$="-message"]';

export class CopilotAdapter extends BaseChatAdapter {
  readonly id = "copilot" as const;
  readonly name = "Copilot";

  protected readonly hostPattern = /(^|\.)copilot\.microsoft\.com$/i;
  protected readonly messageSelector = MESSAGE_SELECTOR;
  protected readonly observeRootSelectors = ['[role="log"]', "main", "body"];
  protected readonly buttonId = "memlace-save-btn-copilot";

  getConversationId(): string | null {
    const params = new URLSearchParams(location.search);
    const q = params.get("id") || params.get("conversationId");
    if (q) return q;
    const match = location.pathname.match(/\/chats?\/([\w-]+)/);
    if (match) return match[1]!;
    const first = document.querySelector(MESSAGE_SELECTOR);
    if (first) return `draft:${hashString(extractText(first).slice(0, 120))}`;
    return null;
  }

  getTitle(): string {
    const active = document.querySelector<HTMLElement>(
      'nav [aria-current="page"], nav [aria-current="true"], [data-testid="conversation-title"]',
    );
    const fromNav = active ? extractText(active) : "";
    if (fromNav) return fromNav;

    const docTitle = document.title.replace(/\s*[-|·]\s*(Microsoft\s+)?Copilot.*$/i, "").trim();
    if (docTitle && !/^copilot$/i.test(docTitle)) return docTitle;

    const firstUser = document.querySelector<HTMLElement>('[data-content="user-message"]');
    if (firstUser) return extractText(firstUser).slice(0, 80) || "Copilot conversation";
    return "Copilot conversation";
  }

  getMessages(): CapturedMessage[] {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
    const messages: CapturedMessage[] = [];
    nodes.forEach((node, idx) => {
      const role = classifyRole(node);
      if (!role) return;
      const contentEl =
        node.querySelector<HTMLElement>('[class*="markdown"], [class*="prose"]') ?? node;
      const markdown = htmlToMarkdown(contentEl);
      const content = extractText(contentEl);
      if (!markdown && !content) return;

      const images = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
        .map((img) => img.src).filter((s) => s && !s.startsWith("data:"));
      const attachments = Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
        .slice(0, 12)
        .map((a) => ({ kind: "link" as const, url: a.href, name: extractText(a) }));

      const id = node.getAttribute("data-message-id")
        ?? `${role}:${idx}:${hashString(markdown || content)}`;

      messages.push({
        id, role, content, markdown, images, attachments, order: idx, metadata: {},
      });
    });
    return messages;
  }

  protected getModel(): string | null {
    const el = document.querySelector<HTMLElement>(
      '[aria-label*="model" i], [data-testid="model-selector"]',
    );
    const t = el ? extractText(el) : "";
    return t || null;
  }

  protected findComposerToolbar(): HTMLElement | null {
    const send = document.querySelector<HTMLElement>(
      'button[data-testid="submit-button"], button[aria-label*="Submit" i], button[aria-label*="Send" i]',
    );
    return findToolbarByButtonCluster(send);
  }
}

function classifyRole(node: HTMLElement): MessageRole | null {
  const kind = node.getAttribute("data-content");
  if (kind === "user-message") return "user";
  if (kind === "ai-message") return "assistant";
  const testid = node.getAttribute("data-testid") ?? "";
  if (/user/i.test(testid)) return "user";
  if (/ai|assistant|copilot/i.test(testid)) return "assistant";
  return null;
}
