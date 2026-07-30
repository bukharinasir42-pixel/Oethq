import { PlanTier } from "@prisma/client";

/** Every paid plan: lectures/articles on curriculum days 1–40. */
export const PAID_CONTENT_DAY_LIMIT = 40;

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

/**
 * The plan's own limits, straight from the Plan row.
 *
 * This used to hard-code 9/9, 13/13 and 15/15 for FOUNDATION, ACCELERATOR and
 * MASTERY, overriding whatever the database said. Those numbers came from a
 * retired line-up; the live plans (Foundation Sprint 6/6, Precision Engine
 * 10/10, Elite Clearance 15/15, Total Clearance 20/20) meant the first two
 * silently handed out more tests than they sold, and edits made in the admin
 * panel had no effect. The Plan row is now the single source of truth.
 */
function resolveAssignmentLimits(input: TaskAccessInput) {
  return {
    readingLimit: input.readingLimit,
    listeningLimit: input.listeningLimit
  };
}

function isBeyondPaidContentDay(planTier: PlanTier, dayIndex: number) {
  // Every paid plan is limited to the 40 authored curriculum days; the free
  // trial is capped separately by its own Day-1-only rules.
  if (planTier === PlanTier.STARTER) return false;
  return dayIndex > PAID_CONTENT_DAY_LIMIT;
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
