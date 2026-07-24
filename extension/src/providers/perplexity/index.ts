import { BaseChatAdapter, findToolbarByButtonCluster, hashString } from "../base/BaseChatAdapter";
import type { CapturedMessage, MessageRole } from "../base/types";
import { extractText, htmlToMarkdown } from "../base/dom";

// Perplexity groups a Q/A pair inside `.pplx-*` blocks. We treat each
// query and answer block as its own message so ordering stays intact.
const MESSAGE_SELECTOR =
  '[class*="query-container"], [class*="answer-container"], [data-testid="query"], [data-testid="answer"]';

export class PerplexityAdapter extends BaseChatAdapter {
  readonly id = "perplexity" as const;
  readonly name = "Perplexity";

  protected readonly hostPattern = /(^|\.)perplexity\.ai$/i;
  protected readonly messageSelector = MESSAGE_SELECTOR;
  protected readonly observeRootSelectors = ["main", "#__next", "body"];
  protected readonly buttonId = "memlace-save-btn-perplexity";

  getConversationId(): string | null {
    const match =
      location.pathname.match(/\/search\/([\w-]+)/) ||
      location.pathname.match(/\/thread\/([\w-]+)/);
    if (match) return match[1]!;
    const first = document.querySelector(MESSAGE_SELECTOR);
    if (first) return `draft:${hashString(extractText(first).slice(0, 120))}`;
    return null;
  }

  getTitle(): string {
    const h1 = document.querySelector<HTMLElement>("h1");
    const fromH1 = h1 ? extractText(h1) : "";
    if (fromH1) return fromH1.slice(0, 120);

    const docTitle = document.title.replace(/\s*[-|·]\s*Perplexity.*$/i, "").trim();
    if (docTitle && !/^perplexity$/i.test(docTitle)) return docTitle;

    const firstQuery = document.querySelector<HTMLElement>(
      '[data-testid="query"], [class*="query-container"]',
    );
    if (firstQuery) return extractText(firstQuery).slice(0, 80) || "Perplexity thread";
    return "Perplexity thread";
  }

  getMessages(): CapturedMessage[] {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
    const messages: CapturedMessage[] = [];
    nodes.forEach((node, idx) => {
      const role = classifyRole(node);
      if (!role) return;
      const contentEl =
        node.querySelector<HTMLElement>('[class*="prose"], [class*="markdown"]') ?? node;
      const markdown = htmlToMarkdown(contentEl);
      const content = extractText(contentEl);
      if (!markdown && !content) return;

      const images = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
        .map((img) => img.src).filter((s) => s && !s.startsWith("data:"));

      // Perplexity's power is its citations — capture them as attachments.
      const attachments = Array.from(
        node.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'),
      ).slice(0, 16).map((a) => ({
        kind: "link" as const,
        url: a.href,
        name: extractText(a).slice(0, 120) || a.href,
      }));

      const id = node.getAttribute("id")
        ?? `${role}:${idx}:${hashString(markdown || content)}`;

      messages.push({
        id, role, content, markdown, images, attachments, order: idx, metadata: {},
      });
    });
    return messages;
  }

  protected getModel(): string | null {
    const el = document.querySelector<HTMLElement>(
      'button[data-testid*="model"], [class*="model-selector"]',
    );
    const t = el ? extractText(el) : "";
    return t || null;
  }

  protected findComposerToolbar(): HTMLElement | null {
    const send = document.querySelector<HTMLElement>(
      'button[aria-label*="Submit" i], button[aria-label*="Send" i], [data-testid="submit-button"]',
    );
    return findToolbarByButtonCluster(send);
  }
}

function classifyRole(node: HTMLElement): MessageRole | null {
  const testid = node.getAttribute("data-testid") ?? "";
  const cls = node.className || "";
  if (testid === "query" || /query/i.test(cls)) return "user";
  if (testid === "answer" || /answer/i.test(cls)) return "assistant";
  return null;
}
