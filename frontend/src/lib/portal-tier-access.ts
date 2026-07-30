/**
 * portal-tier-access.ts — single source of truth for which portal modules each
 * single-skill course TIER unlocks. Derived from the course landing feature lists
 * (Foundation / Momentum / Precision / Mega). Used by the dashboard tiles, the
 * sidebar course groups and the module pages so "mentioned unlocked, unmentioned
 * locked" holds for every tier.
 *
 * Complete Course (tierRank 99) unlocks everything. Free-trial/complete callers
 * bypass this entirely (they pass fullAccess). Modules with no entry for a skill
 * are not tier-gated (unlocked once the skill is owned).
 */
import type { SkillAccess } from "@/lib/products-api";

export type ModuleKey =
  | "lectures" | "tests" | "past-papers" | "cheat-sheets"
  | "part-a-core" | "part-bc-core" | "spellings" | "part-c-podcasts" | "writing";

// Minimum tier rank (1 Foundation · 2 Momentum · 3 Precision · 4 Mega) per module.
const MIN_TIER: Record<string, Partial<Record<ModuleKey, number>>> = {
  READING: {
    lectures: 1, tests: 1, "past-papers": 1, "part-a-core": 1,
    "part-bc-core": 3,   // Part C articles — Precision
    "cheat-sheets": 3    // cheat sheets + how-to lectures — Precision
  },
  LISTENING: {
    lectures: 1, tests: 1, "past-papers": 1,
    "part-bc-core": 3,
    spellings: 3,        // daily spelling sessions — Precision
    "part-c-podcasts": 3, // daily podcasts — Precision
    "cheat-sheets": 3
  },
  WRITING: {
    lectures: 1, writing: 1,
    "cheat-sheets": 3
  }
};

/** Does this owned-skill access unlock `module`? (null access = skill not owned.) */
export function moduleUnlockedForTier(access: SkillAccess | null | undefined, module: ModuleKey): boolean {
  if (!access) return false;
  if (access.tierRank >= 99) return true; // Complete Course
  const min = MIN_TIER[access.skill]?.[module];
  if (min == null) return true;           // not tier-restricted
  return access.tierRank >= min;
}

/** The tier rank at which `module` unlocks for `skill` (for upgrade copy). */
export function moduleMinTier(skill: string, module: ModuleKey): number | null {
  return MIN_TIER[skill]?.[module] ?? null;
}

/**
 * Modules the free trial (STARTER) previews, per the Tier 0 card on the Complete
 * Course page: one lecture, one Reading + one Listening mock, one day of live
 * spelling, one podcast episode — and explicitly "No past papers, cheat sheets,
 * live drills or Pass Predictor".
 *
 * A trial holds no entitlements, so tier rank cannot express this; without an
 * explicit list the dashboard rendered every tile as open and the student hit a
 * 403 on click.
 */
const TRIAL_MODULES: ReadonlySet<ModuleKey> = new Set<ModuleKey>([
  "lectures", "tests", "spellings", "part-c-podcasts"
]);

/** Does the free trial preview `module`? */
export function moduleUnlockedForTrial(module: ModuleKey): boolean {
  return TRIAL_MODULES.has(module);
}
