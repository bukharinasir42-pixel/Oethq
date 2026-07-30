import type { TestQuestionDto } from "@/lib/types";

export type QuestionTemplateInput = {
  sequence: number;
  part: "A" | "B" | "C";
  extractId?: string;
  type: "MCQ" | "FILL_BLANK";
  options: string[] | null;
};

export function getReadingQuestionTemplate(sequence: number): QuestionTemplateInput {
  const part = sequence <= 20 ? "A" : sequence <= 26 ? "B" : "C";

  if (part === "A") {
    return { sequence, part, type: "FILL_BLANK", options: null };
  }

  if (part === "B") {
    return {
      sequence,
      part,
      extractId: `reading-b-${sequence - 20}`,
      type: "MCQ",
      options: ["Option A", "Option B", "Option C"]
    };
  }

  return {
    sequence,
    part,
    extractId: sequence <= 34 ? "reading-c-1" : "reading-c-2",
    type: "MCQ",
    options: ["Option A", "Option B", "Option C", "Option D"]
  };
}

/** Stable Part B/C extract ids for reading questions (daily tests and past papers). */
export function resolveReadingQuestionExtractId(question: {
  part: string;
  sequence: number;
  extractId?: string | null;
}): string | undefined {
  if (question.part === "B" && question.sequence >= 21 && question.sequence <= 26) {
    return `reading-b-${question.sequence - 20}`;
  }
  if (question.part === "C" && question.sequence >= 27 && question.sequence <= 42) {
    return question.sequence <= 34 ? "reading-c-1" : "reading-c-2";
  }
  return question.extractId || undefined;
}

export function getListeningQuestionTemplate(sequence: number): QuestionTemplateInput {
  const part = sequence <= 24 ? "A" : sequence <= 30 ? "B" : "C";

  if (part === "A") {
    return {
      sequence,
      part,
      extractId: sequence <= 12 ? "listening-a-1" : "listening-a-2",
      type: "FILL_BLANK",
      options: null
    };
  }

  if (part === "B") {
    return {
      sequence,
      part,
      extractId: `listening-b-${sequence - 24}`,
      type: "MCQ",
      options: ["Option A", "Option B", "Option C"]
    };
  }

  return {
    sequence,
    part,
    extractId: sequence <= 36 ? "listening-c-1" : "listening-c-2",
    type: "MCQ",
    options: ["Option A", "Option B", "Option C"]
  };
}

export function buildQuestionTemplate(type: "LISTENING" | "READING"): Array<TestQuestionDto & { correctAnswer: string }> {
  return Array.from({ length: 42 }, (_, index) => {
    const sequence = index + 1;
    const meta =
      type === "READING" ? getReadingQuestionTemplate(sequence) : getListeningQuestionTemplate(sequence);

    return {
      id: `${type.toLowerCase()}-${sequence}`,
      sequence: meta.sequence,
      part: meta.part,
      extractId: meta.extractId,
      type: meta.type,
      content:
        meta.type === "FILL_BLANK"
          ? `Complete the sentence: The answer for question ${sequence} is [blank].`
          : `${type === "READING" ? "Reading" : "Listening"} question ${sequence}`,
      options: meta.options,
      explanation: "",
      points: 1,
      correctAnswer:
        type === "READING" && meta.part === "A" && sequence <= 6 && meta.type === "FILL_BLANK"
          ? "A"
          : meta.type === "FILL_BLANK"
            ? `answer-${sequence}`
            : meta.options?.[0] || "Option A"
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
  "Part C — Extract 2 (Q37–46)"
] as const;

export function buildDefaultListeningTracks() {
  return LISTENING_TRACK_LABELS.map((label, sortOrder) => ({
    clientId: `track-${sortOrder}`,
    sortOrder,
    label,
    assetId: "",
    asset: null
  }));
}

/** Candidate-facing listening question pages (prev/next navigation). */
export const LISTENING_QUESTION_PAGE_RANGES = [
  { start: 1, end: 12 },
  { start: 13, end: 24 },
  { start: 25, end: 30 },
  { start: 31, end: 36 },
  { start: 37, end: 46 }
] as const;

export const LISTENING_QUESTION_PAGE_COUNT = LISTENING_QUESTION_PAGE_RANGES.length;

export function getListeningQuestionPageRange(pageIndex: number) {
  return LISTENING_QUESTION_PAGE_RANGES[pageIndex] ?? null;
}

export function getListeningPageForQuestionSequence(sequence: number) {
  if (sequence <= 12) return 0;
  if (sequence <= 24) return 1;
  if (sequence <= 30) return 2;
  if (sequence <= 36) return 3;
  return 4;
}

export function getListeningPageForTrackIndex(trackIndex: number) {
  if (trackIndex <= 0) return 0;
  if (trackIndex === 1) return 1;
  if (trackIndex >= 2 && trackIndex <= 7) return 2;
  if (trackIndex === 8) return 3;
  return 4;
}

export function getPrimaryTrackIndexForListeningPage(pageIndex: number) {
  if (pageIndex <= 0) return 0;
  if (pageIndex === 1) return 1;
  if (pageIndex === 2) return 2;
  if (pageIndex === 3) return 8;
  return 9;
}

export function getQuestionsForListeningPage(questions: TestQuestionDto[], pageIndex: number) {
  const range = getListeningQuestionPageRange(pageIndex);
  if (!range) return [];
  return questions
    .filter((question) => question.sequence >= range.start && question.sequence <= range.end)
    .sort((left, right) => left.sequence - right.sequence);
}

export function getFirstQuestionIndexForListeningPage(questions: TestQuestionDto[], pageIndex: number) {
  const range = getListeningQuestionPageRange(pageIndex);
  if (!range) return -1;
  return questions.findIndex((question) => question.sequence === range.start);
}

export function getListeningTrackQuestionRange(trackIndex: number) {
  if (trackIndex === 0) return { start: 1, end: 12 };
  if (trackIndex === 1) return { start: 13, end: 24 };
  if (trackIndex >= 2 && trackIndex <= 7) {
    const sequence = 25 + (trackIndex - 2);
    return { start: sequence, end: sequence };
  }
  if (trackIndex === 8) return { start: 31, end: 36 };
  return { start: 37, end: 46 };
}

export function getQuestionsForListeningTrack(questions: TestQuestionDto[], trackIndex: number) {
  const { start, end } = getListeningTrackQuestionRange(trackIndex);
  return questions.filter((question) => question.sequence >= start && question.sequence <= end);
}

export function getFirstQuestionIndexForListeningTrack(questions: TestQuestionDto[], trackIndex: number) {
  const { start } = getListeningTrackQuestionRange(trackIndex);
  return questions.findIndex((question) => question.sequence === start);
}

export type PartExtractGroup<T extends { sequence: number; part: string; extractId?: string | null }> = {
  id: string;
  label: string;
  questionRange: string;
  questions: T[];
  trackSortOrder?: number;
};

export function getPartExtractGroups<T extends { sequence: number; part: string; extractId?: string | null }>(
  questions: T[],
  part: "A" | "B" | "C",
  testType: "READING" | "LISTENING"
): PartExtractGroup<T>[] {
  const partQuestions = questions
    .filter((question) => question.part === part)
    .sort((left, right) => left.sequence - right.sequence);

  const extractIds = [
    ...new Set(partQuestions.map((question) => question.extractId).filter(Boolean) as string[])
  ];

  const questionsPerExtract =
    testType === "READING" && part === "C"
      ? 8
      : testType === "READING" && part === "B"
        ? 1
        : testType === "LISTENING" && part === "A"
          ? 12
          : testType === "LISTENING" && part === "B"
            ? 1
            : testType === "LISTENING" && part === "C"
              ? 6
              : 0;

  const extractCount =
    testType === "READING" && part === "C"
      ? 2
      : testType === "READING" && part === "B"
        ? 6
        : testType === "LISTENING" && part === "A"
          ? 2
          : testType === "LISTENING" && part === "B"
            ? 6
            : testType === "LISTENING" && part === "C"
              ? 2
              : 0;

  const formatQuestionRange = (first?: number, last?: number) => {
    if (!first || !last) return "";
    return first === last ? `Q${first}` : `Q${first}–${last}`;
  };

  const groups =
    extractIds.length > 0
      ? extractIds.map((id, index) => {
          const extractQuestions = partQuestions.filter((question) => question.extractId === id);
          const first = extractQuestions[0]?.sequence;
          const last = extractQuestions[extractQuestions.length - 1]?.sequence;

          return {
            id,
            label: `Extract ${index + 1}`,
            questionRange: formatQuestionRange(first, last),
            questions: extractQuestions,
            trackSortOrder: resolveListeningTrackSortOrder(part, id, index)
          };
        })
      : Array.from({ length: extractCount }, (_, index) => {
          const extractQuestions = partQuestions.slice(
            index * questionsPerExtract,
            (index + 1) * questionsPerExtract
          );
          const first = extractQuestions[0]?.sequence;
          const last = extractQuestions[extractQuestions.length - 1]?.sequence;
          const id =
            testType === "READING" && part === "B"
              ? `reading-b-${index + 1}`
              : testType === "READING" && part === "C"
                ? index === 0
                  ? "reading-c-1"
                  : "reading-c-2"
                : testType === "LISTENING" && part === "A"
                  ? `listening-a-${index + 1}`
                  : testType === "LISTENING" && part === "B"
                    ? `listening-b-${index + 1}`
                    : testType === "LISTENING" && part === "C"
                      ? index === 0
                        ? "listening-c-1"
                        : "listening-c-2"
                      : `${part.toLowerCase()}-extract-${index + 1}`;

          return {
            id,
            label: `Extract ${index + 1}`,
            questionRange: formatQuestionRange(first, last),
            questions: extractQuestions,
            trackSortOrder: resolveListeningTrackSortOrder(part, id, index)
          };
        });

  return groups
    .filter((group) => group.questions.length > 0)
    .sort(
      (left, right) => (left.questions[0]?.sequence ?? 0) - (right.questions[0]?.sequence ?? 0)
    );
}

export function getPartCExtractGroups<T extends { sequence: number; part: string; extractId?: string | null }>(
  questions: T[],
  testType: "READING" | "LISTENING"
) {
  return getPartExtractGroups(questions, "C", testType);
}

export function getReadingPartBExtractGroups<T extends { sequence: number; part: string; extractId?: string | null }>(
  questions: T[]
) {
  return getPartExtractGroups(questions, "B", "READING");
}

export function getListeningPartAExtractGroups<T extends { sequence: number; part: string; extractId?: string | null }>(
  questions: T[]
) {
  return getPartExtractGroups(questions, "A", "LISTENING");
}

export function getListeningPartBExtractGroups<T extends { sequence: number; part: string; extractId?: string | null }>(
  questions: T[]
) {
  return getPartExtractGroups(questions, "B", "LISTENING");
}

export function getListeningPartCExtractGroups<T extends { sequence: number; part: string; extractId?: string | null }>(
  questions: T[]
) {
  return getPartExtractGroups(questions, "C", "LISTENING");
}

function resolveListeningTrackSortOrder(part: "A" | "B" | "C", extractId: string | undefined, index: number) {
  if (part === "A") {
    return extractId === "listening-a-2" ? 1 : 0;
  }
  if (part === "B") {
    if (extractId?.startsWith("listening-b-")) {
      return 2 + (Number(extractId.replace("listening-b-", "")) - 1);
    }
    return 2 + index;
  }
  if (part === "C") {
    return extractId === "listening-c-2" ? 9 : 8;
  }
  return undefined;
}
