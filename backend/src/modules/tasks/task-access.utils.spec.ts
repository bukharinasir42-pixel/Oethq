import { PlanTier } from "@prisma/client";
import { buildTaskLocks } from "./task-access.utils";

describe("task access utils", () => {
  it("keeps paid-plan day one resources open when quota allows", () => {
    const locks = buildTaskLocks({
      planTier: PlanTier.FOUNDATION,
      dayIndex: 1,
      readingLimit: 9,
      listeningLimit: 9,
      pastPaperLimit: 2,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    expect(locks).toEqual({
      readingLocked: false,
      listeningLocked: false,
      pastPaperLocked: false,
      lectureLocked: false,
      coreSkillsLocked: false,
      articleLocked: false,
      cheatSheetLocked: false
    });
  });

  it("unlocks day one lecture and reading test for starter but keeps core skills video and article text locked", () => {
    const day1Starter = buildTaskLocks({
      planTier: PlanTier.STARTER,
      dayIndex: 1,
      readingLimit: 0,
      listeningLimit: 0,
      pastPaperLimit: 0,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    expect(day1Starter.lectureLocked).toBe(false);
    expect(day1Starter.readingLocked).toBe(false);
    expect(day1Starter.listeningLocked).toBe(true);
    expect(day1Starter.coreSkillsLocked).toBe(true);
    expect(day1Starter.articleLocked).toBe(true);
    expect(day1Starter.cheatSheetLocked).toBe(true);
  });

  it("unlocks foundation lectures and articles through day 40 but assignments only through day 9", () => {
    const day40 = buildTaskLocks({
      planTier: PlanTier.FOUNDATION,
      dayIndex: 40,
      readingLimit: 5,
      listeningLimit: 5,
      pastPaperLimit: 2,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    const day10 = buildTaskLocks({
      planTier: PlanTier.FOUNDATION,
      dayIndex: 10,
      readingLimit: 5,
      listeningLimit: 5,
      pastPaperLimit: 2,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    expect(day40.lectureLocked).toBe(false);
    expect(day40.coreSkillsLocked).toBe(false);
    expect(day40.articleLocked).toBe(false);
    expect(day40.readingLocked).toBe(true);
    expect(day40.listeningLocked).toBe(true);

    const day9 = buildTaskLocks({
      planTier: PlanTier.FOUNDATION,
      dayIndex: 9,
      readingLimit: 5,
      listeningLimit: 5,
      pastPaperLimit: 2,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    expect(day9.readingLocked).toBe(false);
    expect(day9.listeningLocked).toBe(false);
    expect(day10.readingLocked).toBe(true);
    expect(day10.listeningLocked).toBe(true);
    expect(day10.lectureLocked).toBe(false);
    expect(day10.articleLocked).toBe(false);
  });

  it("unlocks accelerator lectures and articles through day 40 but assignments only through day 13", () => {
    const day40 = buildTaskLocks({
      planTier: PlanTier.ACCELERATOR,
      dayIndex: 40,
      readingLimit: 9,
      listeningLimit: 9,
      pastPaperLimit: 4,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    const day13 = buildTaskLocks({
      planTier: PlanTier.ACCELERATOR,
      dayIndex: 13,
      readingLimit: 9,
      listeningLimit: 9,
      pastPaperLimit: 4,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    const day14 = buildTaskLocks({
      planTier: PlanTier.ACCELERATOR,
      dayIndex: 14,
      readingLimit: 9,
      listeningLimit: 9,
      pastPaperLimit: 4,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    expect(day40.lectureLocked).toBe(false);
    expect(day40.articleLocked).toBe(false);
    expect(day40.readingLocked).toBe(true);
    expect(day40.listeningLocked).toBe(true);

    expect(day13.readingLocked).toBe(false);
    expect(day13.listeningLocked).toBe(false);
    expect(day14.readingLocked).toBe(true);
    expect(day14.listeningLocked).toBe(true);
    expect(day14.lectureLocked).toBe(false);
    expect(day14.articleLocked).toBe(false);
  });

  it("unlocks mastery lectures and articles through day 40 but assignments only through day 15", () => {
    const day40 = buildTaskLocks({
      planTier: PlanTier.MASTERY,
      dayIndex: 40,
      readingLimit: 9,
      listeningLimit: 9,
      pastPaperLimit: 10,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    const day15 = buildTaskLocks({
      planTier: PlanTier.MASTERY,
      dayIndex: 15,
      readingLimit: 9,
      listeningLimit: 9,
      pastPaperLimit: 10,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    const day16 = buildTaskLocks({
      planTier: PlanTier.MASTERY,
      dayIndex: 16,
      readingLimit: 9,
      listeningLimit: 9,
      pastPaperLimit: 10,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    expect(day40.lectureLocked).toBe(false);
    expect(day40.articleLocked).toBe(false);
    expect(day40.readingLocked).toBe(true);
    expect(day40.listeningLocked).toBe(true);

    expect(day15.readingLocked).toBe(false);
    expect(day15.listeningLocked).toBe(false);
    expect(day16.readingLocked).toBe(true);
    expect(day16.listeningLocked).toBe(true);
    expect(day16.lectureLocked).toBe(false);
    expect(day16.articleLocked).toBe(false);
  });

  it("locks starter users after day one and blocks quota overflow", () => {
    const starterLocks = buildTaskLocks({
      planTier: PlanTier.STARTER,
      dayIndex: 2,
      readingLimit: 0,
      listeningLimit: 0,
      pastPaperLimit: 0,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    const quotaLocks = buildTaskLocks({
      planTier: PlanTier.FOUNDATION,
      dayIndex: 10,
      readingLimit: 9,
      listeningLimit: 9,
      pastPaperLimit: 2,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    expect(starterLocks.lectureLocked).toBe(true);
    expect(starterLocks.coreSkillsLocked).toBe(true);
    expect(starterLocks.articleLocked).toBe(true);
    expect(starterLocks.cheatSheetLocked).toBe(true);
    expect(starterLocks.readingLocked).toBe(true);
    expect(quotaLocks.readingLocked).toBe(true);
    expect(quotaLocks.listeningLocked).toBe(true);
    expect(quotaLocks.pastPaperLocked).toBe(true);
  });
});
