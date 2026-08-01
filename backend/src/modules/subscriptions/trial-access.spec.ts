/**
 * Regression cover for the "paying student gets the free trial" bug.
 *
 * Every user gets a STARTER subscription at signup. Buying the Complete Course
 * rewrites that row onto the paid plan, but buying — or being admin-granted — a
 * single-skill course (Reading Mega, Listening Precision, …) only creates an
 * Entitlement and leaves the STARTER row untouched. resolveTrialAccess used to
 * decide "is this a trial?" from subscriptions alone, so those buyers stayed
 * isTrial=true and the portal collapsed them to the one-sample trial.
 */
import { PlanTier, SubscriptionStatus } from "@prisma/client";
import { resolveTrialAccess } from "./trial-access";
import type { PrismaService } from "../../common/prisma.service";

const HOUR = 3_600_000;

type Sub = { startDate: Date | null; endDate: Date | null; plan: { tier: PlanTier } };

/** Minimal Prisma stand-in — only the calls resolveTrialAccess makes. */
function fakePrisma(opts: { subs: Sub[]; entitlements: number }) {
  return {
    subscription: { findMany: jest.fn().mockResolvedValue(opts.subs) },
    entitlement: { count: jest.fn().mockResolvedValue(opts.entitlements) },
    dailyTask: { findFirst: jest.fn().mockResolvedValue(null) },
    courseLecture: { findFirst: jest.fn().mockResolvedValue({ id: "lec-1" }) },
    test: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({ id: "test-1" })
    }
  } as unknown as PrismaService;
}

const starter = (startDate: Date | null = new Date()): Sub => ({
  startDate,
  endDate: new Date(Date.now() + 7 * 24 * HOUR),
  plan: { tier: PlanTier.STARTER }
});

describe("resolveTrialAccess", () => {
  it("treats a live entitlement as paid, even while the signup STARTER row survives", async () => {
    // Exactly the reported case: student is granted Listening Mega. No paid
    // subscription is created — only an entitlement — and the STARTER row stays.
    const prisma = fakePrisma({ subs: [starter()], entitlements: 1 });
    await expect(resolveTrialAccess(prisma, "u1")).resolves.toMatchObject({
      isTrial: false,
      trialDay: null
    });
  });

  it("still reports a trial for a STARTER holder who owns nothing", async () => {
    const prisma = fakePrisma({ subs: [starter()], entitlements: 0 });
    const r = await resolveTrialAccess(prisma, "u1");
    expect(r.isTrial).toBe(true);
    expect(r.trialDay).toBe(1);
  });

  it("counts trial days by calendar date, so a late-evening signup keeps a full Day 1", async () => {
    const prisma = fakePrisma({ subs: [starter(new Date(Date.now() - 2 * 24 * HOUR))], entitlements: 0 });
    await expect(resolveTrialAccess(prisma, "u1")).resolves.toMatchObject({ trialDay: 3 });
  });

  it("is not a trial when a paid plan subscription is held", async () => {
    const paid: Sub = { startDate: new Date(), endDate: null, plan: { tier: PlanTier.MASTERY } };
    const prisma = fakePrisma({ subs: [starter(), paid], entitlements: 0 });
    await expect(resolveTrialAccess(prisma, "u1")).resolves.toMatchObject({ isTrial: false });
  });

  it("ignores an expired STARTER row", async () => {
    const expired: Sub = {
      startDate: new Date(Date.now() - 30 * 24 * HOUR),
      endDate: new Date(Date.now() - 24 * HOUR),
      plan: { tier: PlanTier.STARTER }
    };
    const prisma = fakePrisma({ subs: [expired], entitlements: 0 });
    await expect(resolveTrialAccess(prisma, "u1")).resolves.toMatchObject({ isTrial: false });
  });

  it("only counts entitlements that have not lapsed", async () => {
    // The count query filters on status ACTIVE and endDate > now; an entitlement
    // whose access window has run out must drop the student back to the trial
    // rather than leaving them in a paid-but-empty state.
    const prisma = fakePrisma({ subs: [starter()], entitlements: 0 });
    await expect(resolveTrialAccess(prisma, "u1")).resolves.toMatchObject({ isTrial: true });

    const countArgs = (prisma.entitlement.count as jest.Mock).mock.calls[0][0];
    expect(countArgs.where.status).toBe("ACTIVE");
    expect(countArgs.where.OR).toEqual([{ endDate: null }, { endDate: { gt: expect.any(Date) } }]);
  });

  it("does not query subscriptions for cancelled/expired statuses", async () => {
    const prisma = fakePrisma({ subs: [starter()], entitlements: 0 });
    await resolveTrialAccess(prisma, "u1");
    const args = (prisma.subscription.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.status.in).toEqual([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]);
  });
});
