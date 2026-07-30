"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { TestQuestionDto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuestionNumberBadge } from "./question-number-badge";

type QuestionInputProps = {
  question: TestQuestionDto;
  value: string;
  onChange: (value: string) => void;
  showBadge?: boolean;
};

const LETTER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function QuestionInput({ question, value, onChange, showBadge = true }: QuestionInputProps) {
  if (question.type === "MCQ") {
    return (
      <RadioGroup value={value} onValueChange={onChange} className="space-y-1">
        {(question.options || []).map((option, index) => {
          const letter = LETTER_LABELS[index] || String(index + 1);
          const inputId = `${question.id}-${option}`;
          return (
            <div
              key={option}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg py-1.5 px-2.5 transition-colors duration-200 hover:bg-muted/40",
                value === option && "bg-primary/[0.08]"
              )}
            >
              <RadioGroupItem value={option} id={inputId} className="mt-1" />
              <Label htmlFor={inputId} className="flex flex-1 cursor-pointer gap-3 text-base leading-snug">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-foreground">
                  {letter}
                </span>
                <span className="pt-0.5">{option}</span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {showBadge ? <QuestionNumberBadge sequence={question.sequence} /> : null}
      <div className="min-w-0 flex-1">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your answer"
          className="h-11 text-base"
          aria-label={`Answer for question ${question.sequence}`}
        />
      </div>
    </div>
  );
}
