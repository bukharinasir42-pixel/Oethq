"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RichTextHtml } from "@/components/editor/rich-text-html";
import { getListeningExtractQuestionHeading, getListeningPartAQuestionSections, getPartSubInstructions, shouldShowListeningPartInstructions } from "@/components/exam/exam-utils";
import { ListeningPartAQuestionSections } from "@/components/exam/listening/listening-part-a-question-sections";
import { QuestionPanel } from "@/components/exam/questions/question-panel";
import { Button } from "@/components/ui/button";
import {
  getListeningQuestionPageRange,
  getQuestionsForListeningPage,
  LISTENING_QUESTION_PAGE_COUNT
} from "@/lib/test-question-templates";
import type { ListeningPartAQuestionHeadingGroupsByExtract } from "@/lib/listening-part-a-question-heading-groups";
import type { TestQuestionDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type ListeningCandidatePreviewProps = {
  title: string;
  instructions?: string | null;
  partASubInstructions?: string | null;
  partBSubInstructions?: string | null;
  partCSubInstructions?: string | null;
  questions: TestQuestionDto[];
  partAExtractQuestionHeadings?: Record<string, string> | null;
  partAQuestionHeadingGroups?: ListeningPartAQuestionHeadingGroupsByExtract | null;
  partCExtractQuestionHeadings?: Record<string, string> | null;
  className?: string;
};

function formatPageHeading(questions: TestQuestionDto[]) {
  if (questions.length === 0) return "No questions on this page";
  const first = questions[0].sequence;
  const last = questions[questions.length - 1].sequence;
  return first === last ? `Question ${first}` : `Questions ${first}–${last}`;
}

export function ListeningCandidatePreview({
  title,
  instructions,
  partASubInstructions,
  partBSubInstructions,
  partCSubInstructions,
  questions,
  partAExtractQuestionHeadings,
  partAQuestionHeadingGroups,
  partCExtractQuestionHeadings,
  className
}: ListeningCandidatePreviewProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const pageQuestions = getQuestionsForListeningPage(questions, pageIndex);
  const pageRange = getListeningQuestionPageRange(pageIndex);
  const currentPart = (pageQuestions[0]?.part ?? "A") as "A" | "B" | "C";
  const subInstructions = getPartSubInstructions(
    { partASubInstructions, partBSubInstructions, partCSubInstructions },
    currentPart
  );
  const showPartInstructions = shouldShowListeningPartInstructions(currentPart, pageQuestions, subInstructions);
  const activeExtractId = pageQuestions[0]?.extractId ?? null;
  const partAExtractIndex = pageIndex <= 1 ? pageIndex : 0;
  const headingSource = {
    partAExtractQuestionHeadings,
    partAQuestionHeadingGroups,
    partCExtractQuestionHeadings
  };
  const partAQuestionSections =
    currentPart === "A"
      ? getListeningPartAQuestionSections(headingSource, activeExtractId, partAExtractIndex, pageQuestions)
      : null;
  const extractQuestionsHeading =
    currentPart === "A" || currentPart === "C"
      ? getListeningExtractQuestionHeading(headingSource, currentPart, activeExtractId, partAExtractIndex)
      : null;
  const fallbackHeading =
    extractQuestionsHeading || partAQuestionSections ? null : formatPageHeading(pageQuestions);

  return (
    <div className={cn("flex min-h-[420px] flex-col gap-4 font-portal-sans", className)}>
      <div className="listening-exam-prose space-y-1 rounded-[16px] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        {instructions?.trim() ? <RichTextHtml html={instructions} className="mt-2 text-foreground/90" /> : null}
        {showPartInstructions && subInstructions ? (
          <RichTextHtml html={subInstructions} className="text-foreground/90" />
        ) : null}
        {!instructions?.trim() && !showPartInstructions ? (
          <p className="text-sm text-muted-foreground">No test or part instructions for this page yet.</p>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Part {currentPart}</p>
        {pageRange ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Page {pageIndex + 1} of {LISTENING_QUESTION_PAGE_COUNT} · Q{pageRange.start}–{pageRange.end}
          </p>
        ) : null}
      </div>

      <div className="flex-1 rounded-[16px] border border-border bg-card px-4 py-5 shadow-[var(--shadow-card)]">
        {pageQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions in this range yet.</p>
        ) : (
          <>
            {extractQuestionsHeading ? (
              <RichTextHtml html={extractQuestionsHeading} className="listening-exam-extract-heading" />
            ) : fallbackHeading ? (
              <p className="listening-exam-questions-heading mb-6 font-portal-display text-base font-semibold text-foreground">
                {fallbackHeading}
              </p>
            ) : null}
            {partAQuestionSections ? (
              <ListeningPartAQuestionSections
                sections={partAQuestionSections}
                answers={answers}
                onAnswerChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
                highlightKeyPrefix={`preview-part-a-${pageIndex}`}
              />
            ) : (
              <QuestionPanel
                embedded
                questions={pageQuestions}
                answers={answers}
                onAnswerChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
                showPartLabel={false}
                showPartInstructions={false}
                testType="LISTENING"
              />
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <span className="text-xs text-muted-foreground">
          Page {pageIndex + 1} of {LISTENING_QUESTION_PAGE_COUNT}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            disabled={pageIndex <= 0}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => setPageIndex((current) => Math.min(LISTENING_QUESTION_PAGE_COUNT - 1, current + 1))}
            disabled={pageIndex >= LISTENING_QUESTION_PAGE_COUNT - 1}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
