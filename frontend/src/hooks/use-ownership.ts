"use client";

import { useEffect, useState } from "react";
import { productsApi, type OwnedEntitlement } from "@/lib/products-api";
import { getToken } from "@/lib/api";

export type SkillKey = "READING" | "LISTENING" | "WRITING" | "SPEAKING";

type OwnershipState = {
  loading: boolean;
  owned: OwnedEntitlement[];
  ownedSkills: SkillKey[];
  entitlementKeys: string[];
  /** True once loaded; use to avoid flashing locks before data arrives. */
  loaded: boolean;
};

/**
 * The signed-in user's product/skill ownership (union of all active entitlements
 * + an active Complete Course subscription). Drives per-skill portal locking.
 */
export function useOwnership(): OwnershipState & { ownsSkill: (s: SkillKey) => boolean } {
  const [state, setState] = useState<OwnershipState>({
    loading: true, loaded: false, owned: [], ownedSkills: [], entitlementKeys: []
  });

  useEffect(() => {
    if (!getToken()) {
      setState({ loading: false, loaded: true, owned: [], ownedSkills: [], entitlementKeys: [] });
      return;
    }
    let active = true;
    productsApi.ownership()
      .then((o) => {
        if (!active) return;
        setState({
          loading: false,
          loaded: true,
          owned: o.owned,
          ownedSkills: (o.ownedSkills as SkillKey[]) ?? [],
          entitlementKeys: o.entitlementKeys
        });
      })
      .catch(() => { if (active) setState((s) => ({ ...s, loading: false, loaded: true })); });
    return () => { active = false; };
  }, []);

  return {
    ...state,
    ownsSkill: (s: SkillKey) => state.ownedSkills.includes(s)
  };
}
