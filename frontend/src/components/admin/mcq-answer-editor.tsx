"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_OPTIONS = ["Option A", "Option B", "Option C", "Option D"] as const;

type McqAnswerEditorProps = {
  options: string[];
  correctAnswer: string;
  onOptionsChange: (options: string[]) => void;
  onCorrectAnswerChange: (value: string) => void;
  sequence: number;
  optionCount: 3 | 4;
};

function normalizeOptions(options: string[], optionCount: 3 | 4) {
  const padded = [...options];
  while (padded.length < optionCount) {
    padded.push(DEFAULT_OPTIONS[padded.length] || `Option ${String.fromCharCode(65 + padded.length)}`);
  }
  return padded.slice(0, optionCount);
}

export function McqAnswerEditor({
  options,
  correctAnswer,
  onOptionsChange,
  onCorrectAnswerChange,
  sequence,
  optionCount
}: McqAnswerEditorProps) {
  const resolvedOptions = normalizeOptions(options, optionCount);

  const updateOption = (index: number, value: string) => {
    const nextOptions = [...resolvedOptions];
    const previousValue = nextOptions[index];
    nextOptions[index] = value;
    onOptionsChange(nextOptions);
    if (correctAnswer === previousValue) {
      onCorrectAnswerChange(value);
    }
  };

  const selectableOptionIndexes = resolvedOptions
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.trim().length > 0);

  const correctIndex = resolvedOptions.findIndex((option) => option === correctAnswer);
  const selectedCorrectIndex =
    correctIndex >= 0 && resolvedOptions[correctIndex]?.trim()
      ? String(correctIndex)
      : selectableOptionIndexes[0]
        ? String(selectableOptionIndexes[0].index)
        : undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Answer options</p>
        <p className="text-xs text-muted-foreground">
          Enter {optionCount} answer choices for this question.
        </p>
        <div className="space-y-2">
          {resolvedOptions.map((option, optionIndex) => (
            <div key={`${sequence}-option-${optionIndex}`} className="flex items-center gap-2">
              <Label
                htmlFor={`option-${sequence}-${optionIndex}`}
                className="w-16 shrink-0 text-xs text-muted-foreground"
              >
                Option {optionIndex + 1}
              </Label>
              <Input
                id={`option-${sequence}-${optionIndex}`}
                value={option}
                onChange={(event) => updateOption(optionIndex, event.target.value)}
                placeholder={`Answer option ${optionIndex + 1}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-border/50 pt-4">
        <p className="text-sm font-semibold text-foreground">Set correct option</p>
        <p className="text-xs text-muted-foreground">Choose which answer option is marked correct when scoring.</p>
        <Select
          value={selectedCorrectIndex}
          onValueChange={(value) => {
            const index = Number(value);
            const option = resolvedOptions[index];
            if (option?.trim()) {
              onCorrectAnswerChange(option);
            }
          }}
          disabled={selectableOptionIndexes.length === 0}
        >
          <SelectTrigger id={`correct-option-${sequence}`}>
            <SelectValue placeholder="Select correct option" />
          </SelectTrigger>
          <SelectContent>
            {selectableOptionIndexes.map(({ option, index }) => (
              <SelectItem key={`${sequence}-correct-${index}`} value={String(index)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
