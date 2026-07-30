"use client";

import { useRef } from "react";
import { BetweenHorizontalStart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FILL_BLANK_PROMPT_HINT,
  FILL_BLANK_TOKEN,
  hasFillBlankPlaceholder
} from "@/components/exam/questions/fill-blank-utils";

type FillBlankPromptEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

export function FillBlankPromptEditor({ id, value, onChange }: FillBlankPromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasBlank = hasFillBlankPlaceholder(value);

  const insertAnswerSpace = () => {
    if (hasBlank) return;

    const element = textareaRef.current;
    const token = FILL_BLANK_TOKEN;

    if (!element) {
      onChange(value.trim() ? `${value}${token}` : token);
      return;
    }

    const start = element.selectionStart ?? value.length;
    const end = element.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(nextValue);

    requestAnimationFrame(() => {
      element.focus();
      const cursor = start + token.length;
      element.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>Question prompt</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={hasBlank}
          onClick={insertAnswerSpace}
        >
          <BetweenHorizontalStart className="mr-2 h-4 w-4" />
          Add answer space
        </Button>
      </div>
      <Textarea
        ref={textareaRef}
        id={id}
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Safaricom is the largest mobile phone company in Kenya."
      />
      <p className="text-xs text-muted-foreground">
        {hasBlank ? "Answer space added. Remove [blank] from the text to insert another." : FILL_BLANK_PROMPT_HINT}
      </p>
    </div>
  );
}
