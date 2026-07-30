import { QuestionPart, QuestionType, TestType } from "@prisma/client";

type QuestionTemplateInput = {
  sequence: number;
  part: QuestionPart;
  extractId?: string;
  type: QuestionType;
  options?: string[];
};

function getReadingQuestionTemplate(sequence: number): QuestionTemplateInput {
  const part =
    sequence <= 20 ? QuestionPart.A : sequence <= 26 ? QuestionPart.B : QuestionPart.C;

  if (part === QuestionPart.A) {
    return { sequence, part, type: QuestionType.FILL_BLANK };
  }

  if (part === QuestionPart.B) {
    return {
      sequence,
      part,
      extractId: `reading-b-${sequence - 20}`,
      type: QuestionType.MCQ,
      options: ["Option A", "Option B", "Option C"]
    };
  }

  return {
    sequence,
    part,
    extractId: sequence <= 34 ? "reading-c-1" : "reading-c-2",
    type: QuestionType.MCQ,
    options: ["Option A", "Option B", "Option C", "Option D"]
  };
}

function getListeningQuestionTemplate(sequence: number): QuestionTemplateInput {
  const part =
    sequence <= 24 ? QuestionPart.A : sequence <= 30 ? QuestionPart.B : QuestionPart.C;

  if (part === QuestionPart.A) {
    return {
      sequence,
      part,
      extractId: sequence <= 12 ? "listening-a-1" : "listening-a-2",
      type: QuestionType.FILL_BLANK
    };
  }

  if (part === QuestionPart.B) {
    return {
      sequence,
      part,
      extractId: `listening-b-${sequence - 24}`,
      type: QuestionType.MCQ,
      options: ["Option A", "Option B", "Option C"]
    };
  }

  return {
    sequence,
    part,
    extractId: sequence <= 36 ? "listening-c-1" : "listening-c-2",
    type: QuestionType.MCQ,
    options: ["Option A", "Option B", "Option C"]
  };
}

export function buildQuestions(type: TestType, contentPrefix = "") {
  return Array.from({ length: 42 }, (_, index) => {
    const sequence = index + 1;
    const meta =
      type === TestType.READING
        ? getReadingQuestionTemplate(sequence)
        : getListeningQuestionTemplate(sequence);

    return {
      sequence: meta.sequence,
      part: meta.part,
      extractId: meta.extractId,
      type: meta.type,
      content:
        meta.type === QuestionType.FILL_BLANK
          ? `${contentPrefix}Complete the sentence: The answer for question ${sequence} is [blank].`
          : `${contentPrefix}${type} question ${sequence}`,
      options: meta.options,
      correctAnswer:
        type === TestType.READING &&
        meta.part === QuestionPart.A &&
        sequence <= 6 &&
        meta.type === QuestionType.FILL_BLANK
          ? "A"
          : meta.type === QuestionType.FILL_BLANK
            ? `answer-${sequence}`
            : meta.options?.[0] || "Option A",
      explanation: `Reference explanation for ${type.toLowerCase()} question ${sequence}`,
      points: 1
    };
  });
}

export const LISTENING_TRACK_LABELS = [
  "Part A — Extract 1 (Q1–12)",
  "Part A — Extract 2 (Q13–24)",
  "Part B — Extract 1 (Q25)",
  "Part B — Extract 2 (Q26)",
  "Part B — Extract 3 (Q27)",
  "Part B — Extract 4 (Q28)",
  "Part B — Extract 5 (Q29)",
  "Part B — Extract 6 (Q30)",
  "Part C — Extract 1 (Q31–36)",
  "Part C — Extract 2 (Q37–42)"
] as const;
