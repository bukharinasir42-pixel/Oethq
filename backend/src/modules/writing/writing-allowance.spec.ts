/**
 * Writing-correction allowance.
 *
 * The bug this guards against: Plan.writingLimit was added with DEFAULT 0 and
 * never back-filled, so every deployed plan sat at 0 and writingAllowance()
 * returned 0 for paying students. A brand-new Elite Clearance student opened
 * Writing Corrections and was told to buy a pack before submitting anything —
 * having already paid for seven corrections.
 *
 * The data fix is 20260802140000_backfill_writing_limits. These tests pin the
 * arithmetic around it, since a zero here is indistinguishable from "your plan
 * genuinely includes none" and fails silently.
 */
import { SubscriptionStatus, EntitlementStatus } from "@prisma/client";
import { WritingService } from "./writing.service";
import type { PrismaClient } from "@prisma/client";

const DAY = 86_400_000;
const future = () => new Date(Date.now() + 30 * DAY);
const past = () => new Date(Date.now() - DAY);

function svc(subs: unknown[], ents: unknown[]) {
  const prisma = {
    subscription: { findMany: jest.fn().mockResolvedValue(subs) },
    entitlement: { findMany: jest.fn().mockResolvedValue(ents) }
  } as unknown as PrismaClient;
  return new WritingService(prisma as never, {} as never);
}

describe("writingAllowance", () => {
  it("gives an Elite Clearance student their seven corrections", async () => {
    const r = await svc([{ endDate: future(), plan: { writingLimit: 7 } }], []).writingAllowance("u1");
    expect(r).toMatchObject({ planLimit: 7, packageLimit: 0, allowed: 7 });
  });

  it("adds correction packs on top of the plan", async () => {
    const r = await svc(
      [{ endDate: future(), plan: { writingLimit: 7 } }],
      [{ endDate: future(), product: { writingCorrections: 6 } }]
    ).writingAllowance("u1");
    expect(r.allowed).toBe(13);
  });

  it("takes the strongest plan rather than summing plans", async () => {
    // A leftover STARTER row alongside a paid plan must not drag the total down,
    // and two plans must not stack.
    const r = await svc(
      [
        { endDate: future(), plan: { writingLimit: 0 } },
        { endDate: future(), plan: { writingLimit: 7 } }
      ],
      []
    ).writingAllowance("u1");
    expect(r.planLimit).toBe(7);
  });

  it("ignores a lapsed plan and lapsed packs", async () => {
    const r = await svc(
      [{ endDate: past(), plan: { writingLimit: 7 } }],
      [{ endDate: past(), product: { writingCorrections: 6 } }]
    ).writingAllowance("u1");
    expect(r.allowed).toBe(0);
  });

  it("counts an undated plan as live", async () => {
    // A purchased plan sits with endDate null until its window opens; the student
    // must not read as having zero corrections in that gap.
    const r = await svc([{ endDate: null, plan: { writingLimit: 3 } }], []).writingAllowance("u1");
    expect(r.allowed).toBe(3);
  });

  it("only looks at live subscriptions and entitlements", async () => {
    const s = svc([], []);
    await s.writingAllowance("u1");
    const subArgs = ((s as unknown as { prisma: PrismaClient }).prisma.subscription.findMany as jest.Mock).mock.calls[0][0];
    expect(subArgs.where.status.in).toEqual([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]);
    const entArgs = ((s as unknown as { prisma: PrismaClient }).prisma.entitlement.findMany as jest.Mock).mock.calls[0][0];
    expect(entArgs.where.status).toBe(EntitlementStatus.ACTIVE);
  });
});
