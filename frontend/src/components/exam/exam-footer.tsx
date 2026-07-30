"use client";

import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { ExamSession } from "./hooks/use-exam-session";
import type { TestQuestionDto } from "@/lib/types";

type ExamFooterProps = {
  session: ExamSession;
  centered?: boolean;
};

function groupQuestionsByPart(questions: TestQuestionDto[]) {
  const parts: Array<{ key: string; label: string; questions: TestQuestionDto[] }> = [];
  const partA = questions.filter((q) => q.part === "A");
  const partB = questions.filter((q) => q.part === "B");
  const partC = questions.filter((q) => q.part === "C");
  if (partA.length) parts.push({ key: "A", label: "Part A", questions: partA });
  if (partB.length) parts.push({ key: "B", label: "Part B", questions: partB });
  if (partC.length) parts.push({ key: "C", label: "Part C", questions: partC });
  return parts;
}

export function ExamFooter({ session, centered = false }: ExamFooterProps) {
  const {
    test,
    questions,
    answers,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    canJumpToQuestion,
    canJumpToPart,
    jumpToPart,
    goNext,
    goPrevious,
    currentQuestion,
    answeredCount,
    listeningPageIndex,
    listeningPageCount,
    section,
    submitting,
    finishPartAEarly,
    submitAttempt
  } = session;

  const isListening = test.type === "LISTENING";
  const isReading = test.type === "READING";
  const partGroups = groupQuestionsByPart(questions);
  const activePart = currentQuestion.part;
  const atFirstPage = isListening ? listeningPageIndex <= 0 : currentQuestionIndex === 0;
  const atLastPage = isListening
    ? listeningPageIndex >= listeningPageCount - 1
    : currentQuestionIndex === questions.length - 1;

  const partAQuestions = questions.filter((q) => q.part === "A");
  const partBCQuestions = questions.filter((q) => q.part === "B" || q.part === "C");
  const answeredPartA = partAQuestions.filter((q) => answers[q.id]).length;
  const answeredPartBC = partBCQuestions.filter((q) => answers[q.id]).length;
  const showFinishPartA = isReading && section === "READING_PART_A";
  const showFinishPartBC = isReading && section === "READING_PART_BC";

  return (
    <footer className="exam-footer flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2 overflow-x-auto lg:flex-row lg:items-center",
          centered && "mx-auto w-full max-w-4xl"
        )}
      >
        {partGroups.map((group) => {
          const answeredInPart = group.questions.filter((q) => answers[q.id]).length;
          const isActivePart = group.key === activePart;
          const partJumpEnabled = canJumpToPart(group.key);
          return (
            <div
              key={group.key}
              role={partJumpEnabled ? "button" : undefined}
              tabIndex={partJumpEnabled ? 0 : undefined}
              onClick={() => {
                if (partJumpEnabled) jumpToPart(group.key);
              }}
              onKeyDown={(event) => {
                if (!partJumpEnabled) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  jumpToPart(group.key);
                }
              }}
              className={cn(
                "min-w-0 rounded-xl border px-2 py-1.5 transition-colors",
                isActivePart ? "border-primary/40 bg-primary/[0.05]" : "border-transparent bg-muted/20",
                partJumpEnabled && "cursor-pointer hover:border-primary/25 hover:bg-primary/[0.03]",
                !partJumpEnabled && "opacity-80"
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-semibold text-foreground">{group.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {answeredInPart} of {group.questions.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {group.questions.map((question) => {
                  const index = questions.findIndex((q) => q.id === question.id);
                  const answered = Boolean(answers[question.id]);
                  const isCurrent = index === currentQuestionIndex;
                  const locked = !canJumpToQuestion(index);
                  return (
                    <button
                      key={question.id}
                      type="button"
                      className={cn(
                        "exam-q-pill h-8 min-w-8 text-xs",
                        isCurrent && "exam-q-pill-current",
                        !isCurrent && answered && "exam-q-pill-answered",
                        !isCurrent && !answered && !locked && "exam-q-pill-default",
                        locked && "exam-q-pill-locked"
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (canJumpToQuestion(index)) setCurrentQuestionIndex(index);
                      }}
                      disabled={locked}
                      aria-label={`Question ${question.sequence}${answered ? ", answered" : ""}`}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {answered && !isCurrent ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        question.sequence
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center justify-end gap-2 self-end lg:self-center",
          centered && "mx-auto"
        )}
      >
        <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">
          {isListening
            ? `Page ${listeningPageIndex + 1} of ${listeningPageCount}`
            : `${answeredCount}/${questions.length} answered`}
        </span>

        {showFinishPartA ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="h-10 gap-1.5 rounded-full bg-[#1e6fc4] px-5 text-white hover:bg-[#1a63b0]"
                disabled={submitting}
              >
                Finish Part A
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Finish Part A early?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have answered {answeredPartA} of {partAQuestions.length} Part A questions. Once you continue, Part
                  A is locked and you cannot return. Your 45-minute Parts B &amp; C timer will start immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep working</AlertDialogCancel>
                <AlertDialogAction onClick={() => void finishPartAEarly()}>Finish Part A</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {showFinishPartBC ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="h-10 gap-1.5 rounded-full bg-[#1e6fc4] px-5 text-white hover:bg-[#1a63b0]"
                disabled={submitting}
              >
                Finish Parts B &amp; C
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Finish Parts B &amp; C?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have answered {answeredPartBC} of {partBCQuestions.length} Parts B &amp; C questions (
                  {answeredCount} of {questions.length} overall). Submitting ends the test and scores your attempt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep working</AlertDialogCancel>
                <AlertDialogAction onClick={() => void submitAttempt(false)}>Submit test</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size={centered && isListening ? "sm" : "icon"}
          className={cn(centered && isListening ? "h-10 gap-1.5 rounded-full px-4" : "h-11 w-11 rounded-full")}
          onClick={goPrevious}
          disabled={isListening ? atFirstPage : atFirstPage || !canJumpToQuestion(currentQuestionIndex - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
          {centered && isListening ? "Previous" : null}
        </Button>
        <Button
          type="button"
          size={centered && isListening ? "sm" : "icon"}
          className={cn(centered && isListening ? "h-10 gap-1.5 rounded-full px-4" : "h-11 w-11 rounded-full")}
          onClick={goNext}
          disabled={
            isListening ? atLastPage : atLastPage || !canJumpToQuestion(currentQuestionIndex + 1)
          }
          aria-label="Next page"
        >
          {centered && isListening ? "Next" : null}
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </footer>
  );
}
