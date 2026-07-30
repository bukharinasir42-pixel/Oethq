"use client";

import { ClipboardList, Headphones } from "lucide-react";
import { RichTextHtml } from "@/components/editor/rich-text-html";
import { getPartSubInstructions, getListeningExtractQuestionHeading, getListeningPartAQuestionSections, shouldShowListeningPartInstructions } from "@/components/exam/exam-utils";
import { ExamHighlightable } from "@/components/exam/exam-highlightable";
import { getQuestionsForListeningPage } from "@/lib/test-question-templates";
import { ExamFooter } from "../exam-footer";
import { ExamResultPanel } from "../exam-result-panel";
import type { ExamSession } from "../hooks/use-exam-session";
import { QuestionPanel } from "../questions/question-panel";
import { ListeningAudioBar } from "./listening-audio-bar";
import { ListeningPartAQuestionSections } from "./listening-part-a-question-sections";

type ListeningExamLayoutProps = {
  session: ExamSession;
};

function formatPageHeading(questions: { sequence: number }[]) {
  if (questions.length === 0) return null;
  const first = questions[0].sequence;
  const last = questions[questions.length - 1].sequence;
  return first === last ? `Question ${first}` : `Questions ${first}–${last}`;
}

export function ListeningExamLayout({ session }: ListeningExamLayoutProps) {
  const {
    test,
    currentQuestion,
    questions,
    answers,
    setAnswers,
    result,
    listeningPageIndex
  } = session;

  if (result) {
    return (
      <main className="exam-main flex items-center justify-center overflow-y-auto p-6">
        <ExamResultPanel result={result} />
      </main>
    );
  }

  const displayQuestions = getQuestionsForListeningPage(questions, listeningPageIndex);

  const currentPart = displayQuestions[0]?.part ?? currentQuestion?.part ?? "A";
  const subInstructions = getPartSubInstructions(test, currentPart);
  const showPartInstructions = shouldShowListeningPartInstructions(currentPart, displayQuestions, subInstructions);
  const activeExtractId = displayQuestions[0]?.extractId ?? null;
  const partAExtractIndex = listeningPageIndex <= 1 ? listeningPageIndex : 0;
  const partAQuestionSections =
    currentPart === "A"
      ? getListeningPartAQuestionSections(test, activeExtractId, partAExtractIndex, displayQuestions)
      : null;
  const extractQuestionsHeading =
    currentPart === "A" || currentPart === "C"
      ? getListeningExtractQuestionHeading(test, currentPart, activeExtractId, partAExtractIndex)
      : null;
  const fallbackHeading =
    extractQuestionsHeading || partAQuestionSections ? null : formatPageHeading(displayQuestions);

  return (
    <>
      <ListeningAudioBar session={session} />
      <main className="exam-main listening-exam-main flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="thin-scrollbar mx-auto flex h-full w-full max-w-4xl flex-col overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="listening-exam-callout mb-10 flex items-start gap-3 rounded-xl border px-4 py-4 sm:px-5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Headphones className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-foreground/90">
              Your teacher will play the audio. Type your answers as you listen — when the test ends, press{" "}
              <span className="font-semibold text-foreground">Submit</span> to check your score.
            </p>
          </div>

          {test.instructions || (showPartInstructions && subInstructions) ? (
            <section className="listening-exam-instructions mb-8" aria-label="Test instructions">
              <div className="listening-exam-instructions__header">
                <span className="listening-exam-instructions__icon" aria-hidden>
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="listening-exam-instructions__eyebrow">Instructions</p>
                  <p className="listening-exam-instructions__title">
                    {showPartInstructions ? `Listening · Part ${currentPart}` : "Listening test"}
                  </p>
                </div>
              </div>

              <div className="listening-exam-prose listening-exam-instructions__body">
                {test.instructions ? (
                  <ExamHighlightable highlightKey="instructions">
                    <RichTextHtml
                      html={test.instructions}
                      className="text-foreground/90 [&_.ProseMirror]:text-foreground/90 [&_.mdx-content]:text-foreground/90"
                    />
                  </ExamHighlightable>
                ) : null}

                {showPartInstructions && subInstructions ? (
                  <div className={test.instructions ? "listening-exam-instructions__part" : undefined}>
                    <ExamHighlightable highlightKey={`sub-instructions-${currentPart}`}>
                      <RichTextHtml
                        html={subInstructions}
                        className="text-foreground/90 [&_.ProseMirror]:text-foreground/90 [&_.mdx-content]:text-foreground/90"
                      />
                    </ExamHighlightable>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="listening-exam-card shrink-0 rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="listening-exam-answers px-6 py-7 sm:px-8 sm:py-8">
              {extractQuestionsHeading ? (
                <ExamHighlightable highlightKey={`questions-heading-${activeExtractId ?? currentPart}`}>
                  <RichTextHtml
                    html={extractQuestionsHeading}
                    className="listening-exam-extract-heading"
                  />
                </ExamHighlightable>
              ) : fallbackHeading ? (
                <p className="listening-exam-questions-heading mb-6 font-portal-display text-base font-semibold text-foreground">
                  {fallbackHeading}
                </p>
              ) : null}
              {partAQuestionSections ? (
                <ListeningPartAQuestionSections
                  sections={partAQuestionSections}
                  answers={answers}
                  onAnswerChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
                  activeQuestionId={currentQuestion?.id}
                  highlightKeyPrefix={`part-a-${activeExtractId ?? partAExtractIndex}`}
                />
              ) : (
                <QuestionPanel
                  embedded
                  questions={displayQuestions}
                  answers={answers}
                  onAnswerChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
                  showPartLabel={false}
                  showPartInstructions={false}
                  testType="LISTENING"
                  activeQuestionId={currentQuestion?.id}
                />
              )}
            </div>
          </div>
        </div>
      </main>
      <ExamFooter session={session} centered />
    </>
  );
}
