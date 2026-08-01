import { dailyContentUnlocked, moduleUnlockedForTier, type SkillAccessLite } from "./portal-tier-access";

const NO_TRIAL = { isTrial: false, trialDay: null };
const trialOn = (trialDay: number) => ({ isTrial: true, trialDay });

const access = (skill: string, tierRank: number): Record<string, SkillAccessLite> => ({
  [skill]: { skill, tierRank }
});

describe("portal tier access", () => {
  describe("moduleUnlockedForTier", () => {
    it("locks a module below its minimum tier and unlocks it at or above", () => {
      // Listening podcasts require Precision (rank 3).
      expect(moduleUnlockedForTier({ skill: "LISTENING", tierRank: 2 }, "part-c-podcasts")).toBe(false);
      expect(moduleUnlockedForTier({ skill: "LISTENING", tierRank: 3 }, "part-c-podcasts")).toBe(true);
      expect(moduleUnlockedForTier({ skill: "LISTENING", tierRank: 4 }, "part-c-podcasts")).toBe(true);
    });

    it("unlocks everything for the Complete Material and nothing for an unowned skill", () => {
      expect(moduleUnlockedForTier({ skill: "LISTENING", tierRank: 99 }, "part-c-podcasts")).toBe(true);
      expect(moduleUnlockedForTier(null, "part-c-podcasts")).toBe(false);
    });
  });

  describe("dailyContentUnlocked", () => {
    it("gives the free trial its Day-1 sample and locks it from Day 2", () => {
      // One of each, not one per day for the 7-day window.
      for (const module of ["spellings", "part-a-core"] as const) {
        expect(dailyContentUnlocked({}, module, trialOn(1))).toBe(true);
        expect(dailyContentUnlocked({}, module, trialOn(2))).toBe(false);
        expect(dailyContentUnlocked({}, module, trialOn(7))).toBe(false);
      }
    });

    it("keeps podcasts and Part B/C articles closed to the trial on every day", () => {
      // Paid daily content. Before, ANY module passed the trial check, which also
      // left /skill-drills/of-day?module=part-bc-core open to trial users.
      for (const module of ["part-c-podcasts", "part-bc-core"] as const) {
        expect(dailyContentUnlocked({}, module, trialOn(1))).toBe(false);
        expect(dailyContentUnlocked({}, module, trialOn(2))).toBe(false);
      }
      // Still open to a paying Precision buyer.
      expect(dailyContentUnlocked(access("LISTENING", 3), "part-c-podcasts", NO_TRIAL)).toBe(true);
    });

    it("locks daily content for a signed-in user with no plan and no trial", () => {
      expect(dailyContentUnlocked({}, "spellings", NO_TRIAL)).toBe(false);
      expect(dailyContentUnlocked({}, "part-a-core", NO_TRIAL)).toBe(false);
    });

    it("keeps spelling behind Precision for paid single-skill buyers", () => {
      // Foundation (1) and Momentum (2) must not reach the 1,938-term bank.
      expect(dailyContentUnlocked(access("LISTENING", 1), "spellings", NO_TRIAL)).toBe(false);
      expect(dailyContentUnlocked(access("LISTENING", 2), "spellings", NO_TRIAL)).toBe(false);
      expect(dailyContentUnlocked(access("LISTENING", 3), "spellings", NO_TRIAL)).toBe(true);
    });

    it("gives the Part A drill to every Reading tier, since its minimum is tier 1", () => {
      expect(dailyContentUnlocked(access("READING", 1), "part-a-core", NO_TRIAL)).toBe(true);
      // ...but Part B/C articles still require Precision.
      expect(dailyContentUnlocked(access("READING", 1), "part-bc-core", NO_TRIAL)).toBe(false);
      expect(dailyContentUnlocked(access("READING", 3), "part-bc-core", NO_TRIAL)).toBe(true);
    });

    it("does not let one skill's tier unlock the other skill's daily content", () => {
      // Owning Reading at Mega must not open Listening spelling.
      expect(dailyContentUnlocked(access("READING", 4), "spellings", NO_TRIAL)).toBe(false);
    });
  });
});
