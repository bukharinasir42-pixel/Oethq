# PHASE 1 — IMPLEMENTATION AUDIT (OET HQ Cohort Learning System)

## 1. Current architecture
- **Monorepo**: `backend/` (Express 5 + TypeScript, DI via a hand-rolled `AppContainer`, Prisma 6 → PostgreSQL, class-validator DTOs, JWT bearer auth, morgan logging, rate limiting), `frontend/` (Next.js App Router + Tailwind + shadcn, `apiFetch` client with same-origin `/api/[...path]` proxy), `docker/`, `infra/`, `Scripts/`.
- **Video**: Bunny Stream signed embeds via `BunnyPlaybackService.buildEmbedUrl(videoId)` (token + expiry).
- **Email**: `EmailService` with SES / ElasticEmail SMTP providers and Ethereal dev fallback; HTML builders in `email-templates.ts`.
- **Payments**: `StripeService` + `payments`/`subscriptions` modules; Purchase → Subscription with OTP activation (matches the site's "OTP-gated access").
- **No scheduler/queue exists** — no cron, no BullMQ. (Gap.)

## 2. Existing user journey
Checkout (Stripe / manual) → Purchase → Subscription (TRIAL/ACTIVE, `durationDays`) → OTP email activation → `/portal` (sidebar: Dashboard, Study plan, Past papers, Progress, Results, Retake history).

## 3. Existing lecture delivery flow
`DailyTask` (unique `dayNumber`) holds per-day: `lectureTitle/lectureUrl/lectureBunnyVideoId` (**= Daily Lecture**) and `articleTitle/articleUrl/articleBunnyVideoId` (**= Core Skills Session**), plus cheat-sheet and past-paper assets. Served by `TasksService.listForUser` / `/tasks/for-user`, gated by `task-access.utils`.

## 4–5. Existing Reading/Listening test flow
`Test` (+`Question`, `ListeningAudioTrack`) → `TestAttempt` (state machine: IN_PROGRESS → SUBMITTED/AUTO_SUBMITTED, sectioned timing, answersJson) → `TestResult` (**unique per user+test**: score, part scores, bandLabel, passProbability). Fully functional — reused as-is.

## 6. Existing enrolment flow
`Purchase` → `Subscription` (`@@unique([userId, planId])`), plan limits (`readingLimit`, `listeningLimit`, `pastPaperLimit`).

## 7–8. Relevant schema & APIs
Models reused: `User`, `DailyTask`, `Test`, `TestAttempt`, `TestResult`, `Subscription`. Routers reused: tasks, tests, subscriptions, auth. Conventions: router factories over `AppContainer`, `requireAuth(jwtHelper)`, `asyncHandler`, `validateDto`.

## 9. Email & job infrastructure
Email exists (multi-provider). **Job infrastructure missing** → added `CohortJobsService` (in-process interval loop, idempotent via `CohortNotificationLog.refKey` unique key; disable with `COHORT_JOBS_DISABLED`). Safe to later swap for cron/queue without API changes.

## 10. Gap analysis → what was built
| Gap | Delivered |
|---|---|
| No schedule/timezone entity | `CohortSchedule` (+ audited `CohortScheduleChange`) |
| No session occurrences | `CohortSessionRecord` (unique user+day+slot, UTC `scheduledAt`) |
| No attendance vs completion separation | `attendance` enum + separate `completedAt`; recording watch tracked separately |
| No watch-time tracking | throttled heartbeat endpoint; active vs recording seconds; furthest-position anti-seek rule |
| No day completion / catch-up | `CohortDayProgress` + `/cohort/pending` |
| No reminders/warnings/reports | jobs + `CohortNotificationLog`, `CohortWarning`, `CohortWeeklyReport` (frozen JSON snapshots) |
| No cohort UI | `/portal/cohort` page + sidebar item, fully API-driven, zero demo controls |

## 11. Risk register
1. **Single-process jobs**: if backend scales to multiple instances, the `refKey` unique constraint prevents duplicate emails, but move to a real scheduler (pg-boss/BullMQ) for cleanliness. 2. **Session duration** is env-default (45 min) until real durations are stored per lecture (recommended DailyTask column, prospective only). 3. **Timezone math** implemented with Intl (no new deps) — DST covered by two-pass offset; test NZ/UK transitions. 4. **Chat** intentionally deferred: no realtime provider exists in the stack; recommend Phase 6 decision (Pusher/Ably vs. polling) rather than faking it — per master prompt §19. 5. **Uploaded .env files contained live secrets — rotate AWS keys, JWT secrets, SMTP and Stripe keys now**; treat those files as compromised.

## 12–14. Changes delivered
- **DB**: 7 additive tables / 3 enums (`schema-cohort-additions.prisma`, `cohort-migration.sql`). Zero changes to existing tables except 5 relation lines on `User`.
- **APIs** (all under existing auth): `GET /cohort/me`, `POST /cohort/onboarding/timezone`, `POST /cohort/onboarding/schedule`, `GET /cohort/today`, `GET /cohort/days`, `GET /cohort/days/:n`, `POST /cohort/sessions/:n/:slot/join`, `POST /cohort/sessions/:n/:slot/progress`, `GET /cohort/pending`, `GET /cohort/attendance`, `GET /cohort/reports`, `GET /cohort/reports/:id`.
- **Files**: see PATCHES.md — 9 new files + 6 small patches. No existing route renamed, no scoring logic touched, no video duplicated.

## 15. Open questions for the team
1. Should catch-up completion preserve the punctuality streak? (Currently: completes the day, is flagged `completedLate`; streak counts completed days — configurable next.) 2. Real per-lecture durations: add `durationSec` columns to DailyTask? 3. Chat provider preference for Phase 6? 4. Should Sunday rest-day be per-cohort configurable in admin (schema supports `restWeekday` already)?
