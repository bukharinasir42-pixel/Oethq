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

  /** Per-day accountability roster for all active students. */
  async roster(dayKey: number) {
    const subs = (await this.users.listSubscribed()) as Array<{
      userId: string; name: string; email: string; status: string;
      plan: { name: string } | null;
    }>;
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
      const completed = Object.values(done).filter(Boolean).length;
      return {
        userId: s.userId,
        name: s.name,
        email: s.email,
        status: s.status,
        plan: s.plan?.name ?? null,
        done,
        completed,
        missed: 5 - completed,
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

  private missingFor(done: Record<string, boolean>): string[] {
    return Object.entries(done).filter(([, v]) => !v).map(([k]) => ACTIVITY_LABELS[k] ?? k);
  }

  /** Email a "complete your tasks" warning to one student (for `dayKey`). */
  async warn(userId: string, dayKey?: number) {
    const day = dayKey ?? this.todayKey();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    if (!user) throw Object.assign(new Error("Student not found"), { statusCode: 404 });

    const { students } = await this.roster(day);
    const row = students.find((s) => s.userId === userId);
    const missing = row ? this.missingFor(row.done) : Object.values(ACTIVITY_LABELS);

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
