# OET LMS — Full Website Audit Report

_Generated 2026-07-26. Covers the LIVE copy (`Updated/OET-LMS-Next-js-main`), both portals, all courses/features, marketing site, and backend._

**Method:** live browser walkthrough of the running app (frontend :3000 / backend :4000) as a real candidate **and** admin, plus a five-track deep code audit (candidate portal, admin panel, auth/payments/entitlements, backend integrity, marketing). Seed logins used: `candidate@oet.test` (FOUNDATION), `admin@oet.test`.

---

## 1. Verdict at a glance

The product is **feature-complete and genuinely polished** — every major feature you built is present, wired to real data, and renders beautifully in both portals. The candidate experience (dashboard, cohort lectures, exam player, skill drills, spelling, writing) and the admin control surfaces (pricing, test builder, accountability, users, content banks) all work.

**However, it is NOT safe to take payments or go live yet.** There is a cluster of **server-side authorization holes** where the UI enforces a rule but the API does not — including free plan/product activation, an IDOR on the study plan, and an unguarded admin write endpoint. These are the blockers. Everything else is polish and gaps.

| Severity | Count | Theme |
|---|---|---|
| BLOCKER | 4 | Payments free-bypass, IDOR, unguarded admin write |
| HIGH | ~9 | Entitlement gates that are UI-only; dead marketing stubs |
| MEDIUM | ~20 | Missing admin controls, consistency, content exposure |
| LOW | many | Cosmetic, dead code, defensive gaps |

---

## 2. CRITICAL — must fix before accepting real money / launch

These were **verified directly** by the audit agents against the running code, not just inferred.

### C1. Any candidate can activate a paid plan for $0 (no payment ever verified)
- `POST /subscriptions/purchases/:id/resolve` (`backend/src/http/routes/subscriptions.router.ts:163`) is `requireAuth` **only** and there is **no `NODE_ENV` guard on the server**. A user can self-create a purchase then resolve it `COMPLETED` -> gets the plan + activation OTP to their own email. The frontend only *hides* the "Simulate payment" button in prod; the endpoint stays open.
- **Standalone products / per-skill courses / writing packages have no real payment path at all.** `products.service.ts:183` `startCheckout` always creates a `STAGING_MANUAL` purchase; `POST /product-purchases/:id/resolve` (`products.router.ts:44`) defaults to `COMPLETED` and writes the entitlement. Every standalone course and writing package is currently free by construction.

### C2. Unauthenticated payment webhook
- `POST /subscriptions/purchases/mock-webhook` (`subscriptions.router.ts:147`) has **no auth** — protected only *if* `PAYMENTS_WEBHOOK_SECRET` is set. If that env var is empty in prod, anyone who guesses a purchase UUID can complete it. (And if it *is* set, the admin Payments UI doesn't send the header, so admin Complete/Fail is broken — pick one.)

### C3. IDOR on the study plan — any user reads/unlocks another user's plan
- `portal/tasks` calls `/tasks/for-user?userId=<me>`, but `tasks.router.ts:27` reads `req.query.userId` **verbatim under `auth` only** and never calls the existing `ensureUserCanReadTasks` guard. A trial/standalone user can pass a Complete user's ID and receive fully-unlocked days **including signed asset URLs**.

### C4. Any candidate can rewrite the live study plan for everyone
- `PUT /tasks/:dayNumber` (`tasks.router.ts:50`) is `auth`-only, **no `admin`**. This is the admin Task-Builder Save. Any authenticated candidate can `PUT /tasks/1` and overwrite lecture titles, Bunny video IDs, article content, test assignments, and `isPublished` — live for all students. (`POST /tasks/add` and `DELETE` *are* correctly admin-guarded, so this is an oversight on 3 routes: `PUT /tasks/:dayNumber`, `POST /tasks/ensure-template`, `GET /tasks`.)

> **Root cause is one pattern:** several endpoints trust a client-supplied `userId` or skip the `admin` middleware. A single hardening pass — *derive `userId` from the JWT, never the query; add `admin` to the three task routes; gate the resolve/webhook endpoints to non-production* — closes all four blockers.

---

## 3. Candidate portal — surface by surface

Live-verified in the browser + code-audited. All pages render with no console errors.

| Surface | Live | Notes |
|---|---|---|
| Premium dashboard (`/portal`) | OK | Route-to-exam hero, 40-day slider, Day-N tasks, 85% pass gauge, skill averages. |
| Progress (`/portal/dashboard`) | OK | Pass-readiness correctly hidden for trial (this gate is the *correct* one). |
| Cohort live lectures (`/portal/tasks`) | OK | Day picker, per-day lecture+article, completed/rewatch, days locked by tier. |
| Reading/Listening tests | OK | Lists real tests; locked rows show Upgrade, not a launch link. |
| Exam player (`/portal/tests/:id`) | OK | Part A 15-min + Parts B&C 45-min shared timer, Rasch scoring, screenshot guard fully wired. |
| Skill practice — Part A drill | OK | Drill-of-the-day rotates every 24h. |
| Skill practice — Spelling | OK | 1,938-term engine, 12 categories, TTS. |
| Past papers | OK | Graceful "coming soon / not yet published" empty state. |
| Writing | OK | Quota shows correctly (0/3 used for FOUNDATION). |
| History / Results | OK | Attempts + retained results, grade labels correct. |

**Portal findings that matter:**
- **HIGH — Entitlement gates are frequently UI-only.** Cohort routes (`cohort.router.ts`), `/skill-drills|reading-articles|listening-podcasts/of-day`, `/spelling/bank`, and the past-paper slot limit on the OET path all have **no server entitlement check** — a listening-only or trial user can fetch reading/locked content by calling the API directly. The UI hides it; the API doesn't.
- **MEDIUM — Writing case-note content exposed by direct URL.** `/portal/writing/:caseNoteId` matches only on *profession*, not Writing ownership/quota — a trial user with a matching profession can read premium case notes (blocked only at final submit).
- **MEDIUM — Pass-probability isn't fully suppressed for trial.** The backend returns `summary.passProbability` to STARTER regardless of UI (`subscriptions.service.ts:401`), and the premium dashboard's `isFreeTrial` gate **fails open** if the dashboard fetch returns null (gauge would render). _(This is in the free-trial work — worth hardening: omit the field server-side + fail closed.)_
- **LOW — Lecture progress is hardcoded** — every lecture shows "Not started" / 0% (`portal/lectures/page.tsx:141`); there is no watch-state persistence, so "continue where you left off" and the accountability lecture tick aren't backed by real data on this surface.
- **LOW — Audio "once-only" is best-effort client-side** — no server record of consumption; a page remount replays from 0.
- **LOW — Seed candidate has no profession set** -> Writing shows "Profession not set — contact support," and there's **no admin/self-service way to set it** (see gaps).

---

## 4. Admin panel — page by page

Live-verified + code-audited. Admin correctly blocks non-admins ("Admin access required"). All pages render with real data, working CRUD, validation and toasts — **no placeholder/mock numbers, no dead handler buttons.**

**Solid:** Overview, Pricing (plans + all 3 writing packages editable), Users (profession/source colour-coding + filters live), Subscribed Users, Security (reinstate), Accountability (per-student ticks + single & bulk warn), OET test import + guided reading/listening builders, Skill Drills, Spelling Bank, Reading Articles, Listening Podcasts (file **and** URL), Writing case-notes, Course Lectures, Blogs, How-to Videos, Progress, Dashboard.

**Admin findings that matter:**
- **BLOCKER** — Task-Builder Save is the unguarded `PUT /tasks/:dayNumber` — see **C4**.
- **HIGH** — Payments Complete/Fail rides the unguarded `mock-webhook` — see **C2**.
- **HIGH — No re-send for failed emails.** Writing submissions show `emailDelivered:false` and activation emails can fail, but there's no re-send/re-trigger control anywhere — delivery failures are unrecoverable from the UI.
- **HIGH — Past-paper builder uses the legacy question-row engine**, and the one-paste bundle importer (`POST /oet-tests/import-past-paper`) exists + is admin-guarded but **has zero frontend callers** — so past papers can't use the same paste flow as standalone tests.
- **MEDIUM — Plan tier limits not editable in Pricing UI** (reading/listening/pastPaper/durationDays are read-only) though the DTO fully supports editing — you must hit the API/DB to change entitlement limits.
- **MEDIUM — No manual "suspend" control** on Security (route exists + guarded; only reinstate is surfaced).
- **MEDIUM — Listening audio URL unsupported in the legacy editor** (file-only) — which is exactly the editor past papers + legacy tests use.
- **LOW** — No audit-log viewer (an `audit.router.ts`/service exists but nothing consumes it). Skill-drill *preview* runs uploaded HTML same-origin in the admin browser (portal sandboxes it correctly).

---

## 5. Auth / signup / entitlements

- **OK — Signup enforces profession + source on both client and server** (`register.dto.ts` `@IsNotEmpty`), OTP email-verification is single-use with expiry, no auto-login.
- **OK — Entitlements engine is correct** — `getOwnership` filters ACTIVE + unexpired and **excludes STARTER**; consistent with `resolveTrialAccess`.
- **OK — Free-trial provisioning is correct** — STARTER `TRIAL` sub, 7-day window applied from `plan.durationDays` (seeded 7). Caveat: if a STARTER plan is ever created without `durationDays`, it silently falls back to 60 days — worth a guard.
- **OK — Stripe path (for plans) is sound** — server retrieves the session and rejects unless paid; amount computed server-side; webhook signature-verified. The problem is only the staging/mock bypass (C1/C2) sitting alongside it, ungated.
- **MEDIUM** — Suspended users keep working 7-day JWTs (re-checked only at login, not on `/auth/me`) — a user suspended mid-session for screenshots keeps access until the token expires. No token revocation.
- **LOW** — Password policy is min-8 only, no complexity requirement server-side.

---

## 6. Marketing / public site

All 15 public routes return 200. Pricing is genuinely dynamic from `/plans` + `/products` across homepage, `/courses`, the 3 standalone landings, writing-corrections, and checkout — numbers stay consistent.

**Findings:**
- **BLOCKER-visibility — Homepage hero video shows "403".** The configured Bunny embed (`iframe.mediadelivery.net/embed/697843/e62723b1-...`, `signed:false`) returns 403 Forbidden — the video/library isn't publicly embeddable. Big, first-thing-you-see defect. Configure a public/tokened video.
- **HIGH — Waitlist "Notify me" form is a dead stub** — collects an email and posts **nowhere** (`website-course-catalogue.tsx:58`, TODO in source). Captures PII into the void.
- **HIGH — Writing Corrections is live + purchasable but marketed as "Coming soon"** in two places (homepage waitlist card + footer "Soon" badge -> `/courses` instead of `/courses/writing-corrections`). An active revenue path is hidden/contradicted.
- **MEDIUM — Flagship plate "15 + 15 mock tests" matches no tier** (Foundation 5+5 / Precision 12+12 / Elite 20+20) — hardcoded; also "4 months of access" vs real 45/90/270-day tiers.
- **MEDIUM — Dead "Why We're Different" block** (30,000+ students / $60,000 worth claims) is in the code but never rendered — wire in or delete.
- **MEDIUM — Three dev/scratch routes are publicly reachable + return 200:** `/design-system`, `/test`, `/public` (`/public` also serves *hardcoded* pricing and a broken `/#plans` anchor). Remove or gate.
- **LOW** — Checkout staging controls ("Simulate payment", "Development OTP") are correctly gated behind `NODE_ENV !== production` — **just confirm prod actually runs with `NODE_ENV=production`.**
- **LOW** — Unverifiable/inconsistent stat claims across hero vs footer vs dead block (1,000+ / 133,580+ / 30,000+) — no single source of truth.

---

## 7. Backend integrity

**Overall: healthy.** `npx tsc --noEmit` is **clean (exit 0)**, `prisma migrate diff` reports **no drift** (live DB == schema, 46 migrations), DI container wires all 31 services correctly, and error handling is solid (`asyncHandler` + central `httpErrorHandler`, Prisma transient -> 503, Stripe webhook try/catch). No TODO/FIXME/HACK in `src`. Seed is correct (STARTER 7 days + writingLimit 0; FOUNDATION/ACCELERATOR/MASTERY writingLimit 3/7/15; writing packages 2/6/12 @ $28/$77/$147).

**Router/auth issues (confirm the blockers above):**
- Confirms **C3** (IDOR `GET /tasks/for-user?userId=` -> `listForUser(userId)` with no actor check) and **C4** (`PUT /tasks/:dayNumber` auth-only) and **C2** (unauthenticated `mock-webhook`).
- **Worsens C2:** `.env:69` ships `PAYMENTS_WEBHOOK_SECRET=change-me-webhook-secret` — the *placeholder*. If deployed as-is, the "secret" is public knowledge, so the webhook is effectively unauthenticated. Env-gate the route registration to dev **and** rotate this secret.
- **LOW** — `GET /tests` is public while `GET /tests/:id` requires auth (leaks the published-test list; likely intentional but asymmetric).

**Frontend<->backend route coverage:**
- **Orphans (frontend calls with no backend route): NONE.** Every one of ~200 call-sites resolves.
- **Dead routes (backend routes with no frontend consumer):** `GET /audit-logs`, `GET /grading/bands`, `GET /users/progress`, `GET /cohort/reports(/:id)`, `POST /oet-tests/import-past-paper`, `GET /storage/public/website-intro-video`, `GET /blogs/admin/:id`. All LOW (unbuilt UI / dead code) — note `import-past-paper` is the missing past-paper paste importer, and `audit-logs` is the missing admin audit viewer.

**Other:**
- **LOW — HTML injection into outbound correction email.** `writing.service.ts:305-316` interpolates `user.name` / `note.title` into the email HTML **unescaped** (only the letter body is escaped). Low-risk but should be escaped.
- Stale `create-app.ts` + `main.ts` second entrypoint mounts only ~14/24 routers — dead but a landmine if ever booted. Delete or resync.

---

## 8. What you've likely MISSED (consolidated gaps)

Ordered by how much it matters:

1. **Server-side entitlement/authorization enforcement is systematically missing** on read + a few write endpoints (the C1–C4 cluster + the UI-only gates). This is the single most important thing to fix before launch.
2. **No real payment path for standalone products / skills / writing packages** — they're free by construction; only Complete-plan Stripe is wired. If you intend to sell them, they need a real Stripe checkout.
3. **No way to set/fix a user's profession** — required at signup, but legacy/seed users without one are locked out of Writing with "contact support," and there's no admin control to set it.
4. **No re-send for failed correction/activation emails** — delivery failures are unrecoverable from admin.
5. **Past-paper content workflow is inconsistent** — legacy engine + no paste importer wired, unlike standalone tests.
6. **Lecture watch-progress isn't tracked** — hardcoded "Not started"; breaks "continue where you left off" and the accountability lecture tick's real backing.
7. **True exam-audio once-only isn't enforced server-side** — best-effort client only.
8. **Plan tier limits aren't admin-editable** in the UI despite DTO support.
9. **No manual suspend, no audit-log viewer** in admin.
10. **Dead code to prune:** stale `create-app.ts` + `main.ts` second entrypoint (mounts only ~14/24 routers — a landmine if ever booted), four orphaned dashboard components (one leaks pass-probability with no trial gate), `/design-system` `/test` `/public` pages, `.bak` files.

---

## 9. Recommended fix order

1. **Security hardening pass (C1–C4)** — derive `userId` from JWT; add `admin` to the 3 task routes; gate resolve/mock-webhook to non-prod; add entitlement checks to cohort / of-day / spelling / writing-case-note / past-paper endpoints.
2. **Payments** — decide real Stripe for products or clearly mark them unpurchasable; confirm `NODE_ENV=production` + `PAYMENTS_WEBHOOK_SECRET` on the live box.
3. **Marketing truth-up** — fix hero video 403; wire or remove the waitlist; flip Writing Corrections from "coming soon" to live; remove dev pages.
4. **Free-trial hardening** — omit `passProbability` server-side for STARTER + fail closed; show flagship modal (not the library) on `/portal/writing` for trial.
5. **Admin gaps** — profession-set control, email re-send, past-paper paste importer, editable tier limits.
6. **Polish** — lecture progress tracking, dead-code cleanup.
