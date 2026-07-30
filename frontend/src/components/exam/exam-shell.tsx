"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExamHeader } from "./exam-header";
import { ExamHighlightProvider } from "./exam-highlight-context";
import { ExamNoCopy } from "./exam-no-copy";
import { ScreenshotGuard } from "./screenshot-guard";
import { useExamSession } from "./hooks/use-exam-session";
import { ListeningExamLayout } from "./listening/listening-exam-layout";
import { ReadingExamLayout } from "./reading/reading-exam-layout";
import { RouteLoadingScreen } from "@/components/loaders";

type ExamShellProps = {
  token: string;
  testId: string;
};

export function ExamShell({ token, testId }: ExamShellProps) {
  const { loadError, session } = useExamSession({ token, testId });
  const [reviewOpen, setReviewOpen] = useState(false);

  if (loadError) {
    return (
      <div className="exam-chrome p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load the exam</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="exam-chrome flex items-center justify-center p-6">
        <EmptyState
          title="Preparing your attempt"
          description="The timer, answers, and section state are being restored before the exam begins."
        />
      </div>
    );
  }

  const unanswered = session.questions.filter((q) => !session.answers[q.id]);

  return (
    <div className="exam-chrome exam-paper-grain fixed inset-0 z-50 flex flex-col">
      <ScreenshotGuard active context="test" />
      {session.submitting && (
        <RouteLoadingScreen
          title="Submitting your exam"
          subtitle="Securing your responses..."
          progressLabel="exam.submit"
          progressValueLabel="sending"
          footerText="Saving attempt · please wait"
        />
      )}
      <ExamHeader session={session} onReviewClick={() => setReviewOpen(true)} />
      <ExamHighlightProvider testId={testId}>
        <ExamNoCopy>
          {session.test.type === "LISTENING" ? (
            <ListeningExamLayout session={session} />
          ) : (
            <ReadingExamLayout session={session} />
          )}
        </ExamNoCopy>
      </ExamHighlightProvider>

      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Review unanswered</SheetTitle>
            <SheetDescription>
              {unanswered.length === 0
                ? "You have answered every question."
                : `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} still need an answer.`}
            </SheetDescription>
          </SheetHeader>
          <ul className="mt-4 space-y-2">
            {unanswered.map((q) => {
              const index = session.questions.findIndex((item) => item.id === q.id);
              return (
                <li key={q.id}>
                  <Button
                    variant="outline"
                    className="h-auto w-full justify-start py-2 text-left"
                    onClick={() => {
                      if (session.canJumpToQuestion(index)) {
                        session.setCurrentQuestionIndex(index);
                        setReviewOpen(false);
                      }
                    }}
                    disabled={!session.canJumpToQuestion(index)}
                  >
                    <span className="font-semibold">Q{q.sequence}</span>
                    <span className="ml-2 truncate text-muted-foreground">Part {q.part}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
