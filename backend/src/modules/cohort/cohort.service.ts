/**
 * CohortService — orchestration layer above the existing LMS.
 *
 * Reuses (never duplicates):
 *  - DailyTask            → programme-day content (lecture, core skills, assigned tests)
 *  - Test/TestAttempt/TestResult → existing test engine + scores
 *  - BunnyPlaybackService → existing signed video embeds
 *
 * Adds: schedule, server-derived session states, attendance (separate from
 * completion), watch-time tracking, day completion, pending catch-up, metrics.
 *
 * All thresholds are env-configurable (see env.cohort.additions):
 *  COHORT_ATTEND_MIN_PCT (60) · COHORT_LATE_GRACE_MIN (10)
 *  COHORT_ATTENDANCE_WINDOW_MIN (90) · COHORT_MIN_GAP_MIN (60)
 *  COHORT_REMINDER_LEAD_MIN (30)
 */
import {
  CohortAttendance,
  CohortSessionSlot,
  Prisma
} from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";
import type { BunnyPlaybackService } from "../media/bunny-playback.service";
import {
  formatLocal, hhmmValid, isValidTimeZone, localDate, minutesOf,
  programmeDayDate, zonedTimeToUtc
} from "./cohort-time";

const num = (env: string | undefined, dflt: number) => {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

export type SessionView = {
  slot: CohortSessionSlot;
  title: string;
  durationMin: number | null;
  scheduledAtUtc: string;
  scheduledLocal: string;
  state:
    | "LOCKED" | "UPCOMING" | "STARTING_SOON" | "AVAILABLE" | "IN_PROGRESS"
    | "MISSED" | "RECORDING_AVAILABLE" | "COMPLETED";
  attendance: CohortAttendance;
  watchPct: number;
  resumePositionSec: number;
  /** Signed embed URL — issued ONLY when state permits playback. */
  embedUrl: string | null;
  primaryAction: string;
  /** True when this session is unlocked ahead of its scheduled day via fast-track. */
  earlyAccess: boolean;
};

export class CohortService {
  private readonly attendMinPct = num(process.env.COHORT_ATTEND_MIN_PCT, 60);
  private readonly lateGraceMin = num(process.env.COHORT_LATE_GRACE_MIN, 10);
  private readonly windowMin = num(process.env.COHORT_ATTENDANCE_WINDOW_MIN, 90);
  private readonly minGapMin = num(process.env.COHORT_MIN_GAP_MIN, 60);
  private readonly startingSoonMin = num(process.env.COHORT_REMINDER_LEAD_MIN, 30);
  private readonly defaultDurationMin = num(process.env.COHORT_DEFAULT_DURATION_MIN, 45);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyPlaybackService
  ) {}

  // ---------------------------------------------------------------- onboarding

  async getMe(userId: string) {
    const schedule = await this.prisma.cohortSchedule.findUnique({
      where: { userId }, include: { changes: { orderBy: { changedAt: "desc" }, take: 5 } }
    });
    const totalPublishedDays = await this.prisma.dailyTask.count({ where: { isPublished: true } });
    return {
      onboarded: Boolean(schedule),
      schedule: schedule && {
        country: schedule.country,
        timezone: schedule.timezone,
        class1Time: schedule.class1Time,
        class2Time: schedule.class2Time,
        startDate: schedule.startDate.toISOString().slice(0, 10),
        totalDays: Math.max(1, totalPublishedDays),
        restWeekday: schedule.restWeekday,
        lockedAt: schedule.lockedAt
      },
      programmeDays: totalPublishedDays
    };
  }

  async saveTimezone(userId: string, country: string, timezone: string) {
    if (!isValidTimeZone(timezone)) {
      throw Object.assign(new Error("Invalid IANA timezone"), { statusCode: 400 });
    }
    const existing = await this.prisma.cohortSchedule.findUnique({ where: { userId } });
    if (existing) {
      if (existing.timezone !== timezone) {
        await this.prisma.cohortScheduleChange.create({
          data: { scheduleId: existing.id, field: "timezone", oldValue: existing.timezone, newValue: timezone }
        });
      }
      return this.prisma.cohortSchedule.update({
        where: { userId }, data: { country, timezone }
      });
    }
    // startDate = tomorrow in the student's timezone (Day 1)
    const nowLocal = localDate(new Date(), timezone);
    const start = new Date(Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day));
    start.setUTCDate(start.getUTCDate() + 1);
    const totalDays = Math.max(1, await this.prisma.dailyTask.count({ where: { isPublished: true } })) || 40;
    return this.prisma.cohortSchedule.create({
      data: {
        userId, country, timezone,
        class1Time: "20:00", class2Time: "21:30", // placeholders until Step 2
        startDate: start, totalDays
      }
    });
  }

  async saveScheduleTimes(userId: string, class1Time: string, class2Time: string) {
    if (!hhmmValid(class1Time) || !hhmmValid(class2Time)) {
      throw Object.assign(new Error("Times must be HH:mm"), { statusCode: 400 });
    }
    const gap = Math.abs(minutesOf(class2Time) - minutesOf(class1Time));
    if (Math.min(gap, 1440 - gap) < this.minGapMin) {
      throw Object.assign(
        new Error(`Keep at least ${this.minGapMin} minutes between the two classes`),
        { statusCode: 400 }
      );
    }
    const existing = await this.prisma.cohortSchedule.findUnique({ where: { userId } });
    if (!existing) {
      throw Object.assign(new Error("Complete the timezone step first"), { statusCode: 400 });
    }
    // Controlled change: future sessions get rescheduled; sessions within 2h are locked.
    for (const [field, oldV, newV] of [
      ["class1Time", existing.class1Time, class1Time],
      ["class2Time", existing.class2Time, class2Time]
    ] as const) {
      if (oldV !== newV) {
        await this.prisma.cohortScheduleChange.create({
          data: { scheduleId: existing.id, field, oldValue: oldV, newValue: newV }
        });
      }
    }
    const updated = await this.prisma.cohortSchedule.update({
      where: { userId }, data: { class1Time, class2Time }
    });
    const cutoff = new Date(Date.now() + 2 * 60 * 60 * 1000);
    // Reschedule future, still-upcoming session records
    const upcoming = await this.prisma.cohortSessionRecord.findMany({
      where: { userId, attendance: CohortAttendance.UPCOMING, scheduledAt: { gt: cutoff } }
    });
    for (const s of upcoming) {
      const d = programmeDayDate(updated.startDate, s.dayNumber, updated.restWeekday);
      const hhmm = s.slot === CohortSessionSlot.LECTURE ? class1Time : class2Time;
      await this.prisma.cohortSessionRecord.update({
        where: { id: s.id },
        data: { scheduledAt: zonedTimeToUtc(d.year, d.month, d.day, hhmm, updated.timezone), reminderSentAt: null }
      });
    }
    return updated;
  }

  // ------------------------------------------------------- session records

  /** Idempotently ensure the two session records for a programme day exist. */
  async ensureSessionRecords(userId: string, dayNumber: number) {
    const sched = await this.requireSchedule(userId);
    const d = programmeDayDate(sched.startDate, dayNumber, sched.restWeekday);
    for (const [slot, hhmm] of [
      [CohortSessionSlot.LECTURE, sched.class1Time],
      [CohortSessionSlot.CORE_SKILLS, sched.class2Time]
    ] as const) {
      const scheduledAt = zonedTimeToUtc(d.year, d.month, d.day, hhmm, sched.timezone);
      await this.prisma.cohortSessionRecord.upsert({
        where: { userId_dayNumber_slot: { userId, dayNumber, slot } },
        create: { userId, dayNumber, slot, scheduledAt },
        update: {} // never move past/locked sessions here
      });
    }
  }

  private async requireSchedule(userId: string) {
    const sched = await this.prisma.cohortSchedule.findUnique({ where: { userId } });
    if (!sched) {
      throw Object.assign(new Error("Cohort onboarding not completed"), { statusCode: 409 });
    }
    // Always track the LIVE published-day count so admin add/remove/publish of days
    // reflects instantly for every enrolled student, regardless of their onboarding
    // snapshot. (Timeline, "today" and unlocks all key off sched.totalDays.)
    const livePublishedDays = await this.prisma.dailyTask.count({ where: { isPublished: true } });
    sched.totalDays = Math.max(1, livePublishedDays);
    return sched;
  }

  /** Which programme day is "today" in the student's timezone? 0 = before Day 1. */
  currentDayNumber(sched: { startDate: Date; timezone: string; restWeekday: number; totalDays: number }): number {
    const today = localDate(new Date(), sched.timezone);
    let count = 0;
    const d = new Date(Date.UTC(
      sched.startDate.getUTCFullYear(), sched.startDate.getUTCMonth(), sched.startDate.getUTCDate()
    ));
    for (let i = 0; i < 400; i++) {
      const isToday = d.getUTCFullYear() === today.year &&
        d.getUTCMonth() + 1 === today.month && d.getUTCDate() === today.day;
      if (d.getUTCDay() !== sched.restWeekday) count++;
      if (isToday) return d.getUTCDay() === sched.restWeekday ? -count : count; // negative => rest day, last day was |count|
      if (count >= sched.totalDays && !isToday) break;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const startMs = sched.startDate.getTime();
    return Date.now() < startMs ? 0 : sched.totalDays;
  }

  // -------------------------------------------------------- state machine

  private deriveState(
    rec: { scheduledAt: Date; attendance: CohortAttendance; firstJoinedAt: Date | null;
           activeWatchSec: number; recordingWatchSec: number; completedAt: Date | null },
    durationMin: number,
    opts: { locked: boolean; earlyAccess: boolean }
  ): SessionView["state"] {
    if (rec.completedAt) return "COMPLETED";
    if (opts.locked) return "LOCKED";
    // Fast-track: unlocked ahead of schedule → watch on demand now (skip the countdown).
    if (opts.earlyAccess) return rec.firstJoinedAt ? "IN_PROGRESS" : "AVAILABLE";
    const now = Date.now();
    const start = rec.scheduledAt.getTime();
    const windowEnd = start + this.windowMin * 60 * 1000;
    if (now < start - this.startingSoonMin * 60 * 1000) return "UPCOMING";
    if (now < start) return "STARTING_SOON";
    if (now <= windowEnd) return rec.firstJoinedAt ? "IN_PROGRESS" : "AVAILABLE";
    // window over
    if (rec.attendance === CohortAttendance.MISSED) return "RECORDING_AVAILABLE";
    if (rec.attendance === CohortAttendance.UPCOMING) return "MISSED"; // job will persist MISSED
    return "RECORDING_AVAILABLE";
  }

  private classifyAttendance(
    rec: { scheduledAt: Date; firstJoinedAt: Date | null; activeWatchSec: number },
    durationMin: number
  ): CohortAttendance {
    if (!rec.firstJoinedAt) return CohortAttendance.MISSED;
    const requiredSec = (durationMin * 60 * this.attendMinPct) / 100;
    if (rec.activeWatchSec < requiredSec) return CohortAttendance.MISSED;
    const lateBy = (rec.firstJoinedAt.getTime() - rec.scheduledAt.getTime()) / 60000;
    return lateBy > this.lateGraceMin ? CohortAttendance.LATE : CohortAttendance.ATTENDED;
  }

  /**
   * Highest programme day the student may access right now. Normally that's the
   * calendar "today". Fast-track: once BOTH classes of a day are completed, the
   * next day unlocks for on-demand watching — so a motivated student can race
   * ahead at their own pace.
   */
  private async computeUnlockedThroughDay(userId: string, todayNum: number, totalDays: number): Promise<number> {
    if (todayNum === 0) return 0; // programme hasn't started
    const done = await this.prisma.cohortSessionRecord.findMany({
      where: { userId, completedAt: { not: null } },
      select: { dayNumber: true, slot: true }
    });
    const slotsByDay = new Map<number, Set<CohortSessionSlot>>();
    for (const r of done) {
      const set = slotsByDay.get(r.dayNumber) ?? new Set<CohortSessionSlot>();
      set.add(r.slot);
      slotsByDay.set(r.dayNumber, set);
    }
    let maxCompleteDay = 0;
    for (const [d, slots] of slotsByDay) {
      if (slots.size >= 2 && d > maxCompleteDay) maxCompleteDay = d;
    }
    return Math.min(totalDays, Math.max(todayNum, maxCompleteDay + 1));
  }

  // -------------------------------------------------------------- day views

  async getDay(userId: string, dayNumber: number) {
    const sched = await this.requireSchedule(userId);
    const task = await this.prisma.dailyTask.findUnique({
      where: { dayNumber },
      include: { assignedReadingTest: true, assignedListeningTest: true }
    });
    if (!task || !task.isPublished) {
      throw Object.assign(new Error("No content mapped for this day"), { statusCode: 404 });
    }
    await this.ensureSessionRecords(userId, dayNumber);
    const records = await this.prisma.cohortSessionRecord.findMany({
      where: { userId, dayNumber }, orderBy: { slot: "asc" }
    });
    const todayNum = Math.abs(this.currentDayNumber(sched));
    const unlockedThroughDay = await this.computeUnlockedThroughDay(userId, todayNum, sched.totalDays);
    const dayIsLocked = todayNum === 0 || dayNumber > unlockedThroughDay;
    const earlyAccess = !dayIsLocked && dayNumber > todayNum;

    const sessions: SessionView[] = [];
    for (const rec of records) {
      const isLecture = rec.slot === CohortSessionSlot.LECTURE;
      const title = isLecture ? task.lectureTitle : task.articleTitle;
      const bunnyId = isLecture ? task.lectureBunnyVideoId : task.articleBunnyVideoId;
      const state = this.deriveState(rec, this.defaultDurationMin, { locked: dayIsLocked, earlyAccess });
      const playable = ["AVAILABLE", "IN_PROGRESS", "RECORDING_AVAILABLE", "COMPLETED"].includes(state);
      let embedUrl: string | null = null;
      if (playable && bunnyId) {
        try { embedUrl = this.bunny.buildEmbedUrl(bunnyId, { autoplay: false }).url; }
        catch { embedUrl = isLecture ? task.lectureUrl : task.articleUrl; }
      }
      const durSec = this.defaultDurationMin * 60;
      const watch = Math.max(rec.activeWatchSec + rec.recordingWatchSec, 0);
      sessions.push({
        slot: rec.slot,
        title,
        durationMin: this.defaultDurationMin,
        scheduledAtUtc: rec.scheduledAt.toISOString(),
        scheduledLocal: formatLocal(rec.scheduledAt, sched.timezone),
        state,
        attendance: rec.attendance,
        watchPct: Math.min(100, Math.round((watch / durSec) * 100)),
        resumePositionSec: rec.lastPositionSec,
        embedUrl,
        earlyAccess,
        primaryAction:
          state === "COMPLETED" ? "Session Completed" :
          state === "IN_PROGRESS" ? "Continue Watching" :
          earlyAccess && state === "AVAILABLE" ? "Watch Ahead" :
          state === "AVAILABLE" ? "Join Session" :
          state === "RECORDING_AVAILABLE" || state === "MISSED" ? "Watch Recording" :
          "View Schedule"
      });
    }

    const tests = await this.testAssignments(userId, task);
    const dayProgress = await this.prisma.cohortDayProgress.findUnique({
      where: { userId_dayNumber: { userId, dayNumber } }
    });

    return {
      dayNumber,
      title: task.title,
      summary: task.summary,
      isToday: dayNumber === todayNum,
      sessions,
      tests,
      dayStatus: dayProgress?.status ?? (dayIsLocked ? "UPCOMING" : "ACTIVE"),
      completionPct: dayProgress?.completionPct ?? 0
    };
  }

  private async testAssignments(
    userId: string,
    task: { assignedReadingTestId: string | null; assignedListeningTestId: string | null;
            assignedReadingTest: { id: string; title: string } | null;
            assignedListeningTest: { id: string; title: string } | null }
  ) {
    const out: Array<{
      type: "READING" | "LISTENING"; testId: string; title: string;
      status: string; score: number | null; bandLabel: string | null; action: string;
    }> = [];
    for (const [type, t] of [
      ["READING", task.assignedReadingTest],
      ["LISTENING", task.assignedListeningTest]
    ] as const) {
      if (!t) continue;
      const [inProgress, result] = await Promise.all([
        this.prisma.testAttempt.findFirst({
          where: { userId, testId: t.id, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" }
        }),
        this.prisma.testResult.findUnique({ where: { userId_testId: { userId, testId: t.id } } })
      ]);
      const status = result ? "Completed" : inProgress ? "In progress" : "Not attempted";
      out.push({
        type, testId: t.id, title: t.title, status,
        score: result?.score ?? null,
        bandLabel: result?.bandLabel ?? null,
        action: result ? "View Result" : inProgress ? "Continue Test" : "Begin Test"
      });
    }
    return out;
  }

  async getToday(userId: string) {
    const sched = await this.requireSchedule(userId);
    const n = this.currentDayNumber(sched);
    if (n === 0) {
      return { state: "NOT_STARTED", startDate: sched.startDate.toISOString().slice(0, 10) };
    }
    if (n < 0) {
      return { state: "REST_DAY", lastDayNumber: Math.abs(n) };
    }
    return { state: "ACTIVE", ...(await this.getDay(userId, n)) };
  }

  async getTimeline(userId: string) {
    const sched = await this.requireSchedule(userId);
    const todayNum = Math.abs(this.currentDayNumber(sched));
    const unlockedThroughDay = await this.computeUnlockedThroughDay(userId, todayNum, sched.totalDays);
    const [tasks, dayProgress, sessions] = await Promise.all([
      this.prisma.dailyTask.findMany({
        where: { isPublished: true }, orderBy: { dayNumber: "asc" },
        select: { dayNumber: true, title: true }
      }),
      this.prisma.cohortDayProgress.findMany({ where: { userId } }),
      this.prisma.cohortSessionRecord.findMany({
        where: { userId }, select: { dayNumber: true, attendance: true }
      })
    ]);
    const progressBy = new Map(dayProgress.map((p) => [p.dayNumber, p]));
    const missedDays = new Set(
      sessions.filter((s) => s.attendance === CohortAttendance.MISSED).map((s) => s.dayNumber)
    );
    return tasks.slice(0, sched.totalDays).map((t) => {
      const d = programmeDayDate(sched.startDate, t.dayNumber, sched.restWeekday);
      const p = progressBy.get(t.dayNumber);
      let label: string;
      if (p?.status === "COMPLETED" || p?.status === "COMPLETED_LATE") label = "Done";
      else if (t.dayNumber === todayNum) label = "Today";
      else if (t.dayNumber < todayNum) label = missedDays.has(t.dayNumber) || (p?.completionPct ?? 0) < 100 ? "Catch-up" : "Done";
      else if (t.dayNumber <= unlockedThroughDay) label = "Available"; // fast-track: unlocked early
      else label = "Upcoming";
      return {
        dayNumber: t.dayNumber, title: t.title,
        date: `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
        label, completionPct: p?.completionPct ?? 0
      };
    });
  }

  // ------------------------------------------------------- join & progress

  async joinSession(userId: string, dayNumber: number, slot: CohortSessionSlot) {
    const sched = await this.requireSchedule(userId);
    await this.ensureSessionRecords(userId, dayNumber);
    const rec = await this.prisma.cohortSessionRecord.findUniqueOrThrow({
      where: { userId_dayNumber_slot: { userId, dayNumber, slot } }
    });
    const todayNum = Math.abs(this.currentDayNumber(sched));
    const unlockedThroughDay = await this.computeUnlockedThroughDay(userId, todayNum, sched.totalDays);
    if (dayNumber > unlockedThroughDay) {
      throw Object.assign(new Error("Finish the current day's classes to unlock this one"), { statusCode: 403 });
    }
    if (!rec.firstJoinedAt && Date.now() >= rec.scheduledAt.getTime() &&
        Date.now() <= rec.scheduledAt.getTime() + this.windowMin * 60 * 1000) {
      await this.prisma.cohortSessionRecord.update({
        where: { id: rec.id }, data: { firstJoinedAt: new Date(), lastActivityAt: new Date() }
      });
    }
    return this.getDay(userId, dayNumber);
  }

  async recordProgress(
    userId: string, dayNumber: number, slot: CohortSessionSlot,
    positionSec: number, activeDeltaSec: number, mode: "live" | "recording" | undefined
  ) {
    const rec = await this.prisma.cohortSessionRecord.findUnique({
      where: { userId_dayNumber_slot: { userId, dayNumber, slot } }
    });
    if (!rec) throw Object.assign(new Error("Session not found"), { statusCode: 404 });

    const now = Date.now();
    const liveWindow =
      now >= rec.scheduledAt.getTime() &&
      now <= rec.scheduledAt.getTime() + this.windowMin * 60 * 1000;
    const isLive = mode ? mode === "live" && liveWindow : liveWindow;

    const durSec = this.defaultDurationMin * 60;
    const data: Prisma.CohortSessionRecordUpdateInput = {
      lastActivityAt: new Date(),
      lastPositionSec: Math.min(positionSec, durSec),
      furthestPositionSec: Math.max(rec.furthestPositionSec, Math.min(positionSec, durSec))
    };
    if (isLive) data.activeWatchSec = { increment: activeDeltaSec };
    else data.recordingWatchSec = { increment: activeDeltaSec };

    let updated = await this.prisma.cohortSessionRecord.update({ where: { id: rec.id }, data });

    // Content completion (separate from attendance): enough active watching,
    // not mere seeking — furthest position AND accumulated watch must qualify.
    const totalWatch = updated.activeWatchSec + updated.recordingWatchSec;
    const requiredSec = (durSec * this.attendMinPct) / 100;
    if (!updated.completedAt && totalWatch >= requiredSec && updated.furthestPositionSec >= requiredSec) {
      updated = await this.prisma.cohortSessionRecord.update({
        where: { id: rec.id }, data: { completedAt: new Date() }
      });
    }
    // Live-window attendance promotion
    if (isLive && updated.attendance === CohortAttendance.UPCOMING) {
      const cls = this.classifyAttendance(updated, this.defaultDurationMin);
      if (cls !== CohortAttendance.MISSED) {
        await this.prisma.cohortSessionRecord.update({
          where: { id: rec.id }, data: { attendance: cls }
        });
      }
    }
    await this.recomputeDayProgress(userId, dayNumber);
    return { ok: true, completed: Boolean(updated.completedAt) };
  }

  // --------------------------------------------------------- day completion

  async recomputeDayProgress(userId: string, dayNumber: number) {
    const sched = await this.requireSchedule(userId);
    const task = await this.prisma.dailyTask.findUnique({ where: { dayNumber } });
    if (!task) return;
    const sessions = await this.prisma.cohortSessionRecord.findMany({
      where: { userId, dayNumber }
    });
    const requirements: boolean[] = [];
    for (const s of sessions) requirements.push(Boolean(s.completedAt));
    for (const testId of [task.assignedReadingTestId, task.assignedListeningTestId]) {
      if (!testId) continue;
      const result = await this.prisma.testResult.findUnique({
        where: { userId_testId: { userId, testId } }
      });
      requirements.push(Boolean(result));
    }
    const doneCount = requirements.filter(Boolean).length;
    const pct = requirements.length ? Math.round((doneCount / requirements.length) * 100) : 0;
    const todayNum = Math.abs(this.currentDayNumber(sched));
    const complete = pct === 100;
    const late = complete && dayNumber < todayNum;
    await this.prisma.cohortDayProgress.upsert({
      where: { userId_dayNumber: { userId, dayNumber } },
      create: {
        userId, dayNumber, completionPct: pct,
        status: complete ? (late ? "COMPLETED_LATE" : "COMPLETED") : dayNumber < todayNum ? "PARTIAL" : "ACTIVE",
        completedAt: complete ? new Date() : null, completedLate: late
      },
      update: {
        completionPct: pct,
        status: complete ? (late ? "COMPLETED_LATE" : "COMPLETED") : dayNumber < todayNum ? "PARTIAL" : "ACTIVE",
        completedAt: complete ? new Date() : undefined, completedLate: late
      }
    });
  }

  // ---------------------------------------------------- pending & metrics

  async getPending(userId: string) {
    const sched = await this.requireSchedule(userId);
    const todayNum = Math.abs(this.currentDayNumber(sched));
    const allPast = await this.prisma.cohortDayProgress.findMany({
      where: { userId, dayNumber: { lt: todayNum } },
      orderBy: { dayNumber: "asc" }
    });
    const incomplete = allPast.filter((d) => d.completionPct < 100);
    // A past day counts as pending if its record is incomplete, OR it has no
    // record at all. Fully-completed days (100%) must never be flagged pending.
    const covered = new Set(allPast.map((d) => d.dayNumber));
    const missingDays: number[] = [];
    for (let n = 1; n < todayNum; n++) if (!covered.has(n)) missingDays.push(n);
    return {
      pendingCount: incomplete.length + missingDays.length,
      days: [
        ...incomplete.map((d) => ({ dayNumber: d.dayNumber, completionPct: d.completionPct })),
        ...missingDays.map((n) => ({ dayNumber: n, completionPct: 0 }))
      ].sort((a, b) => a.dayNumber - b.dayNumber)
    };
  }

  async getAttendanceDashboard(userId: string) {
    const sched = await this.requireSchedule(userId);
    const sessions = await this.prisma.cohortSessionRecord.findMany({
      where: { userId, scheduledAt: { lt: new Date() } },
      orderBy: [{ dayNumber: "desc" }, { slot: "asc" }],
      take: 60
    });
    const past = sessions.filter((s) => s.attendance !== CohortAttendance.UPCOMING ||
      s.scheduledAt.getTime() + this.windowMin * 60000 < Date.now());
    const attended = past.filter((s) =>
      s.attendance === CohortAttendance.ATTENDED || s.attendance === CohortAttendance.LATE).length;
    const missed = past.filter((s) => s.attendance === CohortAttendance.MISSED).length;
    const avgWatchMin = past.length
      ? Math.round(past.reduce((a, s) => a + s.activeWatchSec + s.recordingWatchSec, 0) / past.length / 60)
      : 0;

    // streak: consecutive fully-completed programme days ending at yesterday/today
    const progress = await this.prisma.cohortDayProgress.findMany({
      where: { userId }, orderBy: { dayNumber: "desc" }
    });
    const doneSet = new Set(progress
      .filter((p) => p.status === "COMPLETED" || p.status === "COMPLETED_LATE")
      .map((p) => p.dayNumber));
    const todayNum = Math.abs(this.currentDayNumber(sched));
    let streak = 0;
    for (let n = todayNum - 1; n >= 1; n--) {
      if (doneSet.has(n)) streak++;
      else break;
    }
    if (doneSet.has(todayNum)) streak++;

    const warnings = await this.prisma.cohortWarning.count({ where: { userId, status: "open" } });

    // Class log rows with test scores
    const tasks = await this.prisma.dailyTask.findMany({
      where: { dayNumber: { in: [...new Set(past.map((s) => s.dayNumber))] } },
      select: { dayNumber: true, title: true, assignedReadingTestId: true, assignedListeningTestId: true }
    });
    const taskBy = new Map(tasks.map((t) => [t.dayNumber, t]));
    const log = [];
    for (const s of past.slice(0, 20)) {
      const t = taskBy.get(s.dayNumber);
      const testScore = async (testId: string | null) => {
        if (!testId) return null;
        const r = await this.prisma.testResult.findUnique({
          where: { userId_testId: { userId, testId } }, select: { score: true, bandLabel: true }
        });
        return r ? { score: r.score, band: r.bandLabel } : { score: null, band: null };
      };
      log.push({
        dayNumber: s.dayNumber,
        title: t?.title ?? `Day ${s.dayNumber}`,
        slot: s.slot,
        scheduledLocal: formatLocal(s.scheduledAt, sched.timezone),
        firstJoinedLocal: s.firstJoinedAt ? formatLocal(s.firstJoinedAt, sched.timezone) : null,
        activeWatchMin: Math.round(s.activeWatchSec / 60),
        attendance: s.attendance,
        completed: Boolean(s.completedAt),
        reading: s.slot === CohortSessionSlot.LECTURE ? await testScore(t?.assignedReadingTestId ?? null) : undefined,
        listening: s.slot === CohortSessionSlot.LECTURE ? await testScore(t?.assignedListeningTestId ?? null) : undefined
      });
    }

    return {
      attendanceRate: past.length ? Math.round((attended / past.length) * 100) : 100,
      sessionsAttended: attended,
      sessionsMissed: missed,
      currentStreak: streak,
      avgActiveWatchMin: avgWatchMin,
      warningCount: warnings,
      log
    };
  }

  async listReports(userId: string) {
    return this.prisma.cohortWeeklyReport.findMany({
      where: { userId }, orderBy: { periodStart: "desc" },
      select: { id: true, periodStart: true, periodEnd: true, emailedAt: true }
    });
  }

  async getReport(userId: string, id: string) {
    const r = await this.prisma.cohortWeeklyReport.findFirst({ where: { id, userId } });
    if (!r) throw Object.assign(new Error("Report not found"), { statusCode: 404 });
    return r;
  }

  // ---------------------------------------------------------------- live chat

  /**
   * Guard: a chat thread exists only for a published programme day.
   * Candidates may access it once the day has opened; instructors
   * (ADMIN/STAFF) may access any published day's thread.
   */
  private async requireChatAccess(userId: string, dayNumber: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { role: true }
    });
    if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    const task = await this.prisma.dailyTask.findUnique({
      where: { dayNumber }, select: { isPublished: true }
    });
    if (!task || !task.isPublished) {
      throw Object.assign(new Error("No content mapped for this day"), { statusCode: 404 });
    }
    if (user.role === "ADMIN" || user.role === "STAFF") return;
    const sched = await this.requireSchedule(userId);
    const todayNum = Math.abs(this.currentDayNumber(sched));
    if (dayNumber > todayNum || todayNum === 0) {
      throw Object.assign(new Error("This class hasn't opened yet"), { statusCode: 403 });
    }
  }

  private mapChat(m: {
    id: string; userId: string; authorName: string; role: string; text: string; createdAt: Date;
  }, viewerId: string) {
    return {
      id: m.id,
      authorName: m.authorName,
      role: m.role,
      text: m.text,
      createdAtUtc: m.createdAt.toISOString(),
      mine: m.userId === viewerId
    };
  }

  /**
   * One chat thread per session (dayNumber + slot). Returns messages in send
   * order. `afterIso` fetches only newer messages for efficient polling;
   * without it the most recent {@link limit} are returned.
   */
  async listChat(
    userId: string, dayNumber: number, slot: CohortSessionSlot,
    afterIso?: string, limit = 100
  ) {
    await this.requireChatAccess(userId, dayNumber);
    const after = afterIso ? new Date(afterIso) : null;
    const validAfter = after && !Number.isNaN(after.getTime()) ? after : null;
    if (validAfter) {
      const rows = await this.prisma.cohortChatMessage.findMany({
        where: { dayNumber, slot, createdAt: { gt: validAfter } },
        orderBy: { createdAt: "asc" }, take: 200
      });
      return rows.map((m) => this.mapChat(m, userId));
    }
    // Newest `limit`, then re-sort ascending for display.
    const rows = await this.prisma.cohortChatMessage.findMany({
      where: { dayNumber, slot },
      orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 200)
    });
    return rows.reverse().map((m) => this.mapChat(m, userId));
  }

  async postChat(userId: string, dayNumber: number, slot: CohortSessionSlot, text: string) {
    await this.requireChatAccess(userId, dayNumber);
    const clean = text.trim();
    if (!clean) throw Object.assign(new Error("Message cannot be empty"), { statusCode: 400 });
    if (clean.length > 2000) throw Object.assign(new Error("Message is too long (max 2000)"), { statusCode: 400 });
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { name: true, role: true }
    });
    if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    const created = await this.prisma.cohortChatMessage.create({
      data: { userId, dayNumber, slot, authorName: user.name, role: user.role, text: clean }
    });
    return this.mapChat(created, userId);
  }
}
