"use client";

import type { TestQuestionDto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ExamHighlightable } from "@/components/exam/exam-highlightable";
import { isSingleCharacterReadingAnswer } from "../exam-utils";
import { splitFillBlankContent } from "./fill-blank-utils";
import { QuestionNumberBadge } from "./question-number-badge";

type InlineFillBlankPromptProps = {
  question: TestQuestionDto;
  value: string;
  onChange: (value: string) => void;
  testType?: "READING" | "LISTENING";
  className?: string;
};

export function InlineFillBlankPrompt({
  question,
  value,
  onChange,
  testType,
  className
}: InlineFillBlankPromptProps) {
  const { before, after, hasPlaceholder } = splitFillBlankContent(question.content);
  const singleCharacter = isSingleCharacterReadingAnswer(question, testType);
  const isListening = testType === "LISTENING";

  const blankField = (
    <span className="mx-1 inline-flex items-center gap-1.5 align-middle">
      <QuestionNumberBadge
        sequence={question.sequence}
        className={cn(isListening && "exam-listening-q-badge", !isListening && "h-6 w-6 text-[11px]")}
      />
      <input
        type="text"
        value={value}
        maxLength={singleCharacter ? 1 : undefined}
        onChange={(event) => onChange(singleCharacter ? event.target.value.slice(0, 1) : event.target.value)}
        aria-label={`Answer for question ${question.sequence}`}
        className={cn(
          "inline-flex text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground",
          isListening
            ? "exam-listening-blank"
            : cn(
                "h-9 rounded-full border border-border/80 bg-background shadow-sm",
                "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
                singleCharacter ? "w-12 min-w-12 px-0 text-center uppercase" : "min-w-[7.5rem] max-w-full px-4"
              )
        )}
      />
    </span>
  );

  return (
    <div className={cn(isListening ? "space-y-5" : "space-y-2", className)}>
      <p className={cn("leading-relaxed", isListening ? "text-[15px] leading-[1.75]" : "text-base")}>
        {hasPlaceholder ? (
          <>
            {before ? (
              <ExamHighlightable highlightKey={`question-${question.id}-before`} inline>
                <span>{before}</span>
              </ExamHighlightable>
            ) : null}
            {blankField}
            {after ? (
              <ExamHighlightable highlightKey={`question-${question.id}-after`} inline>
                <span>{after}</span>
              </ExamHighlightable>
            ) : null}
          </>
        ) : (
          <>
            {before ? (
              <ExamHighlightable highlightKey={`question-${question.id}-before`} inline>
                <span>{before}</span>
              </ExamHighlightable>
            ) : null}
            {before ? " " : null}
            {blankField}
          </>
        )}
      </p>
    </div>
  );
}
