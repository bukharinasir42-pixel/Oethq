/**
 * AccountabilityService — the daily student-accountability tracker.
 *
 * Students silently record a per-(user, UTC day) completion for lecture /
 * spelling / article (StudentActivity); podcast comes from PodcastListen and
 * test is derived from TestAttempt.submittedAt. Admins get a per-day roster of
 * active students with a tick per activity, and can email a warning to anyone
 * who is falling behind.
 */
import { AttemptStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { UsersService } from "../users/users.service";
import type { EmailService } from "../email/email.service";

const DAY_MS = 86_400_000;

/** Activities a student can self-mark via POST /activity/mark. `submit` is the
 *  explicit "I've finished today's work" attestation from the dashboard button —
 *  the clearest accountability signal (tracked separately from the 5 tasks). */
export const MARKABLE = ["lecture", "spelling", "article", "podcast", "submit"] as const;
export type MarkableKind = (typeof MARKABLE)[number];
export function isMarkable(v: unknown): v is MarkableKind {
  return typeof v === "string" && (MARKABLE as readonly string[]).includes(v);
}

export const ACTIVITY_LABELS: Record<string, string> = {
  lecture: "Watch a lecture",
  test: "Complete a timed test",
  spelling: "Do the daily spelling",
  podcast: "Listen to the daily podcast",
  article: "Read the daily article"
};

export class AccountabilityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly users: UsersService,
    private readonly email: EmailService
  ) {}

  todayKey(now: number = Date.now()): number {
    return Math.floor(now / DAY_MS);
  }

  /** Student self-marks an activity done for today (idempotent per day+kind). */
  async markActivity(userId: string, kind: MarkableKind, now: number = Date.now()) {
    const dayKey = this.todayKey(now);
    await this.prisma.studentActivity.upsert({
      where: { userId_dayKey_kind: { userId, dayKey, kind } },
      create: { userId, dayKey, kind },
      update: {}
    });
    return { ok: true, dayKey, kind };
  }

  /**
   * Everything one student has ever done, for the admin drill-down.
   *
   * Deliberately not filtered by product or plan: a Reading-only buyer records
   * the same activities as a Complete Course student, and the point of this view
   * is to answer "what has this person actually done" regardless of what they
   * bought. Also why it reads the user directly rather than going through
   * listSubscribed(), which only sees subscription holders.
   */
  async studentHistory(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, createdAt: true, lastLogin: true,
        subscriptions: {
          where: { status: { in: ["ACTIVE", "TRIAL", "EXPIRED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, startDate: true, endDate: true, plan: { select: { name: true, tier: true } } }
        },
        entitlements: {
          where: { status: "ACTIVE" },
          select: { entitlementKey: true, endDate: true, product: { select: { name: true, slug: true } } }
        }
      }
    });
    if (!user) throw Object.assign(new Error("Student not found"), { statusCode: 404 });

    const [acts, podcasts, attempts] = await Promise.all([
      this.prisma.studentActivity.findMany({
        where: { userId },
        select: { dayKey: true, kind: true, createdAt: true },
        orderBy: { dayKey: "desc" }
      }),
      this.prisma.podcastListen.findMany({ where: { userId }, select: { dayKey: true } }),
      this.prisma.testAttempt.findMany({
        where: { userId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] } },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true, status: true, startedAt: true, submittedAt: true,
          score: true, partAScore: true, partBScore: true, partCScore: true,
          scaledScore: true, oetGrade: true,
          test: { select: { id: true, title: true, type: true, totalQuestions: true } }
        }
      })
    ]);

    const tests = attempts.map((a) => ({
      attemptId: a.id,
      testId: a.test.id,
      title: a.test.title,
      type: a.test.type,
      status: a.status,
      startedAt: a.startedAt?.toISOString() ?? null,
      submittedAt: a.submittedAt?.toISOString() ?? null,
      dayKey: a.submittedAt ? Math.floor(a.submittedAt.getTime() / DAY_MS) : null,
      autoSubmitted: a.status === AttemptStatus.AUTO_SUBMITTED,
      score: a.score,
      totalQuestions: a.test.totalQuestions,
      partAScore: a.partAScore,
      partBScore: a.partBScore,
      partCScore: a.partCScore,
      scaledScore: a.scaledScore,
      grade: a.oetGrade ? (a.oetGrade === "C_PLUS" ? "C+" : a.oetGrade) : null
    }));

    // One row per day the student did anything at all, newest first.
    const podcastDays = new Set(podcasts.map((p) => p.dayKey));
    const testsByDay = new Map<number, number>();
    for (const t of tests) if (t.dayKey != null) testsByDay.set(t.dayKey, (testsByDay.get(t.dayKey) ?? 0) + 1);

    const dayKeys = new Set<number>([
      ...acts.map((a) => a.dayKey),
      ...podcastDays,
      ...testsByDay.keys()
    ]);
    const kindsByDay = new Map<number, Set<string>>();
    for (const a of acts) {
      if (!kindsByDay.has(a.dayKey)) kindsByDay.set(a.dayKey, new Set());
      kindsByDay.get(a.dayKey)!.add(a.kind);
    }

    const days = [...dayKeys].sort((a, b) => b - a).map((dayKey) => {
      const k = kindsByDay.get(dayKey) ?? new Set<string>();
      return {
        dayKey,
        date: new Date(dayKey * DAY_MS).toISOString().slice(0, 10),
        lecture: k.has("lecture"),
        spelling: k.has("spelling"),
        article: k.has("article"),
        podcast: podcastDays.has(dayKey) || k.has("podcast"),
        drill: k.has("drill"),
        submitted: k.has("submit"),
        tests: testsByDay.get(dayKey) ?? 0
      };
    });

    const scored = tests.filter((t) => t.scaledScore != null).map((t) => t.scaledScore as number);
    const readingScored = tests.filter((t) => t.type === "READING" && t.scaledScore != null);
    const listeningScored = tests.filter((t) => t.type === "LISTENING" && t.scaledScore != null);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

    return {
      student: {
        id: user.id,
        name: user.name,
        email: user.email,
        joinedAt: user.createdAt.toISOString(),
        lastLogin: user.lastLogin?.toISOString() ?? null,
        plan: user.subscriptions[0]?.plan?.name ?? null,
        planStatus: user.subscriptions[0]?.status ?? null,
        accessEnds: user.subscriptions[0]?.endDate?.toISOString() ?? null,
        courses: user.entitlements
          .filter((e) => e.entitlementKey !== "complete")
          .map((e) => ({ name: e.product?.name ?? e.entitlementKey, slug: e.product?.slug ?? null, endDate: e.endDate?.toISOString() ?? null }))
      },
      summary: {
        activeDays: days.length,
        submittedDays: days.filter((d) => d.submitted).length,
        testsSubmitted: tests.length,
        bestScaled: scored.length ? Math.max(...scored) : null,
        avgScaled: avg(scored),
        avgReading: avg(readingScored.map((t) => t.scaledScore as number)),
        avgListening: avg(listeningScored.map((t) => t.scaledScore as number)),
        firstActivity: days.length ? days[days.length - 1].date : null,
        lastActivity: days.length ? days[0].date : null
      },
      tests,
      days
    };
  }

  /**
   * Every candidate with live access, whether that came from a Complete Course
   * subscription or a single-skill entitlement. listSubscribed() only sees
   * subscription holders, so a Reading-only buyer never appeared in the roster
   * even though their activity was being recorded.
   */
  private async activeStudents() {
    const users = await this.prisma.user.findMany({
      where: {
        role: "CANDIDATE",
        OR: [
          { subscriptions: { some: { status: { in: ["ACTIVE", "TRIAL", "EXPIRED"] } } } },
          { entitlements: { some: { status: "ACTIVE" } } }
        ]
      },
      select: {
        id: true, name: true, email: true,
        subscriptions: {
          where: { status: { in: ["ACTIVE", "TRIAL", "EXPIRED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, plan: { select: { name: true, tier: true } } }
        },
        entitlements: {
          where: { status: "ACTIVE" },
          select: { entitlementKey: true, product: { select: { name: true, tierRank: true, includedSkills: true } } }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return users.map((u) => {
      const sub = u.subscriptions[0] ?? null;
      const completePlan = sub && sub.plan.tier !== "STARTER" ? sub.plan.name : null;

      // Strongest owned tier per skill — the same rule the portal gates on.
      const tierBySkill: Record<string, number> = {};
      for (const e of u.entitlements) {
        const p = e.product;
        if (!p) continue;
        for (const sk of p.includedSkills) {
          tierBySkill[sk] = Math.max(tierBySkill[sk] ?? 0, p.tierRank ?? 0);
        }
      }
      if (completePlan) for (const sk of ["READING", "LISTENING", "WRITING", "SPEAKING"]) tierBySkill[sk] = 99;

      const owns = (skill: string, minTier = 1) => (tierBySkill[skill] ?? 0) >= minTier;
      // Which of the five daily tasks this student can actually do. Marking a
      // Reading-only buyer "missed the podcast" would be counting them down for
      // content they cannot open — and would email them about it.
      const applicable = {
        lecture: owns("READING") || owns("LISTENING") || owns("WRITING"),
        test: owns("READING") || owns("LISTENING"),
        spelling: owns("LISTENING", 3),
        podcast: owns("LISTENING", 3),
        article: owns("READING", 3)
      };

      const courseNames = u.entitlements
        .filter((e) => e.entitlementKey !== "complete" && e.product)
        .map((e) => e.product!.name);

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        // A course buyer keeps the STARTER row from signup, so the raw
        // subscription status reads TRIAL even though they have paid. What they
        // own decides the label.
        status: courseNames.length > 0 && !completePlan ? "COURSE" : (sub?.status ?? "COURSE"),
        plan: completePlan ?? (courseNames.length ? courseNames.join(", ") : null),
        applicable
      };
    });
  }

  /** Per-day accountability roster for all active students. */
  async roster(dayKey: number) {
    const subs = await this.activeStudents();
    const ids = subs.map((s) => s.userId);
    const dayStart = new Date(dayKey * DAY_MS);
    const dayEnd = new Date((dayKey + 1) * DAY_MS);

    const [acts, podcasts, tests] = await Promise.all([
      this.prisma.studentActivity.findMany({ where: { dayKey, userId: { in: ids } }, select: { userId: true, kind: true } }),
      this.prisma.podcastListen.findMany({ where: { dayKey, userId: { in: ids } }, select: { userId: true } }),
      this.prisma.testAttempt.findMany({
        where: {
          userId: { in: ids },
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] },
          OR: [{ submittedAt: { gte: dayStart, lt: dayEnd } }, { autoSubmittedAt: { gte: dayStart, lt: dayEnd } }]
        },
        select: { userId: true }
      })
    ]);

    const actByUser = new Map<string, Set<string>>();
    for (const a of acts) {
      if (!actByUser.has(a.userId)) actByUser.set(a.userId, new Set());
      actByUser.get(a.userId)!.add(a.kind);
    }
    const podcastSet = new Set(podcasts.map((p) => p.userId));
    const testSet = new Set(tests.map((t) => t.userId));

    const students = subs.map((s) => {
      const set = actByUser.get(s.userId) ?? new Set<string>();
      const done = {
        lecture: set.has("lecture"),
        test: testSet.has(s.userId),
        spelling: set.has("spelling"),
        podcast: podcastSet.has(s.userId) || set.has("podcast"),
        article: set.has("article")
      };
      // Count only what this student's access actually includes.
      const keys = Object.keys(done) as (keyof typeof done)[];
      const expected = keys.filter((k) => s.applicable[k]);
      const completed = expected.filter((k) => done[k]).length;
      return {
        userId: s.userId,
        name: s.name,
        email: s.email,
        status: s.status,
        plan: s.plan,
        done,
        applicable: s.applicable,
        expected: expected.length,
        completed,
        missed: expected.length - completed,
        // Explicit "Submit today's work" attestation from the dashboard button.
        submitted: set.has("submit")
      };
    });

    const summary = {
      total: students.length,
      allDone: students.filter((s) => s.missed === 0).length,
      incomplete: students.filter((s) => s.missed > 0).length,
      submitted: students.filter((s) => s.submitted).length
    };
    return { dayKey, students, summary };
  }

  /**
   * What to chase this student about. Scoped to `applicable`, so a Reading-only
   * buyer is never emailed about the Listening podcast they cannot open.
   */
  private missingFor(done: Record<string, boolean>, applicable?: Record<string, boolean>): string[] {
    return Object.entries(done)
      .filter(([k, v]) => !v && (!applicable || applicable[k]))
      .map(([k]) => ACTIVITY_LABELS[k] ?? k);
  }

  /** Email a "complete your tasks" warning to one student (for `dayKey`). */
  async warn(userId: string, dayKey?: number) {
    const day = dayKey ?? this.todayKey();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    if (!user) throw Object.assign(new Error("Student not found"), { statusCode: 404 });

    const { students } = await this.roster(day);
    const row = students.find((s) => s.userId === userId);
    const missing = row ? this.missingFor(row.done, row.applicable) : Object.values(ACTIVITY_LABELS);

    const firstName = (user.name || "there").split(" ")[0];
    const listHtml = missing.map((m) => `<li style="margin:4px 0">${m}</li>`).join("");
    const listText = missing.map((m) => `• ${m}`).join("\n");
    const subject = "Action needed — complete today's OET tasks to stay on track to clear";
    const text = `Hi ${firstName},\n\nOur records show you haven't completed all of today's tasks. To stay on track to clear your OET on the first attempt, please finish:\n\n${listText}\n\nConsistency every day is what turns a borderline C+ into a B. Log in and complete them now.\n\n— OET HQ`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B1B36">
        <p style="font-size:16px">Hi ${firstName},</p>
        <p style="font-size:14px;line-height:1.6;color:#334">Our records show you haven't completed all of <b>today's tasks</b>. Daily consistency is exactly what turns a borderline C+ into a <b>B</b> — please finish the following to stay on track to clear on your first attempt:</p>
        <ul style="font-size:14px;color:#0B1B36;padding-left:20px">${listHtml || "<li>All tasks — get started today</li>"}</ul>
        <p style="font-size:14px;line-height:1.6;color:#334">Log in and complete them now. You've got this.</p>
        <p style="font-size:13px;color:#64748B;margin-top:24px">— The OET HQ team</p>
      </div>`;

    const result = await this.email.sendCohortMail(user.email, { subject, text, html });
    return { userId, email: user.email, delivered: result.delivered, missing };
  }

  async warnBulk(userIds: string[], dayKey?: number) {
    const unique = Array.from(new Set(userIds)).filter(Boolean);
    let sent = 0;
    const failures: string[] = [];
    for (const id of unique) {
      try {
        const r = await this.warn(id, dayKey);
        if (r.delivered) sent += 1;
      } catch {
        failures.push(id);
      }
    }
    return { requested: unique.length, sent, failed: failures.length };
  }
}
