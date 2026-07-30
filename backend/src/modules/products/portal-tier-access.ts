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

/** Does ANY owned skill unlock `module`? (for cross-skill content like cheat sheets) */
export function anySkillUnlocks(
  skillAccess: Record<string, SkillAccessLite>,
  module: ModuleKey
): boolean {
  return Object.values(skillAccess).some((a) => moduleUnlockedForTier(a, module));
}
