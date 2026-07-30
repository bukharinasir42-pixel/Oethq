import { AttemptSection, QuestionType, TestType } from "@prisma/client";

type ScoreableQuestion = {
  id: string;
  part: "A" | "B" | "C";
  sequence: number;
  type: QuestionType;
  correctAnswer: string;
  points: number;
};

function isCaseSensitiveAnswer(question: ScoreableQuestion, testType: TestType) {
  return (
    testType === TestType.READING &&
    question.type === QuestionType.FILL_BLANK &&
    question.part === "A" &&
    question.sequence >= 8 &&
    question.sequence <= 20
  );
}

function normalizeAnswer(value: string, caseSensitive: boolean) {
  const trimmed = value.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

export function buildAttemptTiming(
  type: TestType,
  timerDuration: number,
  partATimer?: number,
  startAt: Date = new Date()
) {
  const expiresAt = new Date(startAt.getTime() + timerDuration * 60 * 1000);

  if (type === TestType.READING) {
    const readingPartA = partATimer ?? 15;
    return {
      section: AttemptSection.READING_PART_A,
      expiresAt,
      sectionExpiresAt: new Date(startAt.getTime() + readingPartA * 60 * 1000),
      timeRemainingSeconds: timerDuration * 60
    };
  }

  return {
    section: AttemptSection.LISTENING,
    expiresAt,
    sectionExpiresAt: expiresAt,
    timeRemainingSeconds: timerDuration * 60
  };
}

/** Wall-clock deadline for Reading Part A (from attempt start). */
export function getReadingPartADeadline(startedAt: Date, partATimer?: number | null) {
  const minutes = partATimer ?? 15;
  return new Date(startedAt.getTime() + minutes * 60 * 1000);
}

/** True once the Part A window has ended — answers and navigation must stay locked. */
export function isReadingPartAExpired(
  startedAt: Date,
  partATimer?: number | null,
  now: Date = new Date()
) {
  return now.getTime() >= getReadingPartADeadline(startedAt, partATimer).getTime();
}

/** Reading Parts B & C shared window — defaults to 45 minutes. */
export function resolveReadingPartBCMinutes(partBCTimer?: number | null) {
  return typeof partBCTimer === "number" && partBCTimer > 0 ? partBCTimer : 45;
}

/**
 * Absolute deadline for the shared Parts B & C timer:
 * Part A end + 45 minutes (not "now + 45", so late transitions don't grant extra time).
 */
export function getReadingPartBCDeadline(
  startedAt: Date,
  partATimer?: number | null,
  partBCTimer?: number | null
) {
  const partAEnd = getReadingPartADeadline(startedAt, partATimer);
  return new Date(partAEnd.getTime() + resolveReadingPartBCMinutes(partBCTimer) * 60 * 1000);
}

/** @deprecated Prefer getReadingPartBCDeadline for reading attempts. */
export function buildReadingPartBCSectionExpiry(partBCTimer?: number | null, from: Date = new Date()) {
  return new Date(from.getTime() + resolveReadingPartBCMinutes(partBCTimer) * 60 * 1000);
}

export function scoreAttempt(
  questions: ScoreableQuestion[],
  answers: Record<string, string>,
  testType: TestType = TestType.READING
) {
  let score = 0;
  let partAScore = 0;
  let partBScore = 0;
  let partCScore = 0;

  questions.forEach((question) => {
    const rawResponse = answers[question.id];
    if (!rawResponse) {
      return;
    }

    const caseSensitive = isCaseSensitiveAnswer(question, testType);
    const response = normalizeAnswer(rawResponse, caseSensitive);
    const expected = normalizeAnswer(question.correctAnswer, caseSensitive);
    const isCorrect = response === expected;

    if (!isCorrect) {
      return;
    }

    score += question.points;

    switch (question.part) {
      case "A":
        partAScore += question.points;
        break;
      case "B":
        partBScore += question.points;
        break;
      case "C":
        partCScore += question.points;
        break;
      default: {
        const exhaustiveCheck: never = question.part;
        return exhaustiveCheck;
      }
    }
  });

  return {
    score,
    partAScore,
    partBScore,
    partCScore,
    answeredCount: Object.values(answers).filter(Boolean).length
  };
}
