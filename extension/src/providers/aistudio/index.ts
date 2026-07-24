import { BaseChatAdapter, findToolbarByButtonCluster, hashString } from "../base/BaseChatAdapter";
import type { CapturedMessage, MessageRole } from "../base/types";
import { extractText, htmlToMarkdown } from "../base/dom";

// AI Studio uses Angular `ms-chat-turn` custom elements, each carrying a
// role attribute or class that identifies user vs. model turns.
const MESSAGE_SELECTOR = "ms-chat-turn, ms-prompt-chunk";

export class AIStudioAdapter extends BaseChatAdapter {
  readonly id = "aistudio" as const;
  readonly name = "AI Studio";

  protected readonly hostPattern = /(^|\.)aistudio\.google\.com$/i;
  protected readonly messageSelector = MESSAGE_SELECTOR;
  protected readonly observeRootSelectors = ["ms-chat-session", "main", "body"];
  protected readonly buttonId = "memlace-save-btn-aistudio";

  getConversationId(): string | null {
    const match =
      location.pathname.match(/\/prompts\/([\w-]+)/) ||
      location.pathname.match(/\/app\/prompts\/([\w-]+)/);
    if (match) return match[1]!;
    const first = document.querySelector(MESSAGE_SELECTOR);
    if (first) return `draft:${hashString(extractText(first).slice(0, 120))}`;
    return null;
  }

  getTitle(): string {
    const header = document.querySelector<HTMLElement>(
      'ms-prompt-title, [data-test-id="prompt-title"], header h1',
    );
    const fromHeader = header ? extractText(header) : "";
    if (fromHeader) return fromHeader;

    const docTitle = document.title.replace(/\s*[-|·]\s*(Google\s+)?AI\s*Studio.*$/i, "").trim();
    if (docTitle && !/^ai\s*studio$/i.test(docTitle)) return docTitle;

    const firstUser = document.querySelector<HTMLElement>(
      'ms-chat-turn[data-turn-role="user"], ms-chat-turn.user',
    );
    if (firstUser) return extractText(firstUser).slice(0, 80) || "AI Studio prompt";
    return "AI Studio prompt";
  }

  getMessages(): CapturedMessage[] {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
    const messages: CapturedMessage[] = [];
    nodes.forEach((node, idx) => {
      const role = classifyRole(node);
      if (!role) return;
      const contentEl =
        node.querySelector<HTMLElement>(
          "ms-cmark-node, ms-text-chunk, .turn-content, .markdown",
        ) ?? node;
      const markdown = htmlToMarkdown(contentEl);
      const content = extractText(contentEl);
      if (!markdown && !content) return;

      const images = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
        .map((img) => img.src).filter((s) => s && !s.startsWith("data:"));
      const attachments = Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
        .slice(0, 8)
        .map((a) => ({ kind: "link" as const, url: a.href, name: extractText(a) }));

      const id = node.getAttribute("id")
        ?? node.getAttribute("data-turn-id")
        ?? `${role}:${idx}:${hashString(markdown || content)}`;
      const thinking = node.querySelector<HTMLElement>(
        'ms-thought-chunk, [class*="thinking"], [class*="thought"]',
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
      'ms-model-selector-two-column [class*="selected"], ms-model-selector button, [data-test-id="model-selector"]',
    );
    const t = el ? extractText(el) : "";
    return t || null;
  }

  protected findComposerToolbar(): HTMLElement | null {
    const send = document.querySelector<HTMLElement>(
      'ms-run-button button, button[aria-label*="Run" i], button[aria-label*="Send" i]',
    );
    return findToolbarByButtonCluster(send);
  }
}

function classifyRole(node: HTMLElement): MessageRole | null {
  const attr = node.getAttribute("data-turn-role");
  if (attr === "user") return "user";
  if (attr === "model" || attr === "assistant") return "assistant";
  if (attr === "system") return "system";
  const cls = node.className || "";
  if (/(^|\s)user(\s|$)/i.test(cls)) return "user";
  if (/(^|\s)(model|assistant)(\s|$)/i.test(cls)) return "assistant";
  if (/system/i.test(cls)) return "system";
  return "assistant";
}
