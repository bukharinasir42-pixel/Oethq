import { AlertTriangle } from "lucide-react";

type ExamWordLimitBannerProps = {
  children?: React.ReactNode;
};

export function ExamWordLimitBanner({
  children = "NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer unless stated otherwise."
}: ExamWordLimitBannerProps) {
  return (
    <div className="border-b border-destructive/20 bg-destructive/[0.06] px-4 py-3 sm:px-6">
      <p className="mx-auto flex max-w-3xl items-start gap-2 text-sm leading-relaxed text-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <span>
          <span className="exam-word-limit font-semibold">Word limit: </span>
          {children}
        </span>
      </p>
    </div>
  );
}
