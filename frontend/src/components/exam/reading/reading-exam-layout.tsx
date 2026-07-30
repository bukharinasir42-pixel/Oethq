"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExamFooter } from "../exam-footer";
import { ExamPartTransition } from "../exam-part-transition";
import { ExamResultPanel } from "../exam-result-panel";
import {
  getReadingBookletHtml,
  getReadingBookletUrl
} from "../exam-utils";
import { getReadingPartTransitionIntro } from "./reading-exam-instructions";
import type { ExamSession } from "../hooks/use-exam-session";
import { ReadingPartAQuestionPanel } from "../questions/reading-part-a-question-panel";
import { ReadingPartBCQuestionPanel } from "../questions/reading-part-bc-question-panel";
import { BookletPane } from "./booklet-pane";
import { ResizableSplit } from "./resizable-split";

type ReadingExamLayoutProps = {
  session: ExamSession;
};

export function ReadingExamLayout({ session }: ReadingExamLayoutProps) {
  const {
    test,
    currentQuestion,
    questions,
    answers,
    setAnswers,
    result,
    activePartBExtractId,
    activePartCExtractId,
    partCQuestionsInExtract
  } = session;

  const part = currentQuestion?.part ?? "A";
  const seenTransitionPartsRef = useRef(new Set<"B" | "C">());
  const [transitionPart, setTransitionPart] = useState<"B" | "C" | null>(null);
  const dismissPartTransition = useCallback(() => setTransitionPart(null), []);

  useEffect(() => {
    if (part !== "B" && part !== "C") return;
    if (seenTransitionPartsRef.current.has(part)) return;
    seenTransitionPartsRef.current.add(part);
    setTransitionPart(part);
  }, [part]);

  if (result) {
    return (
      <main className="exam-main flex items-center justify-center overflow-y-auto p-6">
        <ExamResultPanel result={result} />
      </main>
    );
  }

  if (!currentQuestion) return null;

  const activeExtractId =
    part === "B" ? activePartBExtractId : part === "C" ? activePartCExtractId : null;
  const bookletHtml = getReadingBookletHtml(part, test, activeExtractId);
  const bookletUrl = getReadingBookletUrl(part, test, activeExtractId);

  const partAQuestions = questions.filter((question) => question.part === "A");

  const displayQuestions =
    part === "A"
      ? partAQuestions
      : part === "C" && partCQuestionsInExtract.length > 0
        ? partCQuestionsInExtract
        : [currentQuestion];

  const questionPanel =
    part === "A" ? (
      <ReadingPartAQuestionPanel
        questions={displayQuestions}
        answers={answers}
        onAnswerChange={(id, value) => setAnswers((c) => ({ ...c, [id]: value }))}
        activeQuestionId={currentQuestion.id}
      />
    ) : (
      <ReadingPartBCQuestionPanel
        part={part === "C" ? "C" : "B"}
        questions={displayQuestions}
        answers={answers}
        onAnswerChange={(id, value) => setAnswers((c) => ({ ...c, [id]: value }))}
        activeQuestionId={currentQuestion.id}
      />
    );

  const splitContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">{questionPanel}</div>
    </div>
  );

  return (
    <>
      {transitionPart ? (
        <ExamPartTransition
          part={transitionPart}
          partIntro={getReadingPartTransitionIntro(transitionPart)}
          onDismiss={dismissPartTransition}
        />
      ) : null}
      <div className="exam-main hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex">
        <ResizableSplit
          left={
            <BookletPane
              html={bookletHtml}
              signedUrl={bookletUrl}
              title={`Reading Part ${part} booklet`}
              highlightKey={`booklet-${part}-${activeExtractId || "default"}`}
            />
          }
          right={splitContent}
        />
      </div>
      <div className="exam-main flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        <div className="h-[38vh] min-h-[200px] shrink-0 border-b border-border/60">
          <BookletPane
            html={bookletHtml}
            signedUrl={bookletUrl}
            title={`Reading Part ${part} booklet`}
            highlightKey={`booklet-${part}-${activeExtractId || "default"}`}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{splitContent}</div>
      </div>
      <ExamFooter session={session} />
    </>
  );
}
