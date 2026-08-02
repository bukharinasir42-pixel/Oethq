# OET HQ — developer handover

Branch: `claude/file-comparison-analysis-qin16k`

24 commits. Five migrations. Everything here has been run against a real
Postgres and a real API, not just typechecked — see [Testing](#testing).

---

## 1. Get it running locally

These are the exact steps that work. Nothing is assumed.

### Database

```bash
# Postgres 16
createdb oethq
```

### Environment

Create `backend/.env`:

```ini
DATABASE_URL=postgresql://USER@localhost:5432/oethq?schema=public
JWT_ACCESS_SECRET=<any long random string>
JWT_REFRESH_SECRET=<any long random string>
API_PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
OTP_EXPIRY_MINUTES=30
```

Three things that cost me time and will cost you the same:

- The variable is **`JWT_ACCESS_SECRET`**, not `JWT_SECRET`. The app refuses to
  boot without it.
- The port variable is **`API_PORT`**, not `PORT`. Setting `PORT` is silently
  ignored and you get 4000.
- With no SMTP configured the app **refuses to pretend it sent an email** —
  registration still succeeds and the code is written to the `OTPCode` table.
  That is deliberate and correct. Read the code from the database in
  development:

  ```sql
  SELECT o.code FROM "OTPCode" o JOIN "User" u ON u.id = o."userId"
  WHERE u.email = 'you@example.com' ORDER BY o."createdAt" DESC LIMIT 1;
  ```

### Migrate, seed, run

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed            # plans + admin/candidate/staff test users
npm run prisma:seed-products   # the course catalogue
npm run start:dev              # http://127.0.0.1:4000

cd ../frontend
npm run dev                    # http://localhost:3000
```

Seeded logins: `admin@oet.test / Admin@123`, `candidate@oet.test / Candidate@123`.

---

## 2. Deploying this branch

Run in this order. All five are additive; none drops or rewrites anything.

| Migration | What it does | Safe on live? |
|---|---|---|
| `20260727120000_repair_missing_columns` | Adds 8 columns + 1 enum value that were never migrated | Yes — every statement is `IF NOT EXISTS`, so it is a **no-op on production**, which already has them |
| `20260802090000_add_user_session` | Creates `UserSession` | Yes — CREATE only |
| `20260802120000_add_user_session_geo` | Adds `country`, `city` | Yes — nullable columns |
| `20260802140000_backfill_writing_limits` | Repairs `Plan.writingLimit` | Yes — UPDATE guarded on `= 0`, so admin-set values are untouched |
| `20260802150000_add_speaking_hack_sentences` | Enum value + `profession` column | Yes — additive |

```bash
npx prisma migrate deploy && npx prisma generate
npm run prisma:seed-products   # REQUIRED — product names live in the DB too
```

**Do not skip the product seed.** The Course → Material rename is in both the
code and the database. Without it the catalogue still says "OET Complete
Courses".

### One thing to do outside the code

Country in the Device Audit comes from your CDN's geo headers, not a lookup
service. On Cloudflare: **Rules → Managed Transforms → Add visitor location
headers.** Until then the country columns read Unknown and the page says so.

---

## 3. Traps in this codebase

Each of these silently did nothing when I got it wrong. They will do the same
to you.

**There are two app bootstraps.** `src/app.ts` and `src/http/create-app.ts` are
near-identical. **Only `src/app.ts` runs** — `server.ts` imports it. I mounted a
new router in `create-app.ts` and it 404'd with no error anywhere. Consider
deleting the dead one.

**There are two request-context builders.** `buildRequestAuditContext`
(`common/http/request-context.ts`) and `auditContextFromRequest`
(`http/request-audit.ts`). **The auth routes use the second.** I added device
headers to the first, and the entire two-device limit was inert — no sessions,
no cap, no audit trail, no error. They now share one extractor; keep it that way.

**`auth.router.ts` is mounted under `/auth`.** Anything you add there gets that
prefix. Admin routes belong in a root-mounted router.

**Registration is rate-limited** to 20 per 5 minutes per IP, login to 30. Fine
in production, surprising when you script against it.

**Access is never in the token.** Every gate re-reads `endDate > now` per
request, which is why cancelling access takes effect on the student's next
click. Do not "optimise" this into the JWT.

**Session liveness is cached for 60 seconds.** A revoked session can survive up
to a minute. That is a deliberate trade against a database read per request.

---

## 4. Testing

```bash
cd backend  && npx tsc --noEmit && npx jest      # 84 pass
cd frontend && npx tsc --noEmit && npx next lint
```

One backend test fails and always has: `email.service.spec.ts`, "logs a preview
when no provider is configured". It fails identically with this branch stashed.
It is not from this work.

### The end-to-end harness

`backend/test/e2e-stress.mjs` — 78 assertions against a **running API and a real
database**. It registers real accounts, reads their codes from the database,
buys every tier, ages the clock, and cycles devices.

```bash
# API running against a migrated + seeded database
node backend/test/e2e-stress.mjs
```

It expects Postgres reachable via `psql -h /tmp -p 5433 -U postgres -d oethq`
and the API on `127.0.0.1:4000`; adjust the two constants at the top if yours
differ. Run it before every deploy — **it found four bugs that code review and
typechecking both missed**, three of them in code that looked correct.

Covered: sign-up and sign-in, all 11 single-skill tiers (rank, mock count,
past-paper count, access window, no cross-skill leak), tier gating of spelling
and podcasts, upgrade and downgrade, the Complete plan, Speaking being
Complete-only, writing quotas per plan, next-day sign-in preserving access, the
device cap in six states, cancel/suspend/expire, and admin authorisation.

Not covered: anything in a browser — audio playback, the Reading panes on a real
phone, PDFs on iOS Safari, or an email arriving. Those need a staging run.

---

## 5. What is in the branch

| Area | Summary |
|---|---|
| Mobile Reading exam | Cover scroll, footer clear of the browser toolbar, Parts B & C rendering, two scrollable panes |
| Study plan | Lectures only, "Coming soon" for empty days, UTC refresh countdown, first-visit note |
| Free trial | One of each; rotating content is Day 1 only; podcast and articles closed |
| Accountability | Every buyer on the roster, per-student report, PDF export, filters |
| Admin access | Upgrade / downgrade, end plan, cancel all access, candidate filters |
| Naming | Course → Material; Writing → Corrections; one merged Materials menu |
| Auth | Registration code signs you in, sliding 7-day sessions, two-device cap |
| Device audit | Shared-account detection with device, country and IP, and blocking |
| Speaking | Complete-only; lectures plus per-profession hack-sentence PDFs |
| Exam safety | Answers mirrored locally, visible save failures, submit retry |

### The bugs worth understanding

1. **Paying course buyers were served the free trial.** Buying a single-skill
   course never cleared the signup trial row, and the trial check read
   subscriptions only. It looked fine until the next UTC midnight, then locked.
2. **Every plan's writing quota was zero.** A column added with `DEFAULT 0` and
   never populated. Students were told to buy corrections they had paid for.
3. **A fresh database could not be built.** Columns pushed to live without
   migrations; the seed died before writing a row.
4. **The two-device limit did nothing.** Wrong context builder — zero sessions
   ever created.
5. **A lost exam had a button that made it worse.** Autosave swallowed its
   errors and the failure screen restarted the attempt.

---

## 6. Open decisions

Not bugs. Each needs a product call, and none was guessed at.

| Item | Today | Decision |
|---|---|---|
| Listening scoring | Linearly scaled, but the admin panel labels it Rasch | Change the scoring or the label |
| Writing case notes | Any signed-in student can browse their profession's library; only submitting is gated | Gate it, or treat it as a shop window |
| Expired students | Hard-redirected off the portal, losing sight of their own results | Consider read-only access instead |
| Cancelled access | Remaining days are not banked on reinstatement | Freeze and return them, if you prefer |
| Day-45 refresh | No drip logic exists anywhere | Specify it |
| Cohort Class 2 | Removed with articles and tests; the schema still defines two classes per day | Restore or drop from schema |
| Per-student limits | `Entitlement` has no per-user limit fields | Needs a migration |
