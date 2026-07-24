/** Debounce with a stable reference. */
export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let t: number | null = null;
  return (...args: Parameters<T>) => {
    if (t !== null) clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

/** Read visible text preserving line breaks between block elements. */
export function extractText(node: Element): string {
  return node.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
}

/**
 * Convert a rendered DOM subtree into GitHub-flavored Markdown.
 * Handles: headings, paragraphs, bold/italic/code, links, lists (ol/ul),
 * code blocks (`<pre><code>`), blockquotes, tables, hr, and line breaks.
 */
export function htmlToMarkdown(root: Element): string {
  const out: string[] = [];
  walk(root, out, { listDepth: 0, ordered: [] });
  return collapseBlankLines(out.join(""));
}

interface WalkCtx {
  listDepth: number;
  ordered: { index: number; ordered: boolean }[];
}

function walk(node: Node, out: string[], ctx: WalkCtx): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(escapeInline(node.textContent ?? ""));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case "br":
      out.push("  \n");
      return;
    case "hr":
      out.push("\n\n---\n\n");
      return;
    case "strong":
    case "b":
      out.push("**"); walkChildren(el, out, ctx); out.push("**"); return;
    case "em":
    case "i":
      out.push("*"); walkChildren(el, out, ctx); out.push("*"); return;
    case "del":
    case "s":
      out.push("~~"); walkChildren(el, out, ctx); out.push("~~"); return;
    case "a": {
      const href = (el as HTMLAnchorElement).href;
      out.push("[");
      walkChildren(el, out, ctx);
      out.push(`](${href})`);
      return;
    }
    case "code":
      if (el.parentElement?.tagName.toLowerCase() === "pre") {
        walkChildren(el, out, ctx);
      } else {
        out.push("`" + (el.textContent ?? "").replace(/`/g, "\\`") + "`");
      }
      return;
    case "pre": {
      const codeEl = el.querySelector("code");
      const lang = codeEl?.className.match(/language-([\w+-]+)/)?.[1] ?? "";
      const body = (codeEl ?? el).textContent ?? "";
      out.push(`\n\n\`\`\`${lang}\n${body.replace(/\n+$/, "")}\n\`\`\`\n\n`);
      return;
    }
    case "blockquote": {
      const buf: string[] = [];
      walkChildren(el, buf, ctx);
      const quoted = buf.join("").split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
      out.push(`\n\n${quoted}\n\n`);
      return;
    }
    case "h1": case "h2": case "h3":
    case "h4": case "h5": case "h6": {
      const level = Number(tag[1]);
      out.push(`\n\n${"#".repeat(level)} `);
      walkChildren(el, out, ctx);
      out.push("\n\n");
      return;
    }
    case "p":
      out.push("\n\n");
      walkChildren(el, out, ctx);
      out.push("\n\n");
      return;
    case "ul":
    case "ol": {
      const ordered = tag === "ol";
      ctx.ordered.push({ index: 1, ordered });
      ctx.listDepth++;
      out.push("\n");
      for (const child of Array.from(el.children)) {
        if (child.tagName.toLowerCase() !== "li") continue;
        const indent = "  ".repeat(ctx.listDepth - 1);
        const marker = ordered
          ? `${ctx.ordered[ctx.ordered.length - 1]!.index++}.`
          : "-";
        out.push(`${indent}${marker} `);
        walkChildren(child as HTMLElement, out, ctx);
        out.push("\n");
      }
      ctx.listDepth--;
      ctx.ordered.pop();
      out.push("\n");
      return;
    }
    case "table": {
      const rows = Array.from(el.querySelectorAll("tr"));
      if (rows.length === 0) return;
      out.push("\n\n");
      rows.forEach((row, idx) => {
        const cells = Array.from(row.children) as HTMLElement[];
        const line = cells
          .map((c) => (c.textContent ?? "").replace(/\|/g, "\\|").trim())
          .join(" | ");
        out.push(`| ${line} |\n`);
        if (idx === 0) out.push(`| ${cells.map(() => "---").join(" | ")} |\n`);
      });
      out.push("\n");
      return;
    }
    case "img": {
      const img = el as HTMLImageElement;
      out.push(`![${img.alt || ""}](${img.src})`);
      return;
    }
    case "svg":
    case "style":
    case "script":
      return;
    default:
      walkChildren(el, out, ctx);
  }
}

function walkChildren(el: HTMLElement, out: string[], ctx: WalkCtx): void {
  for (const child of Array.from(el.childNodes)) walk(child, out, ctx);
}

function escapeInline(text: string): string {
  return text.replace(/\r/g, "");
}

function collapseBlankLines(md: string): string {
  return md.replace(/\n{3,}/g, "\n\n").trim();
}
