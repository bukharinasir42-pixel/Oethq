"use client";

import { useEffect, useRef } from "react";
import { ExamHighlightable } from "@/components/exam/exam-highlightable";
import type { TestQuestionDto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getReadingSectionIntroAtSequence } from "../reading/reading-exam-instructions";
import { splitFillBlankContent } from "./fill-blank-utils";
import { InlineFillBlankPrompt } from "./inline-fill-blank-prompt";
import { LetterChoiceOptions, isLetterChoiceMcq, LETTER_CHOICE_VALUES } from "./letter-choice-options";
import { QuestionInput } from "./question-input";

type ReadingPartAQuestionPanelProps = {
  questions: TestQuestionDto[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  activeQuestionId?: string;
  className?: string;
};

function getQuestionElementId(questionId: string) {
  return `exam-question-${questionId}`;
}

function formatSequenceRange(questions: TestQuestionDto[]) {
  if (!questions.length) return "1–20";
  const first = questions[0].sequence;
  const last = questions[questions.length - 1].sequence;
  return first === last ? String(first) : `${first}–${last}`;
}

function sectionEyebrow(sequence: number, title?: string) {
  if (sequence === 1) return "Questions 1–7 · Which text (A, B, C or D)?";
  if (sequence === 8) return "Questions 8–13 · Word or short phrase";
  if (sequence === 14) return "Questions 14–20 · Complete the sentences";
  return title || null;
}

export function ReadingPartAQuestionPanel({
  questions,
  answers,
  onAnswerChange,
  activeQuestionId,
  className
}: ReadingPartAQuestionPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rangeLabel = formatSequenceRange(questions);

  useEffect(() => {
    if (!activeQuestionId || questions.length <= 1) return;
    const container = scrollContainerRef.current;
    const target =
      container?.querySelector<HTMLElement>(`#${getQuestionElementId(activeQuestionId)}`) ??
      document.getElementById(getQuestionElementId(activeQuestionId));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeQuestionId, questions.length]);

  if (!questions.length) return null;

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "reading-part-a-panel thin-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain",
        className
      )}
    >
      <header className="reading-part-a-panel__header">
        <p className="reading-part-a-panel__eyebrow">Part A</p>
        <h2 className="reading-part-a-panel__title">Questions {rangeLabel}</h2>
        <p className="reading-part-a-panel__lead">
          Take your answers only from Texts A–D. Spelling should be accurate.
        </p>
      </header>

      <div className="reading-part-a-panel__list">
        {questions.map((question) => {
          const sectionIntro = getReadingSectionIntroAtSequence(question.sequence);
          const eyebrow = sectionIntro ? sectionEyebrow(question.sequence, sectionIntro.title) : null;
          const value = answers[question.id] || "";
          const letterMcq = isLetterChoiceMcq(question);
          // OET Part A Q1–7: which text — A–D buttons; answer value stays a letter string.
          const whichTextBlank =
            question.type === "FILL_BLANK" && question.sequence >= 1 && question.sequence <= 7;
          const { before, after } = splitFillBlankContent(question.content);
          const stemText = whichTextBlank
            ? [before, after].filter(Boolean).join(" ").trim() || question.content
            : question.content;

          return (
            <div key={question.id} className="space-y-3">
              {eyebrow ? (
                <div className="reading-part-a-panel__section">
                  <p className="reading-part-a-panel__section-label">{eyebrow}</p>
                </div>
              ) : null}

              <article
                id={getQuestionElementId(question.id)}
                className={cn(
                  "reading-part-a-card scroll-mt-4",
                  activeQuestionId === question.id && "reading-part-a-card--active"
                )}
              >
                {whichTextBlank ? (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="reading-part-a-card__badge" aria-hidden>
                        {question.sequence}
                      </span>
                      <ExamHighlightable highlightKey={`question-${question.id}`} className="min-w-0 flex-1">
                        <p className="reading-part-a-card__stem">{stemText}</p>
                      </ExamHighlightable>
                    </div>
                    <LetterChoiceOptions
                      name={question.id}
                      value={value}
                      options={[...LETTER_CHOICE_VALUES]}
                      onChange={(next) => onAnswerChange(question.id, next)}
                      className="mt-4"
                    />
                  </>
                ) : question.type === "FILL_BLANK" ? (
                  <InlineFillBlankPrompt
                    question={question}
                    value={value}
                    onChange={(next) => onAnswerChange(question.id, next)}
                    testType="READING"
                    className="reading-part-a-card__fill"
                  />
                ) : letterMcq ? (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="reading-part-a-card__badge" aria-hidden>
                        {question.sequence}
                      </span>
                      <ExamHighlightable highlightKey={`question-${question.id}`} className="min-w-0 flex-1">
                        <p className="reading-part-a-card__stem">{question.content}</p>
                      </ExamHighlightable>
                    </div>
                    <LetterChoiceOptions
                      name={question.id}
                      value={value}
                      options={question.options || [...LETTER_CHOICE_VALUES]}
                      onChange={(next) => onAnswerChange(question.id, next)}
                      className="mt-4"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="reading-part-a-card__badge" aria-hidden>
                        {question.sequence}
                      </span>
                      <ExamHighlightable highlightKey={`question-${question.id}`} className="min-w-0 flex-1">
                        <p className="reading-part-a-card__stem">{question.content}</p>
                      </ExamHighlightable>
                    </div>
                    <div className="mt-4">
                      <QuestionInput
                        question={question}
                        value={value}
                        onChange={(next) => onAnswerChange(question.id, next)}
                        showBadge={false}
                      />
                    </div>
                  </>
                )}
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}
