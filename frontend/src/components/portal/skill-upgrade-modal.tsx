"use client";

/**
 * SkillUpgradeModal — kept as a thin wrapper for the many call sites that open an
 * upgrade popup for a locked skill. It now renders the unified PlansUpgradeModal,
 * which shows the clicked skill's four course tiers first, then the other skills'
 * tiers, then the Complete Course tiers (replacing the old clearance-page hop).
 */
import { PlansUpgradeModal } from "@/components/portal/plans-upgrade-modal";
import type { SkillKey } from "@/hooks/use-ownership";

const SKILL_LABEL: Record<SkillKey, string> = {
  READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking"
};

export function SkillUpgradeModal({
  skill, open, onOpenChange
}: { skill: SkillKey | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <PlansUpgradeModal
      open={open}
      onOpenChange={onOpenChange}
      focusSkill={skill && skill !== "SPEAKING" ? skill : null}
      title={skill && skill !== "SPEAKING" ? `Unlock ${SKILL_LABEL[skill]} — choose a plan` : "Choose your plan"}
    />
  );
}
