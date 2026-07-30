"use client";

import type { TestQuestionDto } from "@/lib/types";
import { cn } from "@/lib/utils";

export const LETTER_CHOICE_VALUES = ["A", "B", "C", "D"] as const;

type LetterChoiceOptionsProps = {
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

/** True when MCQ options are letter choices (A–D), not long option stems. */
export function isLetterChoiceMcq(question: TestQuestionDto) {
  if (question.type !== "MCQ") return false;
  const options = question.options?.filter(Boolean) ?? [];
  if (options.length < 2 || options.length > 4) return false;
  return options.every((option) => /^([A-D]|Text\s+[A-D])\.?$/i.test(option.trim()));
}

function optionLetter(option: string, index: number) {
  const match = option.trim().match(/([A-D])/i);
  return (match?.[1] || LETTER_CHOICE_VALUES[index] || String(index + 1)).toUpperCase();
}

function valuesMatch(selected: string, option: string) {
  const left = selected.trim().toUpperCase();
  const right = option.trim().toUpperCase();
  if (!left) return false;
  if (left === right) return true;
  const leftLetter = left.match(/([A-D])/)?.[1];
  const rightLetter = right.match(/([A-D])/)?.[1];
  return Boolean(leftLetter && rightLetter && leftLetter === rightLetter);
}

export function LetterChoiceOptions({
  name,
  value,
  options,
  onChange,
  className,
  disabled
}: LetterChoiceOptionsProps) {
  const choices = options.length ? options : [...LETTER_CHOICE_VALUES];

  return (
    <div className={cn("reading-part-a-letters", className)} role="radiogroup" aria-label="Answer options">
      {choices.map((option, index) => {
        const letter = optionLetter(option, index);
        const selected = valuesMatch(value, option);
        const inputId = `${name}-letter-${letter}`;
        return (
          <label
            key={`${option}-${index}`}
            htmlFor={inputId}
            className={cn(
              "reading-part-a-letters__btn",
              selected && "reading-part-a-letters__btn--selected",
              disabled && "pointer-events-none opacity-60"
            )}
          >
            <input
              id={inputId}
              type="radio"
              name={name}
              value={option}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span aria-hidden>{letter}</span>
            <span className="sr-only">Option {letter}</span>
          </label>
        );
      })}
    </div>
  );
}
