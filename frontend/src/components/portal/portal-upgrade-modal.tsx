"use client";

/**
 * PortalUpgradeModal — the upgrade prompt for a locked portal item. Everyone
 * (free-trial included) now sees the unified PlansUpgradeModal: the clicked
 * skill's four course tiers first, then the other skills' tiers, then the
 * Complete Course tiers. The old clearance-page modal is no longer used here.
 */
import { PlansUpgradeModal } from "@/components/portal/plans-upgrade-modal";
import type { SkillKey } from "@/hooks/use-ownership";

type Props = {
  isFreeTrial: boolean;
  skill: SkillKey | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function PortalUpgradeModal({ skill, open, onOpenChange }: Props) {
  return (
    <PlansUpgradeModal
      open={open}
      onOpenChange={onOpenChange}
      focusSkill={open && skill && skill !== "SPEAKING" ? skill : null}
    />
  );
}
