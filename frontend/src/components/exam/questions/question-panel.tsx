"use client";

import { useEffect, useRef } from "react";
import { RichTextHtml } from "@/components/editor/rich-text-html";
import { ExamHighlightable } from "@/components/exam/exam-highlightable";
import type { TestQuestionDto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InlineFillBlankPrompt } from "./inline-fill-blank-prompt";
import { QuestionInput } from "./question-input";
import { getReadingSectionIntroAtSequence } from "../reading/reading-exam-instructions";
import { ReadingSectionIntroBlock } from "../reading/reading-section-intro";

type QuestionPanelProps = {
  questions: TestQuestionDto[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  instructions?: string | null;
  subInstructions?: string | null;
  showPartInstructions?: boolean;
  showPartLabel?: boolean;
  testType?: "READING" | "LISTENING";
  activeQuestionId?: string;
  /** When true, the parent handles scrolling and outer padding. */
  embedded?: boolean;
  className?: string;
};

function getQuestionElementId(questionId: string) {
  return `exam-question-${questionId}`;
}

export function QuestionPanel({
  questions,
  answers,
  onAnswerChange,
  instructions,
  subInstructions,
  showPartInstructions = true,
  showPartLabel = true,
  testType,
  activeQuestionId,
  embedded = false,
  className
}: QuestionPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const first = questions[0];

  useEffect(() => {
    if (!activeQuestionId || questions.length <= 1) return;
    const container = scrollContainerRef.current;
    const target =
      container?.querySelector<HTMLElement>(`#${getQuestionElementId(activeQuestionId)}`) ??
      document.getElementById(getQuestionElementId(activeQuestionId));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeQuestionId, questions.length]);

  if (!first) return null;

  const questionList = (
    <div className={embedded ? (testType === "LISTENING" ? "space-y-5" : "space-y-6") : "space-y-8"}>
      {questions.map((question) => {
        const sectionIntro =
          testType === "READING" ? getReadingSectionIntroAtSequence(question.sequence) : null;

        return (
          <div key={question.id} className="space-y-3">
            {sectionIntro ? <ReadingSectionIntroBlock {...sectionIntro} /> : null}
            <article id={getQuestionElementId(question.id)} className="scroll-mt-4 space-y-3">
              {question.type === "FILL_BLANK" ? (
                <InlineFillBlankPrompt
                  question={question}
                  value={answers[question.id] || ""}
                  onChange={(value) => onAnswerChange(question.id, value)}
                  testType={testType}
                />
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="exam-question-badge mt-0.5">{question.sequence}</span>
                    <ExamHighlightable highlightKey={`question-${question.id}`} className="flex-1">
                      <p className="text-base leading-relaxed text-foreground">{question.content}</p>
                    </ExamHighlightable>
                  </div>
                  <QuestionInput
                    question={question}
                    value={answers[question.id] || ""}
                    onChange={(value) => onAnswerChange(question.id, value)}
                  />
                </>
              )}
            </article>
          </div>
        );
      })}
    </div>
  );

  if (embedded) {
    return <div className={className}>{questionList}</div>;
  }

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "thin-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 py-5 sm:px-6",
        className
      )}
    >
      {instructions ? (
        <div className="mb-4 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
          <ExamHighlightable highlightKey="instructions">
            <RichTextHtml html={instructions} />
          </ExamHighlightable>
        </div>
      ) : null}
      {showPartLabel ? (
        <div className="mb-4">
          <h2 className="font-portal-display text-2xl font-semibold tracking-tight text-foreground">
            Part {first.part}
          </h2>
        </div>
      ) : null}
      {showPartInstructions && subInstructions ? (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Part {first.part} instructions
          </p>
          <ExamHighlightable highlightKey={`sub-instructions-${first.part}`}>
            <RichTextHtml html={subInstructions} />
          </ExamHighlightable>
        </div>
      ) : null}
      {questionList}
    </div>
  );
}
