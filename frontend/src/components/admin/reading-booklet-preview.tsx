"use client";

import { BookletPane } from "@/components/exam/reading/booklet-pane";
import { isRichContentEmpty } from "@/lib/rich-content";

type ReadingBookletPreviewProps = {
  part: "A" | "B" | "C";
  content: string;
  className?: string;
};

export function ReadingBookletPreview({ part, content, className }: ReadingBookletPreviewProps) {
  const title = `Reading Part ${part} booklet`;

  if (isRichContentEmpty(content)) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        No booklet content yet. Add text in the editor, then open preview again.
      </div>
    );
  }

  return (
    <div
      className={[
        "overflow-hidden rounded-[16px] border border-border bg-card font-portal-sans shadow-[var(--shadow-card)]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid min-h-[420px] h-[70vh] grid-cols-1 lg:grid-cols-2">
        <div className="exam-main flex min-h-0 flex-col border-b border-border/60 lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-border/60 bg-muted/25 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          <div className="min-h-0 flex-1">
            <BookletPane html={content} title={title} />
          </div>
        </div>

        <div className="exam-main hidden min-h-0 flex-col bg-muted/10 lg:flex">
          <div className="shrink-0 border-b border-border/60 bg-muted/25 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Questions
          </div>
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Candidate questions and answers appear in this panel during the reading exam.
          </div>
        </div>
      </div>

      <p className="border-t border-border/60 bg-muted/15 px-4 py-2 text-xs text-muted-foreground lg:hidden">
        On smaller screens, candidates see the booklet above the questions panel.
      </p>
    </div>
  );
}
