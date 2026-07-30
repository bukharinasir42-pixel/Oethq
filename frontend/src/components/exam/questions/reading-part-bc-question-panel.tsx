"use client";

import { useEffect, useRef } from "react";
import { ExamHighlightable } from "@/components/exam/exam-highlightable";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { TestQuestionDto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { READING_PART_B_INTRO, READING_PART_C_INTRO } from "../reading/reading-exam-instructions";
import { InlineFillBlankPrompt } from "./inline-fill-blank-prompt";

type ReadingPartBCQuestionPanelProps = {
  part: "B" | "C";
  questions: TestQuestionDto[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  activeQuestionId?: string;
  className?: string;
};

const LETTER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getQuestionElementId(questionId: string) {
  return `exam-question-${questionId}`;
}

export function ReadingPartBCQuestionPanel({
  part,
  questions,
  answers,
  onAnswerChange,
  activeQuestionId,
  className
}: ReadingPartBCQuestionPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const intro = part === "B" ? READING_PART_B_INTRO : READING_PART_C_INTRO;

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
        "reading-part-bc-panel thin-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain",
        className
      )}
    >
      <div className="reading-part-bc-panel__intro">
        <p>{intro.body}</p>
      </div>

      <div className="reading-part-bc-panel__list">
        {questions.map((question) => {
          const value = answers[question.id] || "";
          const stem = question.content?.trim();
          const isActive = activeQuestionId === question.id;

          return (
            <article
              key={question.id}
              id={getQuestionElementId(question.id)}
              className={cn("reading-part-bc-card scroll-mt-4", isActive && "reading-part-bc-card--active")}
            >
              <div className="reading-part-bc-card__header">
                <span className="reading-part-bc-card__badge" aria-hidden>
                  {question.sequence}
                </span>
                <h3 className="reading-part-bc-card__label">Reading question {question.sequence}</h3>
              </div>

              {stem ? (
                <ExamHighlightable highlightKey={`question-${question.id}`} className="mt-3 block">
                  <p className="reading-part-bc-card__stem">{stem}</p>
                </ExamHighlightable>
              ) : null}

              {question.type === "FILL_BLANK" ? (
                <div className="mt-5">
                  <InlineFillBlankPrompt
                    question={question}
                    value={value}
                    onChange={(next) => onAnswerChange(question.id, next)}
                    testType="READING"
                  />
                </div>
              ) : (
                <RadioGroup
                  value={value}
                  onValueChange={(next) => onAnswerChange(question.id, next)}
                  className="reading-part-bc-options"
                >
                  {(question.options || []).map((option, index) => {
                    const letter = LETTER_LABELS[index] || String(index + 1);
                    const inputId = `${question.id}-opt-${letter}`;
                    const selected = value === option;
                    return (
                      <label
                        key={`${question.id}-${option}`}
                        htmlFor={inputId}
                        className={cn(
                          "reading-part-bc-option",
                          selected && "reading-part-bc-option--selected"
                        )}
                      >
                        <RadioGroupItem
                          value={option}
                          id={inputId}
                          className="reading-part-bc-option__radio"
                        />
                        <span className="reading-part-bc-option__letter" aria-hidden>
                          {letter}
                        </span>
                        <span className="reading-part-bc-option__text">{option}</span>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
