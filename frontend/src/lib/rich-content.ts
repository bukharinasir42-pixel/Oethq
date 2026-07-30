import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import TurndownService from "turndown";
import { unified } from "unified";
import { isHtmlEmpty, stripHtml } from "@/lib/html";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-"
});

turndown.addRule("strikethrough", {
  filter: (node) =>
    node.nodeName === "DEL" || node.nodeName === "S" || node.nodeName === "STRIKE",
  replacement: (content) => `~~${content}~~`
});

export function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return /^<[a-z][\s\S]*>/i.test(trimmed);
}

export function htmlToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (!isHtmlContent(trimmed)) return trimmed;
  return turndown.turndown(trimmed).trim();
}

export function toEditorMarkdown(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  return isHtmlContent(trimmed) ? htmlToMarkdown(trimmed) : trimmed;
}

export function isRichContentEmpty(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;
  if (isHtmlContent(trimmed)) return isHtmlEmpty(trimmed);
  return stripHtml(trimmed.replace(/[#>*_~`\-\[\]()!]/g, " ")).length === 0;
}

/** TipTap/ProseMirror needs block-level HTML; legacy booklets may be inline spans only. */
export function prepareHtmlForTipTap(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (/<(?:p|div|h[1-6]|ul|ol|table|blockquote)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `<p>${trimmed}</p>`;
}

/**
 * Normalize booklet content for TipTap.
 * Preview uses react-markdown + rehype-raw; this uses the same pipeline so hybrid
 * HTML+markdown booklets (legacy) become editable HTML instead of an empty editor.
 */
export function toEditableHtml(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  try {
    const html = String(
      unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeStringify)
        .processSync(trimmed)
    ).trim();

    if (!html || isHtmlEmpty(html)) {
      return prepareHtmlForTipTap(trimmed);
    }
    return prepareHtmlForTipTap(html);
  } catch {
    return prepareHtmlForTipTap(trimmed);
  }
}

/** True when content contains markdown syntax that must be parsed (not plain HTML). */
export function hasInlineMarkdownSyntax(content: string): boolean {
  return (
    /\*\*[^*\n]+\*\*/.test(content) ||
    /\[[^\]]+\]\([^)]+\)/.test(content) ||
    /(?:^|\n)\*[^*\n]+\*(?:\n|$)/.test(content)
  );
}

/**
 * Render-ready HTML for read-only views (candidate exam, admin preview).
 * Hybrid legacy booklets mix `<span>` HTML with markdown — `dangerouslySetInnerHTML`
 * alone leaves `**bold**` and `[links](url)` visible as raw text.
 */
export function toDisplayHtml(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const needsMarkdownPipeline = !isHtmlContent(trimmed) || hasInlineMarkdownSyntax(trimmed);
  if (needsMarkdownPipeline) {
    return toEditableHtml(trimmed);
  }
  return trimmed;
}
