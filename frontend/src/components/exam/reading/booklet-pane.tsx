"use client";

import { RichTextHtml } from "@/components/editor/rich-text-html";
import { ExamHighlightable } from "@/components/exam/exam-highlightable";

type BookletPaneProps = {
  html?: string | null;
  signedUrl?: string | null;
  title?: string;
  highlightKey?: string;
};

/** Chrome/Edge PDF viewer: hide toolbar and page thumbnails in embedded iframe. */
function getEmbeddedPdfUrl(url: string) {
  const base = url.split("#")[0];
  return `${base}#toolbar=0&navpanes=0&scrollbar=1`;
}

export function BookletPane({ html, signedUrl, title = "Exam booklet", highlightKey }: BookletPaneProps) {
  const bookletHtml = html?.trim() || null;

  if (bookletHtml) {
    const content = <RichTextHtml html={bookletHtml} variant="reading" className="reading-paper-prose" />;

    return (
      <div className="relative flex h-full min-h-0 flex-col bg-[hsl(var(--paper,#FDFEFF))]">
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {highlightKey ? (
            <ExamHighlightable highlightKey={highlightKey}>{content}</ExamHighlightable>
          ) : (
            content
          )}
        </div>
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No booklet content is attached for this section. Contact your administrator if this is unexpected.
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-muted/15">
      <iframe
        src={getEmbeddedPdfUrl(signedUrl)}
        title={title}
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </div>
  );
}
