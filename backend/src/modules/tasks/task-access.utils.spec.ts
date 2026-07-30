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
    // NOTE (pre-existing failure, unchanged by the plan-limit work): buildTaskLocks
    // currently unlocks BOTH the Day-1 listening mock and the Day-1 core-skills
    // item for a trial user, so these two expectations fail on main. The Tier 0
    // card advertises a Listening mock (so `listeningLocked: false` looks correct)
    // but also says "no live drills" (so core skills is genuinely ambiguous).
    // Left as-is deliberately: settling it changes what the free trial includes,
    // which is a product decision, not a refactor.
    expect(day1Starter.listeningLocked).toBe(true);
    expect(day1Starter.coreSkillsLocked).toBe(true);
    expect(day1Starter.articleLocked).toBe(true);
    expect(day1Starter.cheatSheetLocked).toBe(true);
  });

  // Assignment limits now come from the Plan row rather than hard-coded per-tier
  // constants, so the boundary under test is whatever `readingLimit` says. These
  // are the live plans: Foundation Sprint 6/6, Precision Engine 10/10,
  // Elite Clearance 15/15, Total Clearance 20/20.
  const LIVE_PLANS = [
    { name: "Foundation Sprint", tier: PlanTier.FOUNDATION, limit: 6, pastPapers: 2 },
    { name: "Precision Engine", tier: PlanTier.ACCELERATOR, limit: 10, pastPapers: 3 },
    { name: "Elite Clearance", tier: PlanTier.MASTERY, limit: 15, pastPapers: 6 },
    { name: "Total Clearance", tier: PlanTier.CUSTOM, limit: 20, pastPapers: 10 }
  ];

  it.each(LIVE_PLANS)(
    "$name unlocks lectures/articles through day 40 but assignments only through its own limit",
    ({ tier, limit, pastPapers }) => {
      const at = (dayIndex: number) =>
        buildTaskLocks({
          planTier: tier,
          dayIndex,
          readingLimit: limit,
          listeningLimit: limit,
          pastPaperLimit: pastPapers,
          hasReadingTest: true,
          hasListeningTest: true,
          hasPastPaper: true
        });

      // The last included day is open, the next one is not.
      expect(at(limit).readingLocked).toBe(false);
      expect(at(limit).listeningLocked).toBe(false);
      expect(at(limit + 1).readingLocked).toBe(true);
      expect(at(limit + 1).listeningLocked).toBe(true);

      // Lectures and articles stay open across all 40 curriculum days regardless.
      const day40 = at(40);
      expect(day40.lectureLocked).toBe(false);
      expect(day40.coreSkillsLocked).toBe(false);
      expect(day40.articleLocked).toBe(false);
    }
  );

  it("no longer overrides the plan's limits with retired per-tier constants", () => {
    // Foundation Sprint sells 6+6. Before, FOUNDATION was pinned to 9 in code, so
    // day 9 came back unlocked no matter what the Plan row said.
    const day9 = buildTaskLocks({
      planTier: PlanTier.FOUNDATION,
      dayIndex: 9,
      readingLimit: 6,
      listeningLimit: 6,
      pastPaperLimit: 2,
      hasReadingTest: true,
      hasListeningTest: true,
      hasPastPaper: true
    });

    expect(day9.readingLocked).toBe(true);
    expect(day9.listeningLocked).toBe(true);
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
