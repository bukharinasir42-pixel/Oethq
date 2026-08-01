/**
 * Free-trial (STARTER) access rules. A trial user owns no skills, so instead of
 * skill-ownership we grant exactly ONE sample of each: the first published
 * lecture plus the Reading and Listening tests assigned to cohort Day 1. This
 * keeps the course, cohort Day 1 and the trial pointing at the SAME playable
 * test. If Day 1 has no suitable (published, contentJson) test we fall back to
 * the oldest published test of that type. Everything else stays locked →
 * upgrade. Spelling and the Part A drill are allowed on the practice surface
 * (frontend-gated, no backend ownership).
 *
 * "On a trial" means: holds a live STARTER subscription AND owns nothing paid.
 * Paid means either a non-STARTER subscription (Complete Course) OR any live
 * entitlement (a single-skill course). Both have to be checked — buying a
 * Complete Course plan rewrites the STARTER subscription row, but buying or
 * being granted a single-skill course only creates an entitlement and leaves
 * the STARTER row from signup exactly where it was.
 */
import { PlanTier, SubscriptionStatus, TestType, Prisma } from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";

export type TrialAccess = {
  isTrial: boolean;
  /**
   * 1-based day of the trial, by CALENDAR date — 1 on the start date, 2 the next
   * date, and so on. Null when the user is not on a trial. Calendar-based (not
   * elapsed hours) so someone who signs up at 23:50 still gets a full Day 1.
   *
   * The rotating daily content (spelling, Part A drill, podcast) is a Day-1-only
   * sample: the Tier 0 card sells "1 day of live spelling" and "1 podcast
   * episode", singular. Without this the trial ran for the plan's full 7 days and
   * handed out seven of each.
   */
  trialDay: number | null;
  lectureId: string | null;
  readingTestId: string | null;
  listeningTestId: string | null;
};

const NOT_NULL_JSON = { NOT: { contentJson: { equals: Prisma.DbNull } } };
const DAY_MS = 86_400_000;

/** Whole calendar days from `start` to `now`, in UTC. Same date → 0. */
function calendarDaysBetween(start: Date, now: Date): number {
  const midnight = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((midnight(now) - midnight(start)) / DAY_MS);
}

const NO_TRIAL: TrialAccess = {
  isTrial: false, trialDay: null, lectureId: null, readingTestId: null, listeningTestId: null
};

export async function resolveTrialAccess(prisma: PrismaService, userId: string): Promise<TrialAccess> {
  const now = new Date();
  const [subs, paidEntitlements] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
      select: { startDate: true, endDate: true, plan: { select: { tier: true } } }
    }),
    // A single-skill course (Reading Mega, Listening Precision, …) is granted as
    // an ENTITLEMENT and creates no subscription, so the STARTER row from signup
    // survives the purchase. Counting only subscriptions here meant every such
    // buyer stayed isTrial=true and was collapsed back to the one-sample trial:
    // one lecture, one Reading test, one Listening test, everything else locked.
    prisma.entitlement.count({
      where: { userId, status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: now } }] }
    })
  ]);
  const active = subs.filter((s) => !s.endDate || s.endDate > now);
  const hasPaid = active.some((s) => s.plan.tier !== PlanTier.STARTER) || paidEntitlements > 0;
  const starter = active.find((s) => s.plan.tier === PlanTier.STARTER);
  const isTrial = !hasPaid && Boolean(starter);
  if (!isTrial) return NO_TRIAL;
  // No startDate (not yet OTP-activated) → treat as Day 1 rather than locking the
  // sample content the trial is meant to showcase.
  const trialDay = starter?.startDate ? calendarDaysBetween(starter.startDate, now) + 1 : 1;

  const day1 = await prisma.dailyTask.findFirst({
    where: { dayNumber: 1 },
    select: { assignedReadingTestId: true, assignedListeningTestId: true }
  });

  const [lecture, readingId, listeningId] = await Promise.all([
    prisma.courseLecture.findFirst({ where: { isPublished: true }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true } }),
    pickPlayableTest(prisma, TestType.READING, day1?.assignedReadingTestId ?? null),
    pickPlayableTest(prisma, TestType.LISTENING, day1?.assignedListeningTestId ?? null)
  ]);
  return { isTrial: true, trialDay, lectureId: lecture?.id ?? null, readingTestId: readingId, listeningTestId: listeningId };
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
