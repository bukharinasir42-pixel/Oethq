import { cn } from "@/lib/utils";

type QuestionNumberBadgeProps = {
  sequence: number;
  className?: string;
};

export function QuestionNumberBadge({ sequence, className }: QuestionNumberBadgeProps) {
  return (
    <span className={cn("exam-question-badge", className)} aria-hidden>
      {sequence}
    </span>
  );
}
