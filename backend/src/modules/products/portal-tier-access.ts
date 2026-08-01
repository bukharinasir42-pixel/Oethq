/**
 * portal-tier-access.ts (backend) — server-side mirror of the frontend
 * `frontend/src/lib/portal-tier-access.ts` gate. Single source of truth for
 * which portal modules each single-skill course TIER unlocks, so premium
 * daily content cannot be fetched directly by under-tier callers.
 *
 * Complete Course (tierRank 99) unlocks everything. Modules with no entry for a
 * skill are not tier-gated (unlocked once the skill is owned).
 *
 * NOTE: `spellings` and `part-a-core` (the Part A drill) are intentionally NOT
 * enforced here — the free trial grants them as open "practice surface" content
 * (see subscriptions/trial-access.ts). Gating them server-side would lock out
 * trial users, so they remain frontend-gated by design.
 */
export type ModuleKey =
  | "lectures" | "tests" | "past-papers" | "cheat-sheets"
  | "part-a-core" | "part-bc-core" | "spellings" | "part-c-podcasts" | "writing";

// Minimum tier rank (1 Foundation · 2 Momentum · 3 Precision · 4 Mega) per module.
// Kept in lockstep with the frontend MIN_TIER map.
const MIN_TIER: Record<string, Partial<Record<ModuleKey, number>>> = {
  READING: {
    lectures: 1, tests: 1, "past-papers": 1, "part-a-core": 1,
    "part-bc-core": 3,   // Part C articles — Precision
    "cheat-sheets": 3    // cheat sheets + how-to lectures — Precision
  },
  LISTENING: {
    lectures: 1, tests: 1, "past-papers": 1,
    "part-bc-core": 3,
    spellings: 3,
    "part-c-podcasts": 3, // daily podcasts — Precision
    "cheat-sheets": 3
  },
  WRITING: {
    lectures: 1, writing: 1,
    "cheat-sheets": 3
  }
};

/** Minimal shape we need from ProductsService.getOwnership().skillAccess entries. */
export type SkillAccessLite = { skill: string; tierRank: number };

/** Does this owned-skill access unlock `module`? (null access = skill not owned.) */
export function moduleUnlockedForTier(access: SkillAccessLite | null | undefined, module: ModuleKey): boolean {
  if (!access) return false;
  if (access.tierRank >= 99) return true; // Complete Course
  const min = MIN_TIER[access.skill]?.[module];
  if (min == null) return true;           // not tier-restricted for this skill
  return access.tierRank >= min;
}

/** Does the given skill's access unlock `module`? */
export function skillModuleUnlocked(
  skillAccess: Record<string, SkillAccessLite>,
  skill: string,
  module: ModuleKey
): boolean {
  return moduleUnlockedForTier(skillAccess[skill], module);
}

/** The skill that owns each rotating daily-content module. */
export const MODULE_SKILL: Record<string, string> = {
  "part-a-core": "READING",
  "part-bc-core": "READING",
  spellings: "LISTENING",
  "part-c-podcasts": "LISTENING"
};

/**
 * The only rotating modules the free trial previews, and only on Day 1.
 *
 * Podcasts and Part B/C articles are deliberately absent: they are paid daily
 * content. Previously any module passed the trial check, which handed a trial
 * user the podcast and left `/skill-drills/of-day?module=part-bc-core` open to
 * them as well.
 */
const TRIAL_DAY_ONE_MODULES: ReadonlySet<ModuleKey> = new Set<ModuleKey>(["spellings", "part-a-core"]);

/**
 * Gate for the rotating daily content (spelling, Part A drill, Part B/C article,
 * podcast): the owner's tier unlocks it, or the caller is on Day 1 of the free
 * trial AND the module is one the trial previews. Day 2 onward the trial is
 * locked out entirely — it samples one of each, not one per day for a week.
 */
export function dailyContentUnlocked(
  skillAccess: Record<string, SkillAccessLite>,
  module: ModuleKey,
  trial: { isTrial: boolean; trialDay: number | null }
): boolean {
  const skill = MODULE_SKILL[module];
  if (skill && skillModuleUnlocked(skillAccess, skill, module)) return true;
  return trial.isTrial && trial.trialDay === 1 && TRIAL_DAY_ONE_MODULES.has(module);
}

/** Does ANY owned skill unlock `module`? (for cross-skill content like cheat sheets) */
export function anySkillUnlocks(
  skillAccess: Record<string, SkillAccessLite>,
  module: ModuleKey
): boolean {
  return Object.values(skillAccess).some((a) => moduleUnlockedForTier(a, module));
}
