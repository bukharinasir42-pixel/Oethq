"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { hasPastPaperPortalAccess } from "@/lib/portal-past-paper-utils";
import { productsApi, type Ownership } from "@/lib/products-api";
import type { SkillKey } from "@/hooks/use-ownership";
import type { PlanDto } from "@/lib/types";

type SubscriptionStatusDto = {
  status: string;
  plan?: PlanDto | null;
  /** ISO start date — used to derive which day of the free trial the user is on. */
  startDate?: string | null;
  expiresInDays?: number;
  requiresPlanActivation?: boolean;
  activationUrl?: string | null;
  accessGranted?: boolean;
  accessExpired?: boolean;
};

export function usePortalPlanAccess() {
  const { token, profile } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [ownership, setOwnership] = useState<Ownership | null>(null);
  const [loading, setLoading] = useState(true);
  // `loaded` is true ONLY after a real fetch has resolved for the current user.
  // Consumers must gate access decisions on this (not `loading`), because on a
  // hard page load `loading` briefly reads false while the session is still
  // resolving the token — which would otherwise trip premature redirects.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token || !profile) {
      setSubscription(null);
      setOwnership(null);
      setLoading(false);
      setLoaded(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoaded(false);

    void Promise.all([
      apiFetch<SubscriptionStatusDto>(`/subscriptions/status?userId=${encodeURIComponent(profile.id)}`, { token })
        .catch(() => null),
      productsApi.ownership().catch(() => null)
    ])
      .then(([sub, own]) => {
        if (cancelled) return;
        setSubscription(sub);
        setOwnership(own);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile, token]);

  const planTier = subscription?.plan?.tier ?? null;
  const pastPaperLimit = subscription?.plan?.pastPaperLimit ?? 0;

  const ownedSkills = (ownership?.ownedSkills as SkillKey[]) ?? [];
  const entitlementKeys = ownership?.entitlementKeys ?? [];
  const skillAccess = ownership?.skillAccess ?? {};
  // Pass Predictor is unlocked at Precision+ (or any Complete Course).
  const passPredictor = Boolean(ownership?.passPredictor);
  // A standalone/add-on product entitlement (anything other than the Complete
  // Course, which is derived from the subscription).
  const hasProductEntitlement = entitlementKeys.some((k) => k !== "complete");

  const requiresPlanActivation = Boolean(subscription?.requiresPlanActivation);
  const accessExpired =
    subscription?.accessExpired === true ||
    subscription?.status === "EXPIRED" ||
    ((subscription?.status === "ACTIVE" || subscription?.status === "TRIAL") &&
      (subscription.expiresInDays ?? 0) <= 0 &&
      Boolean(subscription.plan) &&
      !requiresPlanActivation);
  const subscriptionAccessGranted =
    subscription?.accessGranted === true ||
    ((subscription?.expiresInDays ?? 0) > 0 &&
      (subscription?.status === "ACTIVE" || subscription?.status === "TRIAL") &&
      !accessExpired);

  // Portal access is granted by an active subscription OR any owned product.
  const accessGranted = Boolean(subscriptionAccessGranted) || hasProductEntitlement;

  // Effective access window = the LATEST of everything that actually grants access:
  // an active subscription's remaining days AND every active course entitlement's
  // remaining days. Fixes the bug where a course student (e.g. 60-day Reading
  // Precision) whose free trial has lapsed saw the trial's "7 days" in the header.
  const DAY_MS = 86_400_000;
  const nowMs = Date.now();
  const entDaysLeft = (ownership?.owned ?? [])
    .filter((o) => o.entitlementKey !== "complete" && o.endDate)
    .map((o) => Math.ceil((new Date(o.endDate as string).getTime() - nowMs) / DAY_MS))
    .filter((d) => d > 0);
  const subDaysLeft = subscriptionAccessGranted ? (subscription?.expiresInDays ?? null) : null;
  const daysCandidates = [...entDaysLeft, ...(subDaysLeft != null && subDaysLeft > 0 ? [subDaysLeft] : [])];
  // null when the user has no active dated access (or an untimed/unlimited entitlement).
  const hasUnlimitedEnt = (ownership?.owned ?? []).some((o) => o.entitlementKey !== "complete" && o.endDate == null);
  const accessDaysLeft: number | null = hasUnlimitedEnt
    ? null
    : daysCandidates.length
      ? Math.max(...daysCandidates)
      : subDaysLeft ?? null;

  // The "Complete Course experience" = cohort live classes + the daily study-plan
  // journey. Granted by any active subscription (a paid Complete plan OR a free
  // trial preview). Standalone-only buyers (no active subscription) DON'T get it,
  // so cohort + study plan lock for them. See standalone-vs-complete-portal-scope.
  const completeExperienceAccess = Boolean(subscriptionAccessGranted);
  // On the free trial (STARTER) rather than a paid plan. The trial previews the
  // cohort + study plan but only a named subset of modules, so callers must not
  // treat it as full access — see moduleUnlockedForTrial.
  //
  // `hasProductEntitlement` has to be part of this. Buying a single-skill course
  // creates an entitlement and does NOT clear the STARTER subscription created at
  // signup, so testing the plan tier alone reported "free trial" for students who
  // had paid — and the trial's Day-1-only module list then locked their content
  // at the next UTC midnight. Mirrors the server's resolveTrialAccess.
  const isFreeTrial =
    Boolean(subscriptionAccessGranted) && planTier === "STARTER" && !hasProductEntitlement;
  // 1-based trial day by CALENDAR date, matching the server's resolveTrialAccess.
  // The rotating daily modules (spelling, podcast, Part A drill) are Day-1 only,
  // so the tiles must know the day or they render open onto a 403 on day 2.
  const trialDay: number | null = (() => {
    if (!isFreeTrial) return null;
    const raw = subscription?.startDate;
    if (!raw) return 1; // not yet activated → still Day 1
    const start = new Date(raw);
    if (Number.isNaN(start.getTime())) return 1;
    const midnight = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.floor((midnight(new Date(nowMs)) - midnight(start)) / DAY_MS) + 1;
  })();
  // Owns the paid Complete Course specifically (not just a free-trial preview).
  const hasCompleteCourse =
    (Boolean(subscriptionAccessGranted) && planTier !== null && planTier !== "STARTER") ||
    entitlementKeys.includes("complete");

  // Past papers nav: existing Complete-plan rule OR owning a course that includes
  // Reading or Listening (both include past papers).
  const showPastPapersNav =
    hasPastPaperPortalAccess(planTier, pastPaperLimit) ||
    ownedSkills.includes("READING") ||
    ownedSkills.includes("LISTENING");

  return {
    subscription,
    planTier,
    pastPaperLimit,
    ownedSkills,
    entitlementKeys,
    skillAccess,
    passPredictor,
    hasProductEntitlement,
    ownsSkill: (s: SkillKey) => ownedSkills.includes(s),
    skillTier: (s: SkillKey) => skillAccess[s] ?? null,
    // Effective past-paper COUNT allowance for a skill = the larger of the
    // Complete-plan limit and that skill's owned tier limit. Matches the
    // server-side cap in tests.service#getSkillPastPaperLimit.
    pastPaperLimitForSkill: (s: SkillKey) => Math.max(pastPaperLimit, skillAccess[s]?.pastPaperLimit ?? 0),
    showPastPapersNav,
    requiresPlanActivation,
    accessExpired: Boolean(accessExpired),
    accessGranted,
    accessDaysLeft,
    completeExperienceAccess,
    hasCompleteCourse,
    isFreeTrial,
    trialDay,
    loading,
    loaded
  };
}
