/**
 * CohortJobsService — backend jobs (never browser timers).
 * Started once from server bootstrap: cohortJobsService.start()
 *
 * Every run is idempotent:
 *  - reminders keyed by CohortNotificationLog.refKey (unique)
 *  - missed-marking only transitions UPCOMING -> MISSED after window close
 *  - warnings deduped by open-warning window
 *  - weekly reports unique per (userId, periodStart)
 */
import { CohortAttendance } from "@prisma/client";
import { createLogger } from "../../common/logger";
import type { PrismaService } from "../../common/prisma.service";
import type { EmailService } from "../email/email.service";
import type { CohortService } from "./cohort.service";
import {
  buildMissedSessionEmail, buildSessionReminderEmail, buildWarningEmail, buildWeeklyReportEmail
} from "./cohort-emails";
import { formatLocal, localDate } from "./cohort-time";

const num = (env: string | undefined, dflt: number) => {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

export class CohortJobsService {
  private readonly logger = createLogger("CohortJobs");
  private timer: NodeJS.Timeout | undefined;
  private readonly reminderLeadMin = num(process.env.COHORT_REMINDER_LEAD_MIN, 30);
  private readonly windowMin = num(process.env.COHORT_ATTENDANCE_WINDOW_MIN, 90);
  private readonly tickMs = num(process.env.COHORT_JOB_TICK_MS, 5 * 60 * 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly cohort: CohortService
  ) {}

  start() {
    if (this.timer || process.env.COHORT_JOBS_DISABLED === "true") return;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    void this.tick();
    this.logger.log(`Cohort jobs started (every ${this.tickMs / 1000}s)`);
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }

  async tick() {
    try {
  await this.ensureUpcomingSessions();
} catch (e) {
  this.logger.error(`ensureUpcomingSessions: ${e instanceof Error ? e.message : String(e)}`);
}

try {
  await this.sendSessionReminders();
} catch (e) {
  this.logger.error(`sendSessionReminders: ${e instanceof Error ? e.message : String(e)}`);
}

try {
  await this.closeAttendanceWindows();
} catch (e) {
  this.logger.error(`closeAttendanceWindows: ${e instanceof Error ? e.message : String(e)}`);
}

try {
  await this.issueWarnings();
} catch (e) {
  this.logger.error(`issueWarnings: ${e instanceof Error ? e.message : String(e)}`);
}

try {
  await this.generateWeeklyReports();
} catch (e) {
  this.logger.error(
    `generateWeeklyReports: ${e instanceof Error ? e.message : String(e)}`
  );
}
}
/** Pre-create today's + tomorrow's session records for every onboarded student. */
private async ensureUpcomingSessions() {
    const schedules = await this.prisma.cohortSchedule.findMany();
    const liveTotal = Math.max(1, await this.prisma.dailyTask.count({ where: { isPublished: true } }));
    for (const s of schedules) {
      s.totalDays = liveTotal; // track live published-day count, not the onboarding snapshot
      const n = Math.abs(this.cohort.currentDayNumber(s));
      for (const dayNumber of [n, n + 1]) {
        if (dayNumber >= 1 && dayNumber <= s.totalDays) {
          const exists = await this.prisma.dailyTask.findUnique({
            where: { dayNumber }, select: { id: true, isPublished: true }
          });
          if (exists?.isPublished) {
            await this.cohort.ensureSessionRecords(s.userId, dayNumber).catch(() => undefined);
          }
        }
      }
    }
  }

  /** 30-minute-before reminder emails, idempotent per session record. */
  private async sendSessionReminders() {
    const from = new Date(Date.now());
    const to = new Date(Date.now() + this.reminderLeadMin * 60 * 1000);
    const due = await this.prisma.cohortSessionRecord.findMany({
      where: {
        reminderSentAt: null,
        attendance: CohortAttendance.UPCOMING,
        scheduledAt: { gt: from, lte: to }
      },
      take: 200
    });
    for (const rec of due) {
      const refKey = `reminder:${rec.id}`;
      // idempotency gate
      const claimed = await this.prisma.cohortNotificationLog
        .create({ data: { userId: rec.userId, type: "session_reminder", refKey, scheduledFor: rec.scheduledAt } })
        .catch(() => null);
      if (!claimed) continue; // another worker already claimed it

      const [user, sched, task] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: rec.userId }, select: { email: true, name: true } }),
        this.prisma.cohortSchedule.findUnique({ where: { userId: rec.userId } }),
        this.prisma.dailyTask.findUnique({ where: { dayNumber: rec.dayNumber } })
      ]);
      if (!user || !sched || !task) continue;
      const isLecture = rec.slot === "LECTURE";
      const mail = buildSessionReminderEmail({
        name: user.name,
        classLabel: isLecture ? "Class 1 · Daily Lecture" : "Class 2 · Core Skills Session",
        title: isLecture ? task.lectureTitle : task.articleTitle,
        localTime: formatLocal(rec.scheduledAt, sched.timezone),
        portalUrl: `${process.env.FRONTEND_ORIGIN || ""}/portal/tasks`
      });
      const result = await this.email.sendCohortMail(user.email, mail).catch((e: Error) => ({ error: e.message }));
      await this.prisma.$transaction([
        this.prisma.cohortNotificationLog.update({
          where: { refKey },
          data: "error" in (result as object)
            ? { status: "failed", error: String((result as { error: string }).error) }
            : { status: "sent", sentAt: new Date() }
        }),
        this.prisma.cohortSessionRecord.update({
          where: { id: rec.id }, data: { reminderSentAt: new Date() }
        })
      ]);
    }
  }

  /** Close windows: UPCOMING sessions past their window become MISSED (+ missed email). */
  private async closeAttendanceWindows() {
    const cutoff = new Date(Date.now() - this.windowMin * 60 * 1000);
    const expired = await this.prisma.cohortSessionRecord.findMany({
      where: { attendance: CohortAttendance.UPCOMING, scheduledAt: { lt: cutoff } },
      take: 200
    });
    for (const rec of expired) {
      // Joined but insufficient watch also counts as missed — classification is final
      await this.prisma.cohortSessionRecord.update({
        where: { id: rec.id }, data: { attendance: CohortAttendance.MISSED }
      });
      await this.cohort.recomputeDayProgress(rec.userId, rec.dayNumber).catch(() => undefined);
      const refKey = `missed:${rec.id}`;
      const claimed = await this.prisma.cohortNotificationLog
        .create({ data: { userId: rec.userId, type: "missed_session", refKey } })
        .catch(() => null);
      if (!claimed) continue;
      const [user, sched, task] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: rec.userId }, select: { email: true, name: true } }),
        this.prisma.cohortSchedule.findUnique({ where: { userId: rec.userId } }),
        this.prisma.dailyTask.findUnique({ where: { dayNumber: rec.dayNumber } })
      ]);
      if (!user || !sched || !task) continue;
      const mail = buildMissedSessionEmail({
        name: user.name,
        title: rec.slot === "LECTURE" ? task.lectureTitle : task.articleTitle,
        localTime: formatLocal(rec.scheduledAt, sched.timezone),
        portalUrl: `${process.env.FRONTEND_ORIGIN || ""}/portal/tasks?day=${rec.dayNumber}`
      });
      const result = await this.email.sendCohortMail(user.email, mail).catch((e: Error) => ({ error: e.message }));
      await this.prisma.cohortNotificationLog.update({
        where: { refKey },
        data: "error" in (result as object)
          ? { status: "failed", error: String((result as { error: string }).error) }
          : { status: "sent", sentAt: new Date() }
      });
    }
  }

  /** Accountability: 2 consecutive fully-missed study days => warning; 3 => strong warning. */
  private async issueWarnings() {
    const schedules = await this.prisma.cohortSchedule.findMany();
    const liveTotal = Math.max(1, await this.prisma.dailyTask.count({ where: { isPublished: true } }));
    for (const sched of schedules) {
      sched.totalDays = liveTotal;
      const todayNum = Math.abs(this.cohort.currentDayNumber(sched));
      if (todayNum < 3) continue;
      const days = [todayNum - 1, todayNum - 2, todayNum - 3].filter((n) => n >= 1);
      const missedDays: number[] = [];
      for (const n of days) {
        const recs = await this.prisma.cohortSessionRecord.findMany({
          where: { userId: sched.userId, dayNumber: n }
        });
        if (recs.length && recs.every((r) => r.attendance === CohortAttendance.MISSED)) missedDays.push(n);
      }
      const consecutive =
        missedDays.includes(todayNum - 1) && missedDays.includes(todayNum - 2)
          ? missedDays.includes(todayNum - 3) ? 3 : 2
          : 0;
      if (consecutive < 2) continue;
      const type = consecutive >= 3 ? "strong_warning" : "warning";
      const recent = await this.prisma.cohortWarning.findFirst({
        where: { userId: sched.userId, type, issuedAt: { gt: new Date(Date.now() - 3 * 86400000) } }
      });
      if (recent) continue;
      const relatedDates = missedDays.sort().join(",");
      await this.prisma.cohortWarning.create({
        data: { userId: sched.userId, type, reason: `${consecutive} consecutive study days missed`, relatedDates }
      });
      const user = await this.prisma.user.findUnique({
        where: { id: sched.userId }, select: { email: true, name: true }
      });
      if (!user) continue;
      const refKey = `warning:${sched.userId}:${relatedDates}:${type}`;
      const claimed = await this.prisma.cohortNotificationLog
        .create({ data: { userId: sched.userId, type: "warning", refKey } }).catch(() => null);
      if (!claimed) continue;
      const mail = buildWarningEmail({
        name: user.name, missedCount: consecutive, strong: consecutive >= 3,
        portalUrl: `${process.env.FRONTEND_ORIGIN || ""}/portal/tasks`
      });
      await this.email.sendCohortMail(user.email, mail).catch(() => undefined);
      await this.prisma.cohortNotificationLog.update({
        where: { refKey }, data: { status: "sent", sentAt: new Date() }
      });
    }
  }

  /** Weekly report — generated once per student per ISO week (Mondays, student-local). */
  private async generateWeeklyReports() {
    const schedules = await this.prisma.cohortSchedule.findMany();
    for (const sched of schedules) {
      const nowLocal = localDate(new Date(), sched.timezone);
      if (nowLocal.weekday !== 1) continue; // generate on local Monday
      const monday = new Date(Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day));
      const periodEnd = monday;                                      // exclusive
      const periodStart = new Date(monday.getTime() - 7 * 86400000); // previous Monday
      const exists = await this.prisma.cohortWeeklyReport.findUnique({
        where: { userId_periodStart: { userId: sched.userId, periodStart } }
      });
      if (exists) continue;

      const sessions = await this.prisma.cohortSessionRecord.findMany({
        where: { userId: sched.userId, scheduledAt: { gte: periodStart, lt: periodEnd } }
      });
      if (!sessions.length) continue;
      const attended = sessions.filter((s) =>
        s.attendance === CohortAttendance.ATTENDED || s.attendance === CohortAttendance.LATE).length;
      const missed = sessions.filter((s) => s.attendance === CohortAttendance.MISSED).length;
      const dash = await this.cohort.getAttendanceDashboard(sched.userId);
      const pending = await this.cohort.getPending(sched.userId);
      const data = {
        periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(),
        sessionsScheduled: sessions.length, sessionsAttended: attended, sessionsMissed: missed,
        attendancePct: sessions.length ? Math.round((attended / sessions.length) * 100) : 0,
        avgActiveWatchMin: dash.avgActiveWatchMin,
        currentStreak: dash.currentStreak,
        warningCount: dash.warningCount,
        pendingCatchUp: pending.pendingCount
      };
      const report = await this.prisma.cohortWeeklyReport.create({
        data: { userId: sched.userId, periodStart, periodEnd, data }
      });
      const user = await this.prisma.user.findUnique({
        where: { id: sched.userId }, select: { email: true, name: true }
      });
      if (user) {
        const mail = buildWeeklyReportEmail({
          name: user.name, ...data,
          reportUrl: `${process.env.FRONTEND_ORIGIN || ""}/portal/tasks?report=${report.id}`
        });
        const sent = await this.email.sendCohortMail(user.email, mail).catch(() => null);
        if (sent) {
          await this.prisma.cohortWeeklyReport.update({
            where: { id: report.id }, data: { emailedAt: new Date() }
          });
        }
      }
    }
  }
}
