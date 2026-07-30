# LOCAL TESTING — Cohort Live Classes

Everything below runs on your machine, against a local Postgres. No production
data, no real emails (Ethereal catches them and prints a preview link).

---

## 1. What is dynamic vs. what is configuration

**Dynamic (comes from the database, changes per student, zero code edits):**

| Thing | Source |
|---|---|
| Programme days, titles, lecture videos, core-skills videos | `DailyTask` rows (your existing admin task-builder) |
| Which Reading / Listening test is assigned to a day | `DailyTask.assignedReadingTestId` / `assignedListeningTestId` |
| Number of programme days | count of published `DailyTask` rows — not hardcoded to 40 |
| Country, timezone, both class times, start date | `CohortSchedule` per student |
| Session times in UTC, attendance, watch seconds, completion | `CohortSessionRecord` per student per day per slot |
| Day completion %, catch-up list, streak | `CohortDayProgress` computed from real records |
| Warnings, weekly reports | `CohortWarning`, `CohortWeeklyReport` (frozen snapshots) |
| Video URLs | generated live by your existing `BunnyPlaybackService` |
| Test scores shown on cards and in the log | your existing `TestResult` table |

**Configuration (env vars — tune without touching code):** attendance
threshold, late grace, attendance window, minimum gap between classes,
reminder lead time, assumed session duration, job tick interval.

**Hardcoded:** nothing about a student, a date, a score, a test, or a video.
The only fixed values are the two session slots (Daily Lecture / Core Skills),
which mirror the two video fields that already exist on `DailyTask`.

---

## 2. Environment variables

Append to **`backend/.env`** (file `backend/.env.cohort.additions` in the zip
has these ready to copy):

```env
COHORT_ATTEND_MIN_PCT=60          # % of session that must be actively watched to count as Attended
COHORT_LATE_GRACE_MIN=10          # join after this many minutes = "Late" instead of "Attended"
COHORT_ATTENDANCE_WINDOW_MIN=90   # live window; after this the session closes as Attended/Missed
COHORT_MIN_GAP_MIN=60             # minimum gap the student must leave between Class 1 and Class 2
COHORT_REMINDER_LEAD_MIN=30       # reminder email lead time; also the "starting soon" threshold
COHORT_DEFAULT_DURATION_MIN=45    # assumed lecture length until real durations are stored
COHORT_JOB_TICK_MS=300000         # background job loop = every 5 minutes
# COHORT_JOBS_DISABLED=true       # set true in CI / when running tests
FRONTEND_ORIGIN=http://localhost:3000   # used to build links inside emails
```

Everything else the cohort layer needs (`DATABASE_URL`, `JWT_ACCESS_SECRET`,
SMTP, Bunny) you already have.

**Before anything else: rotate the secrets that were in the .env files you
shared** — AWS access key + secret, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`OTP_SECRET`, SMTP password, Stripe keys. Use fresh values locally too.

---

## 3. Start the stack

```bash
# 1) database
cd docker && docker compose up -d postgres

# 2) backend deps + schema  (no new npm packages — the cohort layer adds zero dependencies)
cd ../backend
npm install
npm run prisma:generate
npm run prisma:migrate -- --name add_cohort_layer      # creates the 7 cohort tables
npm run prisma:seed                                    # seeds users, plans, tests

# 3) run the API
npm run dev                                            # http://localhost:4000

# 4) frontend, in a second terminal
cd ../frontend
npm install
npm run dev                                            # http://localhost:3000
```

Frontend `.env.local` needs:
```env
NEXT_PUBLIC_API_BASE=http://localhost:4000
```

Seeded login: **candidate@oet.test / Candidate@123** (admin: admin@oet.test /
Admin@123).

If the API starts correctly you'll see the jobs announce themselves:
```
[CohortJobs] Cohort jobs started (every 300s)
```

---

## 4. Make sure programme content exists

The cohort page reads `DailyTask`. If your local DB has no days yet, create the
40-day scaffold with the existing admin endpoint, then fill Day 1 in the admin
task-builder (`/admin/task-builder`) with a Bunny video id for the lecture, one
for core skills, and pick an assigned Reading + Listening test.

```bash
curl -X POST http://localhost:4000/tasks/ensure-template \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

A day with no mapped content returns a clean "No content mapped for this day"
state rather than a blank panel — that's intentional.

---

## 5. Walk the student flow

1. Log in as the candidate → the sidebar now shows **Cohort live classes**
   directly under Dashboard. Click it.
2. The two-step setup modal appears (it only appears when the student has no
   schedule). Pick **Pakistan → Asia/Karachi**, then two class times.
3. You land on the cohort page: day timeline, two session cards showing
   "Class starts at …" with a live countdown, assigned test cards below.

Verify persistence:
```bash
curl http://localhost:4000/cohort/me -H "Authorization: Bearer <TOKEN>"
curl http://localhost:4000/cohort/today -H "Authorization: Bearer <TOKEN>"
```
`scheduledAtUtc` should be the correct UTC instant for the local time you chose
(8:00 PM Karachi = 15:00 UTC).

---

## 6. Fast-forward time instead of waiting

You do **not** need to wait until 8 PM. Two ways:

**Easiest — move the class to two minutes from now.** Re-run onboarding step 2
(or `POST /cohort/onboarding/schedule`) with a time a couple of minutes ahead.
Future sessions get rescheduled automatically and the reminder flag resets.

**Or shorten the clock** in `backend/.env`, then restart the API:
```env
COHORT_JOB_TICK_MS=20000          # jobs run every 20 seconds
COHORT_REMINDER_LEAD_MIN=3        # reminder fires 3 minutes before
COHORT_ATTENDANCE_WINDOW_MIN=5    # window closes 5 minutes after start
COHORT_ATTEND_MIN_PCT=1           # 1% watch counts as attended, so you don't sit through 27 minutes
COHORT_DEFAULT_DURATION_MIN=2
```
With these you can watch a full lifecycle — upcoming → reminder → live → join →
attended → window closes → next day — in about ten minutes.

---

## 7. The seven things worth verifying

1. **Session unlocks at the right local time.** Player stays locked before the
   time, unlocks exactly at it. Change the timezone to `Pacific/Auckland` and
   confirm the same wall-clock time produces a different UTC instant.
2. **Refresh doesn't reset progress.** Start watching, wait ~40 seconds,
   refresh. The card still shows your watch % and resumes.
3. **Attendance ≠ completion.** Let the window close without joining →
   attendance goes `MISSED`. Then watch the recording fully → the session shows
   Completed and leaves Pending Catch-up, but the class log still reads
   ✗ Missed. That's the rule, working.
4. **Reminders don't duplicate.** Restart the API repeatedly around a reminder
   window. Exactly one row per session in `CohortNotificationLog`, because
   `refKey` is unique:
   ```sql
   SELECT type, "refKey", status, "sentAt" FROM "CohortNotificationLog" ORDER BY "createdAt" DESC LIMIT 10;
   ```
5. **Test scores flow through.** Click Begin Test on the assigned Reading test,
   submit it through your existing engine, come back — the card shows the score
   and the day's completion % moves. No new attempt records are created by the
   cohort page.
6. **Nobody can read anyone else's data.** With candidate A's token, call
   `/cohort/attendance` — you only ever get your own rows; every query is scoped
   by the token's user id, and no endpoint accepts a userId from the client.
7. **Existing flows still work.** Study plan, Past papers, Progress, Results,
   Retake history, admin task-builder, checkout — all untouched.

---

## 8. Where the emails go locally

With no SMTP configured, `EmailService` falls back to Ethereal and logs a
preview URL to the API console. Open the URL to read the exact reminder,
missed-session, warning, or weekly-report email. `cohort-emails-preview.html`
shows the same four emails rendered side by side.

To see a weekly report immediately, temporarily change the local-Monday check in
`generateWeeklyReports` (`nowLocal.weekday !== 1`) to today's weekday number,
restart, wait one tick, then check:
```sql
SELECT "periodStart", data FROM "CohortWeeklyReport" ORDER BY "createdAt" DESC LIMIT 1;
```
Revert afterwards.

---

## 9. Rolling back

The migration only adds tables and three enums — nothing existing is altered, so
a rollback is:

```sql
DROP TABLE "CohortWeeklyReport", "CohortWarning", "CohortNotificationLog",
           "CohortDayProgress", "CohortSessionRecord", "CohortScheduleChange",
           "CohortSchedule";
DROP TYPE "CohortDayStatus", "CohortAttendance", "CohortSessionSlot";
```
Plus: remove the cohort router line from `create-app.ts`, the two container
entries, the `start()` call in `server.ts`, the sidebar link, and the five
relation lines on `User`. Student data in existing tables is never touched.
