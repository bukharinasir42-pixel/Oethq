# OET LMS API — HTTP route catalog

This file lists every HTTP route exposed by the **Express** server in `src/server.ts` and maps it to domain code under `src/modules/**`.

**Total routes:** 57

**Status:** `http` — handled in-process (`src/http/routes/*.router.ts`, `src/app.ts`).

Domain logic is plain TypeScript services; there is no NestJS in this repository.

---

## Root — [`src/system.service.ts`](src/system.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/health` | http | |
| GET | `/health/live` | http | |
| GET | `/health/ready` | http | |
| GET | `/metrics` | http | Prometheus text |

---

## Auth — prefix `/auth` — [`src/modules/auth/auth.service.ts`](src/modules/auth/auth.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/auth/register` | http | Rate limit: auth-register — creates account, emails OTP, no JWT until verify |
| POST | `/auth/login` | http | Rate limit: auth-login — candidates must verify email first (`requiresOtp`) |
| POST | `/auth/otp/verify` | http | Rate limit: auth-otp — marks email verified, returns JWT |
| POST | `/auth/otp/resend` | http | Rate limit: auth-otp-resend |
| GET | `/auth/activation/:token` | http | Public — purchase activation link details |
| POST | `/auth/activation/verify` | http | OTP starts 60-day access window (candidates) |
| POST | `/auth/activation/resend` | http | Resend purchase activation OTP |
| GET | `/auth/me` | http | JWT |

Browser **GET** `/auth/login` and **GET** `/auth/register` on the API host **302** to the Next app (`NEXT_PUBLIC_APP_URL`).

---

## Users — prefix `/users` — [`src/modules/users/users.service.ts`](src/modules/users/users.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/users` | http | JWT + admin |
| GET | `/users/overview` | http | JWT + admin |
| GET | `/users/subscribed` | http | JWT + admin |
| POST | `/users/custom` | http | JWT + admin; rate limit: users-custom |
| GET | `/users/:id/progress` | http | JWT (self or admin) |

---

## Grading — prefix `/grading` — [`src/modules/grading/grading.service.ts`](src/modules/grading/grading.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/grading/bands` | http | Public |

---

## Tasks — prefix `/tasks` — [`src/modules/tasks/tasks.service.ts`](src/modules/tasks/tasks.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/tasks` | http | JWT |
| GET | `/tasks/for-user` | http | JWT; `?userId=` |
| POST | `/tasks/ensure-template` | http | JWT |
| PUT | `/tasks/:dayNumber` | http | JWT |

---

## Audit — prefix `/audit-logs` — [`src/modules/audit/audit.service.ts`](src/modules/audit/audit.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/audit-logs` | http | JWT + admin |

---

## Tests — prefix `/tests` — [`src/modules/tests/tests.service.ts`](src/modules/tests/tests.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/tests` | http | Public list |
| GET | `/tests/stats` | http | JWT + admin |
| GET | `/tests/admin` | http | JWT + admin |
| GET | `/tests/results/mine` | http | JWT |
| POST | `/tests` | http | JWT + admin |
| GET | `/tests/admin/:id` | http | JWT + admin |
| PUT | `/tests/:id` | http | JWT + admin |
| PUT | `/tests/:id/publish` | http | JWT + admin |
| GET | `/tests/:id` | http | JWT |
| POST | `/tests/:id/attempts/start` | http | JWT |
| GET | `/tests/:id/attempts/current` | http | JWT |
| GET | `/tests/attempts/:attemptId` | http | JWT |
| PUT | `/tests/attempts/:attemptId/progress` | http | JWT |
| POST | `/tests/attempts/:attemptId/submit` | http | JWT |

---

## Blogs — prefix `/blogs` — [`src/modules/blogs/blogs.service.ts`](src/modules/blogs/blogs.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/blogs/public` | http | `?page=&limit=` |
| GET | `/blogs/admin` | http | JWT + admin |
| GET | `/blogs/admin/:id` | http | JWT + admin |
| POST | `/blogs` | http | JWT + admin |
| PATCH | `/blogs/:id` | http | JWT + admin |
| DELETE | `/blogs/:id` | http | JWT + admin |
| PUT | `/blogs/:id/publish` | http | JWT + admin |

---

## Storage — prefix `/storage` — [`src/modules/storage/storage.service.ts`](src/modules/storage/storage.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/storage/upload/:kind` | http | JWT + admin; multipart `file`, `title`, optional `dayNumber` + `slot` (`lecture-video` / `coreskill-video`) for stable task-day video keys; **201** on first upload, **200** when replacing same key |
| GET | `/storage/:id/signed-url` | http | JWT |

---

## Subscriptions — [`src/modules/subscriptions/subscriptions.service.ts`](src/modules/subscriptions/subscriptions.service.ts)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/plans/admin` | http | JWT + admin |
| GET | `/plans` | http | Public |
| POST | `/plans` | http | JWT + admin |
| PUT | `/plans/:id` | http | JWT + admin |
| GET | `/subscriptions/status` | http | JWT; optional `?userId=` (admin may query others) |
| GET | `/subscriptions/dashboard` | http | JWT; optional `?userId=` |
| POST | `/subscriptions/free-trial` | http | JWT; rate limit |
| GET | `/subscriptions/purchases` | http | JWT + admin |
| GET | `/subscriptions/purchases/:id` | http | JWT |
| POST | `/subscriptions/purchases` | http | JWT; rate limit |
| POST | `/subscriptions/purchases/mock-intent` | http | JWT + admin |
| POST | `/subscriptions/purchases/mock-webhook` | http | `x-webhook-secret` when `PAYMENTS_WEBHOOK_SECRET` is set |
| POST | `/subscriptions/purchases/:id/resolve` | http | JWT; rate limit |
| POST | `/subscriptions/purchases/:id/retry` | http | JWT |
| POST | `/subscriptions/purchase-email` | http | JWT + admin; rate limit |

---

## Local development

- Run **`npm run start:dev`** from `backend/` (loads `dotenv`; use repo root `.env` or set `DATABASE_URL`, `JWT_ACCESS_SECRET`, `AWS_REGION`, `S3_BUCKET_*`, etc.).
- Point the frontend **`NEXT_PUBLIC_API_BASE`** at `http://localhost:4000` (see repo root README).
