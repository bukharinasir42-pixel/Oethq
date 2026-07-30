"use client";

import { Clock3, Send } from "lucide-react";
import { OetBrandLogo } from "@/components/brand/oet-brand-logo";
import { InlineLoader } from "@/components/loaders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { formatCountdownClock, formatMinutesRemaining } from "./exam-utils";
import type { ExamSession } from "./hooks/use-exam-session";

type ExamHeaderProps = {
  session: ExamSession;
  onReviewClick?: () => void;
};

export function ExamHeader({ session }: ExamHeaderProps) {
  const {
    test,
    timeRemainingSeconds,
    sectionRemainingSeconds,
    section,
    saving,
    submitting,
    answeredCount,
    questions,
    submitAttempt
  } = session;
  const isListening = test.type === "LISTENING";
  const isReading = test.type === "READING";
  const showSectionTimer = isReading && sectionRemainingSeconds != null;
  const displaySeconds = showSectionTimer ? sectionRemainingSeconds : timeRemainingSeconds;
  const urgent = displaySeconds <= 60;
  const sectionLabel =
    section === "READING_PART_A" ? "Part A" : section === "READING_PART_BC" ? "Parts B & C" : null;

  return (
    <header className={cn("exam-header", isListening && "listening-exam-header")}>
      {isListening ? (
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <OetBrandLogo href="/portal" className="w-[90px] max-h-8 shrink-0 sm:w-[100px] sm:max-h-9" />
          <span className="truncate text-sm font-semibold text-foreground sm:text-base">
            Listening · {test.title}
          </span>
        </div>
      ) : (
        <OetBrandLogo href="/portal" className="w-[100px] max-h-9 shrink-0 sm:w-[120px] sm:max-h-10" />
      )}

      <div className="mx-auto flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 sm:flex-row sm:gap-2">
        <Clock3
          className={cn("h-5 w-5 shrink-0", urgent ? "text-amber-600 dark:text-amber-400" : "text-primary")}
          aria-hidden
        />
        <span
          className={cn(
            "truncate text-sm font-semibold tabular-nums sm:text-base",
            urgent && "text-amber-700 dark:text-amber-300"
          )}
        >
          {showSectionTimer
            ? `${sectionLabel ? `${sectionLabel} · ` : ""}${formatCountdownClock(displaySeconds)}`
            : formatMinutesRemaining(timeRemainingSeconds)}
        </span>
        {saving ? (
          <span className="hidden text-[11px] text-muted-foreground sm:inline">Saving…</span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <ThemeToggle />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" className={cn("gap-1.5", isListening && "rounded-full px-5")} disabled={submitting}>
              {submitting ? (
                <InlineLoader label="Submitting" size="sm" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>{isListening ? "Submit test" : "Submit"}</span>
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit this attempt?</AlertDialogTitle>
              <AlertDialogDescription>
                You have answered {answeredCount} of {questions.length} questions. Once submitted, the attempt is locked
                and scored.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continue working</AlertDialogCancel>
              <AlertDialogAction onClick={() => void submitAttempt(false)}>Submit now</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}
