# OET LMS — Production Deployment / Migration Runbook

Hand this whole folder to the developer. It contains everything needed to push the
current build to the live site (**oethq.com**, AWS + RDS, GitHub + CD).

**Package contents**
| File | What it is |
|---|---|
| `oet-lms-code.tar.gz` | Full application source (backend + frontend), **no** `node_modules`, `.next`, `.env`, or `.git`. Includes all Prisma migrations. |
| `database/content-data.json` | Content/reference data only (tests, study plan, 1,938 spelling terms, drills, articles, products, plans…). **No users, subscriptions, purchases, attempts, or results.** |
| `database/export-content.js` / `import-content.js` | Idempotent export/import scripts (also inside the code bundle at `backend/`). |
| `CHANGES-2026-07-26.md` | What changed in this build — the review surface. |

> ⚠️ **There is no full database dump on purpose.** The live DB has real users and
> payments; restoring a dump would destroy them. Schema is applied with Prisma
> migrations (additive); content is applied with the idempotent importer below.

---

## 0. 🔴 READ FIRST — do NOT take payments until these are fixed

A full audit (`WEBSITE-AUDIT-2026-07-26.md` in the repo root) found **4 blocking
security holes**. They are *not* fixed in this build. Deploying as-is means anyone
can get paid courses for free and any logged-in user can tamper with the site.

1. **Free plan/product activation** — the purchase "resolve" endpoints and the
   `mock-webhook` have no real payment check and no production guard.
2. **`PAYMENTS_WEBHOOK_SECRET` ships as the placeholder** `change-me-webhook-secret`
   in `.env` — rotate it to a strong random value in the AWS environment.
3. **IDOR** — `GET /tasks/for-user?userId=` trusts the client-supplied id.
4. **`PUT /tasks/:dayNumber`** (study-plan edit) is missing the admin guard.

**Gate all of these before enabling checkout.** (Ask me to do the hardening pass —
it's one focused change set.)

---

## 1. Prerequisites on the target

- Node.js 20+ and npm.
- AWS RDS Postgres reachable from the app host; connection string ready.
- Secrets available to set as environment variables (see §4).
- Backups: **take an RDS snapshot before step 3.**

## 2. Code — merge into GitHub (CD deploys it)

This build is a source snapshot, not a git branch. Merge it into the existing repo:

```bash
# in a clean clone of the live repo, on a new branch
git checkout -b release/2026-07-26
# extract the bundle OVER the working tree (does not touch .git)
tar -xzf oet-lms-code.tar.gz -C /path/to/repo
git add -A
git status          # review — cross-check against CHANGES-2026-07-26.md
git commit -m "Release 2026-07-26: free trial, writing course + quotas, content features"
git push origin release/2026-07-26
# open a PR, review, merge -> CD builds & deploys
```

The reviewer should use `CHANGES-2026-07-26.md` as the checklist of what to expect.

## 3. Database — schema then content

Run from the deployed `backend/` directory with `DATABASE_URL` pointing at **RDS**.

```bash
# a) SNAPSHOT RDS FIRST (AWS console) — this is your rollback.

# b) Apply schema migrations (additive, safe, does not touch data)
npx prisma migrate deploy
npx prisma generate

# c) Establish plans & products (idempotent upserts — encodes prices, tiers,
#    writing quotas 3/7/15, the 3 writing-correction packages, STARTER 7-day trial)
npx ts-node src/database/seed.ts
npx ts-node src/database/seed-products.ts

# d) OPTIONAL — import the content you built (tests, study plan, spelling bank,
#    drills, articles, lectures…). Idempotent; upserts by natural key/id.
#    ⚠️ This OVERWRITES matching rows on the live site (e.g. plan prices by name,
#    product prices by slug) with the values in content-data.json. Review the file
#    and decide per your live content before running.
cp /path/to/database/content-data.json .
node import-content.js
```

If the live site already has its own tests/content, **skip step (d)** or trim
`content-data.json` to only the new rows you actually want to publish.

## 4. Environment variables to set on AWS (never commit these)

The bundle excludes `.env`. Set these in the app environment / secrets manager:

- `DATABASE_URL` — RDS connection string (`?sslmode=require`).
- `JWT_SECRET` — strong random.
- `PAYMENTS_WEBHOOK_SECRET` — **rotate off the placeholder** (see §0).
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price/publishable keys as used.
- **Bunny Stream** (video): library id + API/signing keys (hero video, lectures, podcasts).
- **AWS S3** (uploads): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, bucket/region.
- **Email:** SES or SMTP creds + `FROM` address.
- `NODE_ENV=production` — **required** (hides the staging "simulate payment" / dev-OTP controls).
- Frontend: `NEXT_PUBLIC_API_URL` (or equivalent) → the live backend origin.

## 5. Media assets (S3 / Bunny) — not in the DB

Uploaded files (lecture/podcast audio, images, the writing sample PDF, hero video)
live in **S3 / Bunny**, not in the database. `StorageObject`/asset-id rows only
*reference* them. Ensure the live site uses the **same buckets/library** these assets
were uploaded to, or re-upload them, otherwise media links 404. The homepage hero
video currently returns **403** (not publicly embeddable) — configure a valid public
/tokened Bunny video during deploy.

## 6. Post-deploy verification

- [ ] `GET /health` on the backend returns 200.
- [ ] Homepage loads; pricing shows live numbers; hero video plays (not 403).
- [ ] Sign up → email OTP arrives → verify → portal loads.
- [ ] Free-trial button → account → portal shows exactly the trial contents.
- [ ] Admin login → pricing, test builder, users, accountability all load.
- [ ] Stripe test purchase works **and** the free-bypass endpoints are closed (§0).
- [ ] `npx prisma migrate status` → "up to date".

## 7. Rollback

- **Code:** revert the merge commit; CD redeploys the previous build.
- **DB schema:** restore the RDS snapshot from step 3(a). (Prisma migrations are
  additive; a snapshot restore is the clean rollback.)
