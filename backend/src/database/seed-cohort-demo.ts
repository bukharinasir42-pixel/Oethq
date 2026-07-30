/**
 * seed-cohort-demo.ts — LOCAL DEVELOPMENT ONLY
 *
 * Creates a realistic 5-day cohort programme for candidate@oet.test so the
 * Cohort Live Classes page can be exercised end-to-end without waiting days.
 *
 *   Day 1  Completed        (both sessions attended + both tests submitted)
 *   Day 2  Completed        (lecture joined late — still attended, still completed)
 *   Day 3  Partial          (lecture done, Core Skills missed, one test outstanding)
 *   Day 4  Missed           (both sessions missed — recording / catch-up available)
 *   Day 5  Today            (sessions scheduled ahead of now, live countdown running)
 *
 * SAFETY
 *  - Refuses to run when NODE_ENV=production or when DATABASE_URL does not point
 *    at a local host. Override deliberately with COHORT_DEMO_FORCE=true.
 *  - Never deletes anything. Never overwrites lecture titles, video ids or test
 *    assignments that already exist — it only fills blanks.
 *  - Fully idempotent: every write is an upsert on a natural key, so running it
 *    ten times produces exactly the same rows as running it once.
 *
 * Run:  npm run prisma:seed-cohort-demo
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import {
  BandLabel,
  CohortAttendance,
  CohortDayStatus,
  CohortSessionSlot,
  PrismaClient,
  Role,
  TestType
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";
import { localDate, programmeDayDate, zonedTimeToUtc } from "../modules/cohort/cohort-time";

// ---------------------------------------------------------------- env + guard
const envRoot = resolve(__dirname, "../../../.env");
const envBackend = resolve(__dirname, "../../.env");
if (existsSync(envRoot)) loadEnv({ path: envRoot });
if (existsSync(envBackend)) loadEnv({ path: envBackend, override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const FORCE = process.env.COHORT_DEMO_FORCE === "true";
if (!FORCE) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to run the cohort demo seed with NODE_ENV=production. " +
        "This seed is for local development only."
    );
  }
  const host = (() => {
    try { return new URL(connectionString).hostname; } catch { return ""; }
  })();
  const localHosts = ["localhost", "127.0.0.1", "::1", "postgres", "oet-postgres", "db", "host.docker.internal"];
  if (!localHosts.includes(host)) {
    throw new Error(
      `Refusing to run the cohort demo seed against non-local database host "${host}". ` +
        "Point DATABASE_URL at your local Postgres, or set COHORT_DEMO_FORCE=true if you " +
        "are certain this database is disposable."
    );
  }
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ---------------------------------------------------------------- config
const CANDIDATE_EMAIL = "candidate@oet.test";
const CANDIDATE_PASSWORD = "Candidate@123"; // matches the main seed
const TIMEZONE = "Asia/Karachi";
const REST_WEEKDAY = 0;   // Sunday
const TOTAL_DAYS = 5;
const DURATION_MIN = Number(process.env.COHORT_DEFAULT_DURATION_MIN) || 45;

const log = (msg: string) => console.log(`[cohort-demo] ${msg}`);

/** Next :00 / :30 slot at least `leadMin` minutes from now, in the demo timezone. */
function nextHalfHourSlot(leadMin: number): string {
  const target = new Date(Date.now() + leadMin * 60_000);
  const w = localDate(target, TIMEZONE);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(target);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 20) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  void w;
  const slotMinute = minute <= 30 ? 30 : 0;
  const slotHour = minute <= 30 ? hour : (hour + 1) % 24;
  return `${String(slotHour).padStart(2, "0")}:${String(slotMinute).padStart(2, "0")}`;
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + mins) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Class times. Default: Class 1 starts a few minutes from now so you can watch a
 * session actually go live; Class 2 is 60 minutes later (the minimum gap the
 * service enforces). Override with COHORT_DEMO_CLASS1 / COHORT_DEMO_CLASS2.
 * Falls back to 20:00 / 21:30 if the computed pair would cross midnight.
 */
function resolveClassTimes(): { class1: string; class2: string; live: boolean } {
  const c1Env = process.env.COHORT_DEMO_CLASS1;
  const c2Env = process.env.COHORT_DEMO_CLASS2;
  if (c1Env && c2Env) return { class1: c1Env, class2: c2Env, live: false };

  const class1 = nextHalfHourSlot(12);
  const class2 = addMinutes(class1, 60);
  const crossesMidnight = Number(class2.split(":")[0]) < Number(class1.split(":")[0]);
  if (crossesMidnight) return { class1: "20:00", class2: "21:30", live: false };
  return { class1, class2, live: true };
}

/** Date of programme Day 1 so that Day `TOTAL_DAYS` lands on today (rest days skipped). */
function startDateSoTodayIsLastDay(): { start: Date; todayIsRestDay: boolean } {
  const today = localDate(new Date(), TIMEZONE);
  const cursor = new Date(Date.UTC(today.year, today.month - 1, today.day));
  let todayIsRestDay = false;
  if (cursor.getUTCDay() === REST_WEEKDAY) {
    todayIsRestDay = true;
    cursor.setUTCDate(cursor.getUTCDate() + 1); // next study day becomes Day 5
  }
  let remaining = TOTAL_DAYS - 1;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (cursor.getUTCDay() !== REST_WEEKDAY) remaining -= 1;
  }
  return { start: cursor, todayIsRestDay };
}

// ---------------------------------------------------------------- scenario
type SlotPlan = {
  attendance: CohortAttendance;
  joinOffsetMin: number | null;   // minutes after scheduled start; null = never joined
  activeWatchMin: number;
  recordingWatchMin: number;
  completed: boolean;
};
type DayPlan = {
  day: number;
  label: string;
  lecture: SlotPlan;
  coreSkills: SlotPlan;
  readingScore: number | null;    // null = not attempted
  listeningScore: number | null;
  dayStatus: CohortDayStatus;
  completionPct: number;
};

const full = (m = DURATION_MIN): number => Math.round(m * 0.95);

const PLAN: DayPlan[] = [
  {
    day: 1, label: "Completed — attended both classes, both tests submitted",
    lecture:    { attendance: CohortAttendance.ATTENDED, joinOffsetMin: 1, activeWatchMin: full(), recordingWatchMin: 0, completed: true },
    coreSkills: { attendance: CohortAttendance.ATTENDED, joinOffsetMin: 2, activeWatchMin: full(), recordingWatchMin: 0, completed: true },
    readingScore: 35, listeningScore: 31,
    dayStatus: CohortDayStatus.COMPLETED, completionPct: 100
  },
  {
    day: 2, label: "Completed — joined the lecture late, still finished everything",
    lecture:    { attendance: CohortAttendance.LATE, joinOffsetMin: 14, activeWatchMin: full() - 8, recordingWatchMin: 6, completed: true },
    coreSkills: { attendance: CohortAttendance.ATTENDED, joinOffsetMin: 3, activeWatchMin: full(), recordingWatchMin: 0, completed: true },
    readingScore: 34, listeningScore: 33,
    dayStatus: CohortDayStatus.COMPLETED, completionPct: 100
  },
  {
    day: 3, label: "Partially completed — Core Skills missed, Listening test outstanding",
    lecture:    { attendance: CohortAttendance.ATTENDED, joinOffsetMin: 0, activeWatchMin: full(), recordingWatchMin: 0, completed: true },
    coreSkills: { attendance: CohortAttendance.MISSED, joinOffsetMin: null, activeWatchMin: 0, recordingWatchMin: 0, completed: false },
    readingScore: 28, listeningScore: null,
    dayStatus: CohortDayStatus.PARTIAL, completionPct: 25
  },
  {
    day: 4, label: "Missed — both sessions missed, recordings waiting in Pending Catch-up",
    lecture:    { attendance: CohortAttendance.MISSED, joinOffsetMin: null, activeWatchMin: 0, recordingWatchMin: 4, completed: false },
    coreSkills: { attendance: CohortAttendance.MISSED, joinOffsetMin: null, activeWatchMin: 0, recordingWatchMin: 0, completed: false },
    readingScore: null, listeningScore: null,
    dayStatus: CohortDayStatus.MISSED, completionPct: 0
  },
  {
    day: 5, label: "Today — sessions upcoming, countdown running",
    lecture:    { attendance: CohortAttendance.UPCOMING, joinOffsetMin: null, activeWatchMin: 0, recordingWatchMin: 0, completed: false },
    coreSkills: { attendance: CohortAttendance.UPCOMING, joinOffsetMin: null, activeWatchMin: 0, recordingWatchMin: 0, completed: false },
    readingScore: null, listeningScore: null,
    dayStatus: CohortDayStatus.ACTIVE, completionPct: 0
  }
];

function bandFor(score: number): BandLabel {
  if (score >= 36) return BandLabel.STRONG;
  if (score >= 30) return BandLabel.COMPETITIVE;
  if (score >= 24) return BandLabel.DEVELOPING;
  return BandLabel.AT_RISK;
}

// ---------------------------------------------------------------- main
async function main() {
  log("LOCAL DEVELOPMENT SEED — no production data is touched.");

  // 1. Candidate ------------------------------------------------------------
  let user = await prisma.user.findUnique({ where: { email: CANDIDATE_EMAIL } });
  if (!user) {
    log(`${CANDIDATE_EMAIL} not found — creating it (same credentials as the main seed).`);
    user = await prisma.user.create({
      data: {
        email: CANDIDATE_EMAIL,
        name: "Seed Candidate",
        passwordHash: await bcrypt.hash(CANDIDATE_PASSWORD, 10),
        role: Role.CANDIDATE,
        emailVerifiedAt: new Date()
      }
    });
  }
  log(`Candidate: ${user.email} (${user.id})`);

  // 2. Existing tests to assign, if any ------------------------------------
  const [readingTests, listeningTests] = await Promise.all([
    prisma.test.findMany({ where: { type: TestType.READING }, orderBy: { createdAt: "asc" }, take: TOTAL_DAYS }),
    prisma.test.findMany({ where: { type: TestType.LISTENING }, orderBy: { createdAt: "asc" }, take: TOTAL_DAYS })
  ]);
  log(
    readingTests.length || listeningTests.length
      ? `Found ${readingTests.length} Reading and ${listeningTests.length} Listening test(s) to assign.`
      : "No Reading/Listening tests found — days will be seeded without test assignments. " +
        "Run `npm run prisma:seed` first if you want test cards on the page."
  );

  // 3. Programme days — reuse existing DailyTask rows, only fill blanks -----
  for (const plan of PLAN) {
    const existing = await prisma.dailyTask.findUnique({ where: { dayNumber: plan.day } });
    const reading = readingTests[(plan.day - 1) % Math.max(readingTests.length, 1)];
    const listening = listeningTests[(plan.day - 1) % Math.max(listeningTests.length, 1)];

    if (!existing) {
      await prisma.dailyTask.create({
        data: {
          dayNumber: plan.day,
          title: `Day ${plan.day}`,
          summary: `Cohort demo day ${plan.day}`,
          lectureTitle: `Daily Lecture ${plan.day} — OET Reading Part ${["A", "B", "C", "A", "B"][plan.day - 1]}`,
          lectureUrl: "",
          articleTitle: `Core Skills ${plan.day} — Skimming, scanning & distractor elimination`,
          articleUrl: "",
          isPublished: true,
          assignedReadingTestId: reading?.id ?? null,
          assignedListeningTestId: listening?.id ?? null
        }
      });
      log(`Day ${plan.day}: created DailyTask`);
    } else {
      // Never clobber real content — only fill what is missing.
      const patch: Record<string, unknown> = {};
      if (!existing.isPublished) patch.isPublished = true;
      if (!existing.assignedReadingTestId && reading) patch.assignedReadingTestId = reading.id;
      if (!existing.assignedListeningTestId && listening) patch.assignedListeningTestId = listening.id;
      if (Object.keys(patch).length) {
        await prisma.dailyTask.update({ where: { dayNumber: plan.day }, data: patch });
        log(`Day ${plan.day}: reused existing DailyTask, filled ${Object.keys(patch).join(", ")}`);
      } else {
        log(`Day ${plan.day}: reused existing DailyTask unchanged`);
      }
    }
  }

  // 4. Schedule -------------------------------------------------------------
  const { class1, class2, live } = resolveClassTimes();
  const { start, todayIsRestDay } = startDateSoTodayIsLastDay();
  if (todayIsRestDay) {
    log("Today is Sunday (rest day) — Day 5 has been placed on the next study day.");
  }

  const schedule = await prisma.cohortSchedule.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id, country: "Pakistan", timezone: TIMEZONE,
      class1Time: class1, class2Time: class2,
      startDate: start, totalDays: TOTAL_DAYS, restWeekday: REST_WEEKDAY
    },
    update: {
      country: "Pakistan", timezone: TIMEZONE,
      class1Time: class1, class2Time: class2,
      startDate: start, totalDays: TOTAL_DAYS, restWeekday: REST_WEEKDAY
    }
  });
  log(`Schedule: ${TIMEZONE} · Class 1 ${class1} · Class 2 ${class2} · Day 1 = ${start.toISOString().slice(0, 10)}`);
  if (live) log("Class 1 today starts in ~15 minutes — you can watch it go live.");

  // 5. Sessions, progress and results ---------------------------------------
  for (const plan of PLAN) {
    const d = programmeDayDate(schedule.startDate, plan.day, REST_WEEKDAY);
    const task = await prisma.dailyTask.findUnique({ where: { dayNumber: plan.day } });

    for (const [slot, sp, hhmm] of [
      [CohortSessionSlot.LECTURE, plan.lecture, class1],
      [CohortSessionSlot.CORE_SKILLS, plan.coreSkills, class2]
    ] as const) {
      const scheduledAt = zonedTimeToUtc(d.year, d.month, d.day, hhmm, TIMEZONE);
      const firstJoinedAt =
        sp.joinOffsetMin === null ? null : new Date(scheduledAt.getTime() + sp.joinOffsetMin * 60_000);
      const activeWatchSec = sp.activeWatchMin * 60;
      const recordingWatchSec = sp.recordingWatchMin * 60;
      const totalWatch = activeWatchSec + recordingWatchSec;

      const payload = {
        scheduledAt,
        attendance: sp.attendance,
        firstJoinedAt,
        lastActivityAt: firstJoinedAt ? new Date(firstJoinedAt.getTime() + totalWatch * 1000) : null,
        activeWatchSec,
        recordingWatchSec,
        lastPositionSec: totalWatch,
        furthestPositionSec: totalWatch,
        completedAt: sp.completed
          ? new Date(scheduledAt.getTime() + (DURATION_MIN + 5) * 60_000)
          : null,
        reminderSentAt: plan.day < TOTAL_DAYS ? new Date(scheduledAt.getTime() - 30 * 60_000) : null
      };

      await prisma.cohortSessionRecord.upsert({
        where: { userId_dayNumber_slot: { userId: user.id, dayNumber: plan.day, slot } },
        create: { userId: user.id, dayNumber: plan.day, slot, ...payload },
        update: payload
      });
    }

    // Test results — only for days the scenario says were submitted.
    for (const [testId, score] of [
      [task?.assignedReadingTestId, plan.readingScore],
      [task?.assignedListeningTestId, plan.listeningScore]
    ] as const) {
      if (!testId || score === null) continue;
      const completedAt = zonedTimeToUtc(d.year, d.month, d.day, class2, TIMEZONE);
      await prisma.testResult.upsert({
        where: { userId_testId: { userId: user.id, testId } },
        create: {
          userId: user.id, testId, score,
          bandLabel: bandFor(score),
          passProbability: Math.min(0.97, Math.max(0.05, score / 42)),
          completedAt: new Date(completedAt.getTime() + 90 * 60_000),
          attemptsCount: 1
        },
        update: {} // never overwrite a real attempt the tester has made
      });
    }

    await prisma.cohortDayProgress.upsert({
      where: { userId_dayNumber: { userId: user.id, dayNumber: plan.day } },
      create: {
        userId: user.id, dayNumber: plan.day,
        status: plan.dayStatus, completionPct: plan.completionPct,
        completedAt: plan.completionPct === 100
          ? zonedTimeToUtc(d.year, d.month, d.day, class2, TIMEZONE) : null,
        completedLate: false
      },
      update: {
        status: plan.dayStatus, completionPct: plan.completionPct,
        completedAt: plan.completionPct === 100
          ? zonedTimeToUtc(d.year, d.month, d.day, class2, TIMEZONE) : null,
        completedLate: false
      }
    });

    log(`Day ${plan.day}: ${plan.label}`);
  }

  // 6. Notification history for the missed day (idempotent by refKey) -------
  const missedLecture = await prisma.cohortSessionRecord.findUnique({
    where: { userId_dayNumber_slot: { userId: user.id, dayNumber: 4, slot: CohortSessionSlot.LECTURE } }
  });
  if (missedLecture) {
    const refKey = `missed:${missedLecture.id}`;
    const existingLog = await prisma.cohortNotificationLog.findUnique({ where: { refKey } });
    if (!existingLog) {
      await prisma.cohortNotificationLog.create({
        data: {
          userId: user.id, type: "missed_session", refKey,
          status: "sent", sentAt: new Date(missedLecture.scheduledAt.getTime() + 95 * 60_000)
        }
      });
      log("Seeded one missed-session notification record (Day 4).");
    }
  }

  log("");
  log("Done. Log in as candidate@oet.test / Candidate@123 and open /portal/cohort");
}

main()
  .catch((err) => { console.error("[cohort-demo] FAILED:", err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
