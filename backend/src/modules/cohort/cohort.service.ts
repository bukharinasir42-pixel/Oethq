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
  CohortScheduleMode,
  CohortSessionSlot,
  Prisma
} from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";
import type { BunnyPlaybackService } from "../media/bunny-playback.service";
import {
  dayNumberOnDate, formatLocal, hhmmValid, isValidTimeZone, localDate, minutesOf,
  nextClassDayAfter, programmeDayDate, zonedTimeToUtc
} from "./cohort-time";

/** Exactly this many class days a week, for a student on the picker. */
export const CLASS_DAYS_PER_WEEK = 4;

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
] as const;

export type ClassDayInput = { weekday: number; class1Time: string; class2Time: string };

/**
 * A schedule plus the class-day rows the calendar is derived from. Both modes
 * are normalised through `classWeekdaysOf`/`timesForWeekday` so nothing below
 * this line has to know which mode it is dealing with.
 */
type ScheduleWithDays = Prisma.CohortScheduleGetPayload<{ include: { classDays: true } }>;

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

  // ------------------------------------------------------- calendar shape

  /**
   * The weekdays this student has class on. A PICK_FOUR student has exactly the
   * four they chose; a legacy student has every day except their rest day.
   *
   * Falls back to the legacy set if a PICK_FOUR schedule somehow has no rows —
   * an empty set would mean "no class ever", which would strand the student.
   */
  private classWeekdaysOf(sched: ScheduleWithDays): Set<number> {
    if (sched.mode === CohortScheduleMode.PICK_FOUR && sched.classDays.length > 0) {
      return new Set(sched.classDays.map((d) => d.weekday));
    }
    const all = new Set([0, 1, 2, 3, 4, 5, 6]);
    all.delete(sched.restWeekday);
    return all;
  }

  /**
   * Both classes of a programme day run on that one calendar date, so Core
   * Skills has to come after the Daily Lecture *on the clock*, not merely far
   * enough from it.
   *
   * The old check measured the wrapping distance between the two times, which
   * treats 23:00 and 00:30 as 90 minutes apart. They are — but only across
   * midnight, and since both slots are scheduled onto the same date, that pair
   * put Core Skills 22.5 hours BEFORE the lecture. Measuring forward only makes
   * the ordering the thing being enforced.
   */
  private assertClassPair(class1Time: string, class2Time: string, where = "") {
    const suffix = where ? ` on ${where}` : "";
    if (!hhmmValid(class1Time) || !hhmmValid(class2Time)) {
      throw Object.assign(new Error(`Times must be HH:mm${suffix}`), { statusCode: 400 });
    }
    const gap = minutesOf(class2Time) - minutesOf(class1Time);
    if (gap <= 0) {
      throw Object.assign(
        new Error(`Core Skills must start after the lecture${suffix} — both classes run on the same day`),
        { statusCode: 400 }
      );
    }
    if (gap < this.minGapMin) {
      throw Object.assign(
        new Error(`Keep at least ${this.minGapMin} minutes between the two classes${suffix}`),
        { statusCode: 400 }
      );
    }
  }

  /** The two class times that apply on a given weekday. */
  private timesForWeekday(sched: ScheduleWithDays, weekday: number): { class1Time: string; class2Time: string } {
    const picked = sched.classDays.find((d) => d.weekday === weekday);
    if (picked) return { class1Time: picked.class1Time, class2Time: picked.class2Time };
    return { class1Time: sched.class1Time, class2Time: sched.class2Time };
  }

  /** The local calendar date of a programme day, under this student's calendar. */
  private dateOfDay(sched: ScheduleWithDays, dayNumber: number) {
    return programmeDayDate(sched.startDate, sched.startDayNumber, dayNumber, this.classWeekdaysOf(sched));
  }

  /** UTC instant a given day+slot starts at, using that weekday's own times. */
  private scheduledAtFor(sched: ScheduleWithDays, dayNumber: number, slot: CohortSessionSlot): Date {
    const d = this.dateOfDay(sched, dayNumber);
    const weekday = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
    const times = this.timesForWeekday(sched, weekday);
    const hhmm = slot === CohortSessionSlot.LECTURE ? times.class1Time : times.class2Time;
    return zonedTimeToUtc(d.year, d.month, d.day, hhmm, sched.timezone);
  }

  // ---------------------------------------------------------------- onboarding

  async getMe(userId: string) {
    const schedule = await this.prisma.cohortSchedule.findUnique({
      where: { userId },
      include: {
        changes: { orderBy: { changedAt: "desc" }, take: 5 },
        classDays: { orderBy: { weekday: "asc" } }
      }
    });
    const totalPublishedDays = await this.prisma.dailyTask.count({ where: { isPublished: true } });
    const needsClassDays =
      Boolean(schedule) && schedule!.mode === CohortScheduleMode.PICK_FOUR && schedule!.classDays.length === 0;
    return {
      // Timezone alone is no longer enough to be onboarded — a PICK_FOUR student
      // has not finished until they have chosen their four days.
      onboarded: Boolean(schedule) && !needsClassDays,
      schedule: schedule && {
        country: schedule.country,
        timezone: schedule.timezone,
        mode: schedule.mode,
        classDays: schedule.classDays.map((d) => ({
          weekday: d.weekday, class1Time: d.class1Time, class2Time: d.class2Time
        })),
        classDaysPerWeek: CLASS_DAYS_PER_WEEK,
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
      const moved = existing.timezone !== timezone;
      if (moved) {
        await this.prisma.cohortScheduleChange.create({
          data: { scheduleId: existing.id, field: "timezone", oldValue: existing.timezone, newValue: timezone }
        });
      }
      const updated = await this.prisma.cohortSchedule.update({
        where: { userId }, data: { country, timezone }
      });
      if (moved) {
        // Sessions store an absolute instant, so a student who moves country
        // would keep sitting classes at the old zone's clock — an 8pm class
        // becoming 4pm after a move to London. The promise on the onboarding
        // screen is "every class runs in your local time", so re-derive the
        // upcoming ones against the new zone. Days already taught stay put,
        // which is the same rule as changing class days.
        await this.rescheduleUpcoming(userId).catch(() => undefined);
      }
      return updated;
    }
    // startDate = tomorrow in the student's timezone (Day 1)
    const nowLocal = localDate(new Date(), timezone);
    const start = new Date(Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day));
    start.setUTCDate(start.getUTCDate() + 1);
    const totalDays = Math.max(1, await this.prisma.dailyTask.count({ where: { isPublished: true } })) || 40;
    return this.prisma.cohortSchedule.create({
      data: {
        userId, country, timezone,
        mode: CohortScheduleMode.PICK_FOUR,
        class1Time: "20:00", class2Time: "21:30", // unused by PICK_FOUR; kept for the legacy columns
        startDate: start, startDayNumber: 1, totalDays
      }
    });
  }

  // ------------------------------------------------------------- class days

  /**
   * Set (or change) the four weekdays a student has class on, each with its own
   * pair of times.
   *
   * Changing them never disturbs a day that has already been taught. Instead of
   * re-laying the calendar from Day 1, the schedule is re-anchored: the next
   * unstudied day is pinned to the next chosen weekday, and everything before it
   * keeps the dates it ran on. That is why `startDate` means "the date of
   * `startDayNumber`" rather than "the date of Day 1".
   */
  async saveClassDays(userId: string, days: ClassDayInput[]) {
    const existing = await this.prisma.cohortSchedule.findUnique({
      where: { userId }, include: { classDays: true }
    });
    if (!existing) {
      throw Object.assign(new Error("Complete the timezone step first"), { statusCode: 400 });
    }
    if (existing.mode !== CohortScheduleMode.PICK_FOUR) {
      throw Object.assign(
        new Error("Your programme runs on the six-day schedule — change your class times instead"),
        { statusCode: 409 }
      );
    }

    const weekdays = days.map((d) => d.weekday);
    if (days.length !== CLASS_DAYS_PER_WEEK) {
      throw Object.assign(
        new Error(`Choose exactly ${CLASS_DAYS_PER_WEEK} class days`), { statusCode: 400 }
      );
    }
    if (new Set(weekdays).size !== weekdays.length) {
      throw Object.assign(new Error("Each class day must be a different weekday"), { statusCode: 400 });
    }
    for (const d of days) {
      if (!Number.isInteger(d.weekday) || d.weekday < 0 || d.weekday > 6) {
        throw Object.assign(new Error("Weekday must be 0 (Sunday) to 6 (Saturday)"), { statusCode: 400 });
      }
      this.assertClassPair(d.class1Time, d.class2Time, WEEKDAY_NAMES[d.weekday]);
    }

    const isFirstTime = existing.classDays.length === 0;
    const before = [...existing.classDays]
      .sort((a, b) => a.weekday - b.weekday)
      .map((d) => `${WEEKDAY_NAMES[d.weekday]} ${d.class1Time}/${d.class2Time}`)
      .join(", ");
    const after = [...days]
      .sort((a, b) => a.weekday - b.weekday)
      .map((d) => `${WEEKDAY_NAMES[d.weekday]} ${d.class1Time}/${d.class2Time}`)
      .join(", ");

    // Re-anchor BEFORE the rows change, so "the day they have reached" is read
    // off the calendar they have actually been studying.
    let startDate = existing.startDate;
    let startDayNumber = existing.startDayNumber;
    if (!isFirstTime && before !== after) {
      const live = await this.requireSchedule(userId);
      const reached = Math.abs(this.currentDayNumber(live));
      if (reached > 0) {
        // Write out every day up to the one they have reached FIRST. A session
        // record stores the instant it was scheduled for, and the timeline reads
        // that in preference to recomputing — so this is what actually pins the
        // past in place. Without it, a day the student never opened would be
        // recomputed against the new weekdays and appear to move.
        await this.pinHistory(live, reached);

        const newWeekdays = new Set(weekdays);
        const today = localDate(new Date(), existing.timezone);
        const next = nextClassDayAfter(today, newWeekdays);
        startDate = new Date(Date.UTC(next.year, next.month - 1, next.day));
        startDayNumber = reached + 1; // days up to `reached` keep the dates they ran on
      }
    }

    // Replace-all under a unique (scheduleId, weekday). Two saves landing at once
    // — a double-clicked Save button — can interleave delete and create and trip
    // that constraint. Losing the race is not the student's problem, so retry
    // once and let last-write-win rather than showing them a server error.
    const write = () => this.prisma.$transaction([
      this.prisma.cohortClassDay.deleteMany({ where: { scheduleId: existing.id } }),
      this.prisma.cohortClassDay.createMany({
        data: days.map((d) => ({
          scheduleId: existing.id, weekday: d.weekday,
          class1Time: d.class1Time, class2Time: d.class2Time
        }))
      }),
      this.prisma.cohortSchedule.update({
        where: { id: existing.id }, data: { startDate, startDayNumber }
      }),
      ...(isFirstTime || before === after
        ? []
        : [this.prisma.cohortScheduleChange.create({
            data: { scheduleId: existing.id, field: "classDays", oldValue: before, newValue: after }
          })])
    ]);
    try {
      await write();
    } catch (e) {
      const raced =
        e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034");
      if (!raced) throw e;
      await write();
    }

    if (!isFirstTime && before !== after) await this.rescheduleUpcoming(userId);
    return this.getMe(userId);
  }

  /**
   * Freeze days 1..throughDay onto the calendar currently in force, by creating
   * any session record that does not exist yet. Existing records are never
   * moved, so a day the student actually sat keeps the instant it ran at.
   */
  private async pinHistory(sched: ScheduleWithDays, throughDay: number) {
    const last = Math.min(throughDay, sched.totalDays);
    for (let dayNumber = 1; dayNumber <= last; dayNumber++) {
      for (const slot of [CohortSessionSlot.LECTURE, CohortSessionSlot.CORE_SKILLS] as const) {
        await this.prisma.cohortSessionRecord.upsert({
          where: { userId_dayNumber_slot: { userId: sched.userId, dayNumber, slot } },
          create: {
            userId: sched.userId, dayNumber, slot,
            scheduledAt: this.scheduledAtFor(sched, dayNumber, slot)
          },
          update: {}
        });
      }
    }
  }

  /**
   * Move still-upcoming sessions onto the current calendar. Sessions inside the
   * next two hours are left alone — a student should not find a class they are
   * about to sit down for has moved under them.
   */
  private async rescheduleUpcoming(userId: string) {
    const sched = await this.requireSchedule(userId);
    const cutoff = new Date(Date.now() + 2 * 60 * 60 * 1000);
    // Days at or before the one the student has reached are history and must not
    // move, whatever instant their record happens to hold. Filtering on the clock
    // alone is not enough: a re-anchored schedule can leave an old day carrying a
    // future timestamp, and that day would otherwise be dragged onto the new
    // calendar — exactly the "my finished classes moved" bug this guards against.
    const reached = Math.abs(this.currentDayNumber(sched));
    const upcoming = await this.prisma.cohortSessionRecord.findMany({
      where: {
        userId,
        attendance: CohortAttendance.UPCOMING,
        scheduledAt: { gt: cutoff },
        dayNumber: { gt: reached }
      }
    });
    for (const s of upcoming) {
      await this.prisma.cohortSessionRecord.update({
        where: { id: s.id },
        data: { scheduledAt: this.scheduledAtFor(sched, s.dayNumber, s.slot), reminderSentAt: null }
      });
    }
  }

  async saveScheduleTimes(userId: string, class1Time: string, class2Time: string) {
    // Same ordering rule as the picker: the six-day programme also puts both
    // classes on one date, so it had the same midnight-crossing hole.
    this.assertClassPair(class1Time, class2Time);
    const existing = await this.prisma.cohortSchedule.findUnique({
      where: { userId }, include: { classDays: true }
    });
    if (!existing) {
      throw Object.assign(new Error("Complete the timezone step first"), { statusCode: 400 });
    }
    if (existing.mode === CohortScheduleMode.PICK_FOUR) {
      throw Object.assign(
        new Error("Set your times against each of your class days instead"), { statusCode: 409 }
      );
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
    await this.rescheduleUpcoming(userId);
    return updated;
  }

  // ------------------------------------------------------- session records

  /** Idempotently ensure the two session records for a programme day exist. */
  async ensureSessionRecords(userId: string, dayNumber: number) {
    const sched = await this.requireSchedule(userId);
    for (const slot of [CohortSessionSlot.LECTURE, CohortSessionSlot.CORE_SKILLS] as const) {
      await this.prisma.cohortSessionRecord.upsert({
        where: { userId_dayNumber_slot: { userId, dayNumber, slot } },
        create: { userId, dayNumber, slot, scheduledAt: this.scheduledAtFor(sched, dayNumber, slot) },
        update: {} // never move past/locked sessions here
      });
    }
  }

  private async requireSchedule(userId: string): Promise<ScheduleWithDays> {
    const sched = await this.prisma.cohortSchedule.findUnique({
      where: { userId }, include: { classDays: { orderBy: { weekday: "asc" } } }
    });
    if (!sched) {
      throw Object.assign(new Error("Cohort onboarding not completed"), { statusCode: 409 });
    }
    if (sched.mode === CohortScheduleMode.PICK_FOUR && sched.classDays.length === 0) {
      throw Object.assign(new Error("Choose your class days to start the programme"), { statusCode: 409 });
    }
    // Always track the LIVE published-day count so admin add/remove/publish of days
    // reflects instantly for every enrolled student, regardless of their onboarding
    // snapshot. (Timeline, "today" and unlocks all key off sched.totalDays.)
    const livePublishedDays = await this.prisma.dailyTask.count({ where: { isPublished: true } });
    sched.totalDays = Math.max(1, livePublishedDays);
    return sched;
  }

  /**
   * Which programme day is "today" in the student's timezone?
   * 0 = before Day 1; negative = today is a rest day and |value| was the last
   * class day. Capped at the number of published days.
   */
  currentDayNumber(sched: ScheduleWithDays): number {
    const today = localDate(new Date(), sched.timezone);
    const n = dayNumberOnDate(sched.startDate, sched.startDayNumber, today, this.classWeekdaysOf(sched));
    if (n === 0) return 0;
    const capped = Math.min(Math.abs(n), sched.totalDays);
    return n < 0 ? -capped : capped;
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
      // MISSED belongs here: the card already tells the student "recording
      // available" and offers Watch Recording, so withholding the URL only
      // produced an empty player. Missing a class costs attendance, not access.
      const playable = ["AVAILABLE", "IN_PROGRESS", "MISSED", "RECORDING_AVAILABLE", "COMPLETED"].includes(state);
      // A lecture may be held either as a Bunny video or as a plain URL. Only the
      // Bunny case used to produce a playable URL, so a class uploaded as a link
      // showed an empty player with nothing to click — for the Core Skills slot
      // especially, which is more often a direct upload.
      const directUrl = (isLecture ? task.lectureUrl : task.articleUrl)?.trim() || null;
      let embedUrl: string | null = null;
      if (playable) {
        if (bunnyId) {
          try { embedUrl = this.bunny.buildEmbedUrl(bunnyId, { autoplay: false }).url; }
          catch { embedUrl = directUrl; }
        } else {
          embedUrl = directUrl;
        }
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
        where: { userId }, select: { dayNumber: true, attendance: true, scheduledAt: true }
      })
    ]);
    const progressBy = new Map(dayProgress.map((p) => [p.dayNumber, p]));
    const missedDays = new Set(
      sessions.filter((s) => s.attendance === CohortAttendance.MISSED).map((s) => s.dayNumber)
    );
    // A day that already has a session ran on whatever date that session was
    // scheduled for. Recomputing it would rewrite history every time a student
    // changes their class days, so the stored instant wins where we have one.
    const actualDate = new Map<number, string>();
    for (const s of sessions) {
      const w = localDate(s.scheduledAt, sched.timezone);
      actualDate.set(s.dayNumber, `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`);
    }
    return tasks.slice(0, sched.totalDays).map((t) => {
      const d = this.dateOfDay(sched, t.dayNumber);
      const p = progressBy.get(t.dayNumber);
      let label: string;
      if (p?.status === "COMPLETED" || p?.status === "COMPLETED_LATE") label = "Done";
      else if (t.dayNumber === todayNum) label = "Today";
      else if (t.dayNumber < todayNum) label = missedDays.has(t.dayNumber) || (p?.completionPct ?? 0) < 100 ? "Catch-up" : "Done";
      else if (t.dayNumber <= unlockedThroughDay) label = "Available"; // fast-track: unlocked early
      else label = "Upcoming";
      return {
        dayNumber: t.dayNumber, title: t.title,
        date: actualDate.get(t.dayNumber)
          ?? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
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
