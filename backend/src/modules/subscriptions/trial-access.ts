/**
 * Free-trial (STARTER) access rules. A trial user owns no skills, so instead of
 * skill-ownership we grant exactly ONE sample of each: the first published
 * lecture plus the Reading and Listening tests assigned to cohort Day 1. This
 * keeps the course, cohort Day 1 and the trial pointing at the SAME playable
 * test. If Day 1 has no suitable (published, contentJson) test we fall back to
 * the oldest published test of that type. Everything else stays locked →
 * upgrade. Spelling and the Part A drill are allowed on the practice surface
 * (frontend-gated, no backend ownership).
 */
import { PlanTier, SubscriptionStatus, TestType, Prisma } from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";

export type TrialAccess = {
  isTrial: boolean;
  lectureId: string | null;
  readingTestId: string | null;
  listeningTestId: string | null;
};

const NOT_NULL_JSON = { NOT: { contentJson: { equals: Prisma.DbNull } } };

export async function resolveTrialAccess(prisma: PrismaService, userId: string): Promise<TrialAccess> {
  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
    select: { endDate: true, plan: { select: { tier: true } } }
  });
  const active = subs.filter((s) => !s.endDate || s.endDate > now);
  const hasPaid = active.some((s) => s.plan.tier !== PlanTier.STARTER);
  const isTrial = !hasPaid && active.some((s) => s.plan.tier === PlanTier.STARTER);
  if (!isTrial) return { isTrial: false, lectureId: null, readingTestId: null, listeningTestId: null };

  const day1 = await prisma.dailyTask.findFirst({
    where: { dayNumber: 1 },
    select: { assignedReadingTestId: true, assignedListeningTestId: true }
  });

  const [lecture, readingId, listeningId] = await Promise.all([
    prisma.courseLecture.findFirst({ where: { isPublished: true }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true } }),
    pickPlayableTest(prisma, TestType.READING, day1?.assignedReadingTestId ?? null),
    pickPlayableTest(prisma, TestType.LISTENING, day1?.assignedListeningTestId ?? null)
  ]);
  return { isTrial: true, lectureId: lecture?.id ?? null, readingTestId: readingId, listeningTestId: listeningId };
}

/**
 * Prefer the cohort Day-1 assigned test when it is a published, contentJson
 * (importer-driven) test of the requested type; otherwise fall back to the
 * oldest published contentJson test of that type.
 */
async function pickPlayableTest(prisma: PrismaService, type: TestType, preferredId: string | null): Promise<string | null> {
  if (preferredId) {
    const t = await prisma.test.findUnique({
      where: { id: preferredId },
      select: { id: true, type: true, isPublished: true, contentJson: true }
    });
    if (t && t.type === type && t.isPublished && t.contentJson != null) return t.id;
  }
  const fb = await prisma.test.findFirst({
    where: { type, isPublished: true, ...NOT_NULL_JSON },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  return fb?.id ?? null;
}
