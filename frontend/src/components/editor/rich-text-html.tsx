import { cn } from "@/lib/utils";
import { isHtmlContent, toDisplayHtml } from "@/lib/rich-content";

type RichTextHtmlProps = {
  html: string;
  className?: string;
  /** Reading passages use serif typography from `.reading-paper-prose` without default body utilities. */
  variant?: "default" | "reading";
};

/** Read-only rich content: TipTap HTML, markdown, or hybrid HTML+markdown booklets. */
export function RichTextHtml({ html, className, variant = "default" }: RichTextHtmlProps) {
  if (!html.trim()) return null;

  const defaultTypography = variant === "default" ? "text-base leading-relaxed text-muted-foreground" : "";
  const displayHtml = toDisplayHtml(html);

  if (displayHtml && isHtmlContent(displayHtml)) {
    return (
      <div className={cn("tiptap-editor", defaultTypography, className)}>
        <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: displayHtml }} />
      </div>
    );
  }

  if (displayHtml) {
    return (
      <div className={cn("tiptap-editor", defaultTypography, className)}>
        <div className="ProseMirror">{displayHtml}</div>
      </div>
    );
  }

  return null;
}
