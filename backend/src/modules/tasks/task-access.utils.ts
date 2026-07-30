import { PlanTier } from "@prisma/client";

/** Foundation, Accelerator & Mastery: lectures/articles on curriculum days 1–40. */
export const PAID_CONTENT_DAY_LIMIT = 40;
export const FOUNDATION_READING_DAY_LIMIT = 9;
export const FOUNDATION_LISTENING_DAY_LIMIT = 9;
export const ACCELERATOR_READING_DAY_LIMIT = 13;
export const ACCELERATOR_LISTENING_DAY_LIMIT = 13;
export const MASTERY_READING_DAY_LIMIT = 15;
export const MASTERY_LISTENING_DAY_LIMIT = 15;

type TaskAccessInput = {
  planTier: PlanTier;
  dayIndex: number;
  readingLimit: number;
  listeningLimit: number;
  pastPaperLimit: number;
  hasReadingTest: boolean;
  hasListeningTest: boolean;
  hasPastPaper: boolean;
};

function resolveAssignmentLimits(input: TaskAccessInput) {
  switch (input.planTier) {
    case PlanTier.FOUNDATION:
      return {
        readingLimit: FOUNDATION_READING_DAY_LIMIT,
        listeningLimit: FOUNDATION_LISTENING_DAY_LIMIT
      };
    case PlanTier.ACCELERATOR:
      return {
        readingLimit: ACCELERATOR_READING_DAY_LIMIT,
        listeningLimit: ACCELERATOR_LISTENING_DAY_LIMIT
      };
    case PlanTier.MASTERY:
      return {
        readingLimit: MASTERY_READING_DAY_LIMIT,
        listeningLimit: MASTERY_LISTENING_DAY_LIMIT
      };
    default:
      return {
        readingLimit: input.readingLimit,
        listeningLimit: input.listeningLimit
      };
  }
}

function isBeyondPaidContentDay(planTier: PlanTier, dayIndex: number) {
  if (
    planTier === PlanTier.FOUNDATION ||
    planTier === PlanTier.ACCELERATOR ||
    planTier === PlanTier.MASTERY
  ) {
    return dayIndex > PAID_CONTENT_DAY_LIMIT;
  }
  return false;
}

export function buildTaskLocks(input: TaskAccessInput) {
  const isStarter = input.planTier === PlanTier.STARTER;
  const beyondPaidContentDay = isBeyondPaidContentDay(input.planTier, input.dayIndex);
  const { readingLimit, listeningLimit } = resolveAssignmentLimits(input);

  return {
    // Free trial (STARTER): Day 1 only — one lecture, one reading test, one
    // listening test and one core-skill exercise. Everything else → upgrade.
    readingLocked: isStarter
      ? input.dayIndex > 1 || !input.hasReadingTest
      : !input.hasReadingTest || input.dayIndex > readingLimit,
    listeningLocked: isStarter
      ? input.dayIndex > 1 || !input.hasListeningTest
      : !input.hasListeningTest || input.dayIndex > listeningLimit,
    pastPaperLocked: isStarter || !input.hasPastPaper || input.dayIndex > input.pastPaperLimit,
    lectureLocked: isStarter ? input.dayIndex > 1 : beyondPaidContentDay,
    coreSkillsLocked: isStarter ? input.dayIndex > 1 : beyondPaidContentDay,
    articleLocked: isStarter || beyondPaidContentDay,
    cheatSheetLocked: isStarter || beyondPaidContentDay
  };
}
