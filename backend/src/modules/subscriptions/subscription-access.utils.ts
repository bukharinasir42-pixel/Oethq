import { PlanTier, SubscriptionStatus } from "@prisma/client";

const TIER_RANK: Record<PlanTier, number> = {
  [PlanTier.STARTER]: 0,
  [PlanTier.FOUNDATION]: 1,
  [PlanTier.ACCELERATOR]: 2,
  [PlanTier.MASTERY]: 3,
  [PlanTier.CUSTOM]: 4
};

const STATUS_RANK: Record<SubscriptionStatus, number> = {
  [SubscriptionStatus.ACTIVE]: 2,
  [SubscriptionStatus.TRIAL]: 1,
  [SubscriptionStatus.EXPIRED]: 0
};

type SubscriptionWithPlan = {
  status: SubscriptionStatus;
  otpVerifiedAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  plan: { tier: PlanTier; durationDays?: number };
};

type SubscriptionWithCreatedAt = SubscriptionWithPlan & {
  createdAt: Date;
};

/** True when the candidate has activated OTP and the access window is still open. */
export function isSubscriptionAccessActive(
  subscription: SubscriptionWithPlan,
  now: Date = new Date()
): boolean {
  if (subscription.status === SubscriptionStatus.EXPIRED) {
    return false;
  }
  if (!subscription.otpVerifiedAt || !subscription.startDate || !subscription.endDate) {
    return false;
  }
  return subscription.endDate.getTime() > now.getTime();
}

/**
 * Whole calendar days remaining until endDate (UTC date parts).
 * Activation day with a 60-day window → 60; the next calendar day → 59.
 * Access itself still ends at the exact endDate timestamp, not midnight.
 */
export function calendarDaysRemaining(endDate: Date, now: Date = new Date()): number {
  if (endDate.getTime() <= now.getTime()) {
    return 0;
  }
  const startUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const endUtc = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  return Math.max(0, Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)));
}

/** Prefer the highest-tier active/trial subscription that still has valid access. */
export function pickEffectiveSubscriptionForAccess<T extends SubscriptionWithPlan>(
  subscriptions: T[],
  now: Date = new Date()
): T | null {
  const usable = subscriptions.filter((row) => isSubscriptionAccessActive(row, now));

  if (usable.length === 0) {
    return null;
  }

  return [...usable].sort((left, right) => {
    const tierDiff = TIER_RANK[right.plan.tier] - TIER_RANK[left.plan.tier];
    if (tierDiff !== 0) {
      return tierDiff;
    }
    return STATUS_RANK[right.status] - STATUS_RANK[left.status];
  })[0];
}

/** Most recent active/trial subscription for admin display; falls back to latest expired. */
export function pickCurrentSubscriptionForDisplay<T extends SubscriptionWithCreatedAt>(
  subscriptions: T[]
): T | null {
  if (subscriptions.length === 0) {
    return null;
  }

  const sorted = [...subscriptions].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const activeOrTrial = sorted.filter(
    (row) => row.status === SubscriptionStatus.ACTIVE || row.status === SubscriptionStatus.TRIAL
  );

  return activeOrTrial[0] ?? sorted[0];
}

/** Pending paid/plan activation (OTP not yet verified). */
export function pickPendingActivationSubscription<T extends SubscriptionWithPlan>(
  subscriptions: T[]
): T | null {
  const pending = subscriptions.filter(
    (row) =>
      (row.status === SubscriptionStatus.ACTIVE || row.status === SubscriptionStatus.TRIAL) &&
      !row.otpVerifiedAt
  );
  if (pending.length === 0) {
    return null;
  }
  return [...pending].sort((left, right) => TIER_RANK[right.plan.tier] - TIER_RANK[left.plan.tier])[0];
}
