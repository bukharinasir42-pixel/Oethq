import { PlanTier, SubscriptionStatus } from "@prisma/client";
import {
  calendarDaysRemaining,
  pickCurrentSubscriptionForDisplay,
  pickEffectiveSubscriptionForAccess
} from "./subscription-access.utils";

const activeWindow = {
  otpVerifiedAt: new Date("2026-07-01T10:00:00.000Z"),
  startDate: new Date("2026-07-01T10:00:00.000Z"),
  endDate: new Date("2026-08-30T10:00:00.000Z")
};

describe("subscription access utils", () => {
  it("prefers foundation over starter when both exist", () => {
    const picked = pickEffectiveSubscriptionForAccess([
      {
        status: SubscriptionStatus.TRIAL,
        plan: { tier: PlanTier.STARTER },
        ...activeWindow
      },
      {
        status: SubscriptionStatus.ACTIVE,
        plan: { tier: PlanTier.FOUNDATION },
        ...activeWindow
      }
    ]);

    expect(picked?.plan.tier).toBe(PlanTier.FOUNDATION);
  });

  it("prefers active paid plan over expired higher tier", () => {
    const picked = pickEffectiveSubscriptionForAccess([
      {
        status: SubscriptionStatus.EXPIRED,
        plan: { tier: PlanTier.MASTERY },
        otpVerifiedAt: new Date("2026-01-01"),
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-01")
      },
      {
        status: SubscriptionStatus.ACTIVE,
        plan: { tier: PlanTier.FOUNDATION },
        ...activeWindow
      }
    ]);

    expect(picked?.plan.tier).toBe(PlanTier.FOUNDATION);
  });

  it("pickCurrentSubscriptionForDisplay prefers the most recent active plan", () => {
    const picked = pickCurrentSubscriptionForDisplay([
      {
        status: SubscriptionStatus.EXPIRED,
        plan: { tier: PlanTier.MASTERY },
        createdAt: new Date("2026-03-01")
      },
      {
        status: SubscriptionStatus.ACTIVE,
        plan: { tier: PlanTier.STARTER },
        createdAt: new Date("2026-06-01")
      },
      {
        status: SubscriptionStatus.ACTIVE,
        plan: { tier: PlanTier.ACCELERATOR },
        createdAt: new Date("2026-04-01")
      }
    ]);

    expect(picked?.plan.tier).toBe(PlanTier.STARTER);
  });

  it("calendarDaysRemaining drops by one on the next calendar day", () => {
    const endDate = new Date("2026-09-09T09:27:00.000Z"); // activated Jul 11 + 60 days
    expect(calendarDaysRemaining(endDate, new Date("2026-07-11T09:27:00.000Z"))).toBe(60);
    expect(calendarDaysRemaining(endDate, new Date("2026-07-12T08:33:00.000Z"))).toBe(59);
  });
});
