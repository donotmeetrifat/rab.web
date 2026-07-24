import { BaseChatAdapter, findToolbarByButtonCluster, hashString } from "../base/BaseChatAdapter";
import type { CapturedMessage, MessageRole } from "../base/types";
import { extractText, htmlToMarkdown } from "../base/dom";

// Claude renders each turn as `[data-testid^="message-"]` (`user-message`,
// `assistant-message`, sometimes numbered) inside a scrollable transcript.
const MESSAGE_SELECTOR =
  '[data-testid="user-message"], [data-testid="assistant-message"], [data-testid^="message-"]';

export class ClaudeAdapter extends BaseChatAdapter {
  readonly id = "claude" as const;
  readonly name = "Claude";

  protected readonly hostPattern = /(^|\.)claude\.ai$/i;
  protected readonly messageSelector = MESSAGE_SELECTOR;
  protected readonly observeRootSelectors = ["main", "#__next", "body"];
  protected readonly buttonId = "memlace-save-btn-claude";

  getConversationId(): string | null {
    const match = location.pathname.match(/\/chat\/([\w-]+)/);
    if (match) return match[1]!;
    const first = document.querySelector(MESSAGE_SELECTOR);
    if (first) return `draft:${hashString(extractText(first).slice(0, 120))}`;
    return null;
  }

  getTitle(): string {
    const header = document.querySelector<HTMLElement>(
      'header [data-testid="chat-menu-trigger"], header h1, [data-testid="conversation-title"]',
    );
    const fromHeader = header ? extractText(header) : "";
    if (fromHeader) return fromHeader;

    const docTitle = document.title.replace(/\s*[-|·]\s*Claude\s*$/i, "").trim();
    if (docTitle && docTitle.toLowerCase() !== "claude") return docTitle;

    const firstUser = document.querySelector<HTMLElement>('[data-testid="user-message"]');
    if (firstUser) return extractText(firstUser).slice(0, 80) || "Claude conversation";
    return "Claude conversation";
  }

  getMessages(): CapturedMessage[] {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
    const seen = new Set<HTMLElement>();
    const messages: CapturedMessage[] = [];
    nodes.forEach((node) => {
      if (seen.has(node)) return;
      seen.add(node);
      const role = classifyRole(node);
      if (!role) return;

      const contentEl =
        node.querySelector<HTMLElement>('.font-claude-message, .prose, [class*="prose"]') ?? node;
      const markdown = htmlToMarkdown(contentEl);
      const content = extractText(contentEl);
      if (!markdown && !content) return;

      const images = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
        .map((img) => img.src).filter((s) => s && !s.startsWith("data:"));
      const attachments = Array.from(
        node.querySelectorAll<HTMLElement>('[data-testid*="attachment"], a[href^="http"]'),
      ).slice(0, 8).map((el) => ({
        kind: el.tagName === "A" ? ("link" as const) : ("file" as const),
        url: (el as HTMLAnchorElement).href || undefined,
        name: extractText(el) || undefined,
      }));

      const id = node.getAttribute("data-testid") + ":"
        + (node.getAttribute("data-message-id") ?? hashString(markdown || content));

      const thinking = node.querySelector<HTMLElement>(
        '[data-testid*="thinking"], [class*="thinking"]',
      );

      messages.push({
        id,
        role,
        content,
        markdown,
        images,
        attachments,
        order: messages.length,
        metadata: { ...(thinking ? { thinking: extractText(thinking) } : {}) },
      });
    });
    return messages;
  }

  protected getModel(): string | null {
    const el = document.querySelector<HTMLElement>(
      '[data-testid="model-selector-dropdown"], [aria-label*="model" i]',
    );
    const t = el ? extractText(el) : "";
    return t || null;
  }

  protected findComposerToolbar(): HTMLElement | null {
    const send = document.querySelector<HTMLElement>(
      'fieldset button[aria-label*="Send" i], button[aria-label="Send Message"], button[aria-label*="Send message" i]',
    );
    return findToolbarByButtonCluster(send);
  }
}

function classifyRole(node: HTMLElement): MessageRole | null {
  const testid = node.getAttribute("data-testid") ?? "";
  if (testid.includes("user")) return "user";
  if (testid.includes("assistant")) return "assistant";
  const cls = node.className || "";
  if (/human|user/i.test(cls)) return "user";
  if (/claude|assistant/i.test(cls)) return "assistant";
  return "assistant";
}
