"use client";

import { Clock3, Download, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isHtmlEmpty, stripHtml } from "@/lib/html";
import { formatTaskDayTitle } from "@/lib/task-day-utils";
import type { TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type TodaysReadingPassageCardProps = {
  task: TaskItem;
  className?: string;
};

function getArticlePdfUrl(task: TaskItem) {
  return task.articlePdfAsset?.signedUrl?.trim() || task.articlePdfAsset?.publicUrl?.trim() || "";
}

function estimateReadMinutes(plainText: string) {
  const words = plainText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function estimateParagraphCount(html: string) {
  const matches = html.match(/<p\b[^>]*>/gi);
  if (matches?.length) return matches.length;
  const plain = stripHtml(html);
  if (!plain) return 0;
  return Math.max(1, plain.split(/\n+/).filter((line) => line.trim().length > 40).length || 1);
}

export function TodaysReadingPassageCard({ task, className }: TodaysReadingPassageCardProps) {
  const title = task.articleTitle?.trim() || formatTaskDayTitle(task.dayNumber);
  const description =
    task.summary?.trim() ||
    "Exam-calibrated reading practice for this day. Open the full passage to study at exam length.";
  const pdfUrl = getArticlePdfUrl(task);
  const articleHtml = task.articleContent?.trim() || "";
  const hasLegacyHtml = Boolean(articleHtml) && !isHtmlEmpty(articleHtml);
  const hasArticleContent = Boolean(pdfUrl) || hasLegacyHtml;
  const locked = task.articleLocked;
  const plainPreview = hasLegacyHtml ? stripHtml(articleHtml) : "";
  const readMinutes = hasLegacyHtml ? estimateReadMinutes(plainPreview) : null;
  const paragraphCount = hasLegacyHtml ? estimateParagraphCount(articleHtml) : null;
  const articleHref = `/portal/articles/${task.dayNumber}`;

  const openFullArticle = () => {
    if (locked || !hasArticleContent) return;
    window.open(articleHref, "_blank", "noopener,noreferrer");
  };

  const downloadPdf = () => {
    if (locked || !hasArticleContent) return;
    if (pdfUrl) {
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }
    window.open(`${articleHref}?print=1`, "_blank", "noopener,noreferrer");
  };

  if (locked) {
    return (
      <section
        className={cn(
          "flex items-center gap-3 rounded-[16px] border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground",
          className
        )}
      >
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        Today&apos;s reading passage unlocks when your plan includes this day.
      </section>
    );
  }

  if (!hasArticleContent) {
    return (
      <section
        className={cn(
          "rounded-[16px] border border-border bg-card px-5 py-6 text-sm text-muted-foreground shadow-[var(--shadow-card)]",
          className
        )}
      >
        No reading passage has been published for this day yet.
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div>
        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          Step 4 of 4
        </span>
        <h2 className="mt-2 font-display text-lg font-semibold text-[hsl(var(--primary-deep))] sm:text-xl">
          Today&apos;s reading passage
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Exam-calibrated Part C practice · OET HQ Reading Series</p>
      </div>

      <div className="flex overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-hover)] max-md:flex-col">
        <div
          className="relative flex w-full shrink-0 flex-col border-b border-border bg-[hsl(var(--paper,#FDFEFF))] px-5 py-5 md:w-[225px] md:border-b-0 md:border-r"
          aria-hidden
        >
          <span className="absolute inset-x-0 top-0 h-[5px] bg-[image:var(--grad)]" />
          <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-[#3E6FB2]">
            Reading Sub-test · Part C · Text {String(task.dayNumber).padStart(2, "0")}
          </p>
          <h3 className="mt-2 font-reading text-[15.5px] font-semibold leading-snug text-[#1A2B45]">{title}</h3>
          <p className="mt-2.5 line-clamp-6 font-reading text-[11px] leading-[1.75] text-[#7188A6]">
            {plainPreview || description}
          </p>
          <div className="mt-auto flex justify-between pt-3 text-[7.5px] uppercase tracking-[0.11em] text-[#8AA2BE]">
            <span>OET HQ · VOL. 1</span>
            <span>PASSAGE {String(task.dayNumber).padStart(2, "0")}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-5 py-5 sm:px-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.19em] text-primary">
            Examiner-style passage · Volume 1
          </p>
          <h3 className="mt-2 font-display text-[16.5px] font-semibold text-[hsl(var(--primary-deep))]">{title}</h3>
          <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-muted-foreground">{description}</p>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-[hsl(210_25%_64%)]">
            {pdfUrl ? (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                PDF passage
              </span>
            ) : null}
            {readMinutes ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />~{readMinutes} min read
              </span>
            ) : null}
            {paragraphCount ? <span>{paragraphCount} paragraphs · exam length</span> : null}
            <Badge variant="outline" className="border-primary/25 bg-primary/[0.08] text-primary normal-case tracking-normal">
              Ready to read
            </Badge>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-4">
            <Button type="button" className="cursor-pointer" onClick={openFullArticle}>
              Read today&apos;s passage
            </Button>
            <Button type="button" variant="ghost" className="cursor-pointer" onClick={downloadPdf}>
              <Download className="h-4 w-4" aria-hidden />
              Download PDF
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
