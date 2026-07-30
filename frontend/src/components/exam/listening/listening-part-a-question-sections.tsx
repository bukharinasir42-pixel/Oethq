"use client";

import { RichTextHtml } from "@/components/editor/rich-text-html";
import { ExamHighlightable } from "@/components/exam/exam-highlightable";
import { QuestionPanel } from "@/components/exam/questions/question-panel";
import type { ListeningPartAQuestionSection } from "@/lib/listening-part-a-question-heading-groups";
import type { TestQuestionDto } from "@/lib/types";

type ListeningPartAQuestionSectionsProps = {
  sections: ListeningPartAQuestionSection[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  activeQuestionId?: string;
  highlightKeyPrefix?: string;
};

export function ListeningPartAQuestionSections({
  sections,
  answers,
  onAnswerChange,
  activeQuestionId,
  highlightKeyPrefix = "part-a-section"
}: ListeningPartAQuestionSectionsProps) {
  return (
    <div className="space-y-6">
      {sections.map((section, index) => (
        <div key={`${highlightKeyPrefix}-${index}`}>
          {section.heading ? (
            <ExamHighlightable highlightKey={`${highlightKeyPrefix}-heading-${index}`}>
              <RichTextHtml html={section.heading} className="listening-exam-questions-heading mb-6" />
            </ExamHighlightable>
          ) : null}
          <QuestionPanel
            embedded
            questions={section.questions}
            answers={answers}
            onAnswerChange={onAnswerChange}
            showPartLabel={false}
            showPartInstructions={false}
            testType="LISTENING"
            activeQuestionId={activeQuestionId}
          />
        </div>
      ))}
    </div>
  );
}

export type { ListeningPartAQuestionSection, TestQuestionDto };
