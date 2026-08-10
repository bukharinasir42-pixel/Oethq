# OET LMS Platform

Modern LMS stack with a **Prisma + Express** backend (domain services and HTTP in `backend/src/`), Next.js 14 frontend, and Dockerized Postgres for local development.

## Stack
- Backend: TypeScript, Express, Prisma, PostgreSQL, JWT (`jsonwebtoken`), bcrypt, SMTP hooks, **AWS S3** for file storage
- Frontend: Next.js 14 (App Router), Tailwind CSS, shadcn/ui primitives
- Tooling: Docker Compose for infra, ESLint/Prettier, TypeScript across the stack

## Monorepo layout
There is **no** `package.json` at the repo root; install and run commands from `backend/` and `frontend/` (or use `Scripts/install-deps.bat` on Windows).

- `backend/` — Express + Prisma API (`npm run start:dev` from `backend/`)
- `frontend/` — Next.js web app (`npm run dev`)
- `docker/` — `docker-compose.yml` for Postgres
- `Scripts/` — convenience scripts (`install-deps.bat`, `start-all.bat`)
- `design-system/` — docs and notes for the UI system

## Prerequisites
- Node.js 20+ and npm 10+
- Docker Desktop (for local Postgres), or bring your own Postgres; **AWS S3** for uploads (see `.env.example`)

## Quick start
1) Copy environment file  
   - Windows: `copy .env.example .env`  
   - *nix: `cp .env.example .env`

2) Start infrastructure (Postgres)  
   ```bash
   cd docker
   docker compose --env-file ../.env up -d
   ```
   - Postgres: `${POSTGRES_PORT:-5432}`  
   - Configure **AWS S3** in `.env` (`AWS_REGION`, `S3_BUCKET_*`, credentials or IAM role) for admin uploads and media.

3) Install dependencies (both apps)  
   - Windows: `Scripts\install-deps.bat`  
   - *nix (manual): `cd backend && npm install`, then `cd ../frontend && npm install`

4) Generate Prisma client (after deps)  
   ```bash
   cd backend
   npm run prisma:generate
   ```

5) Apply migrations and seed demo data (includes fixed test users)  
   ```bash
   cd backend
   npm run prisma:migrate
   npm run prisma:seed
   ```
   Credentials for those users are listed under **Test accounts** below.

6) Run the apps  
   - Windows (both): `Scripts\start-all.bat`  
   - Manual:
     - API: `cd backend && npm run start:dev`
     - Web: `cd frontend && npm run dev`

## Test accounts (after `npm run prisma:seed`)

These accounts are created or updated by `backend/src/database/seed.ts`. Use them to sign in through the UI or API (same passwords in every environment where you run the seed).

| Role | Email | Password |
|------|-------|----------|
| **ADMIN** | `admin@oet.test` | `Admin@123` |
| **CANDIDATE** | `candidate@oet.test` | `Candidate@123` |
| **STAFF** | `staff@oet.test` | `Staff@123` |

The candidate user also gets sample subscription, test progress, and purchase rows for demos. To change passwords, edit `SEED_TEST_USERS` in `backend/src/database/seed.ts` and update this table.

## Environment
Fill `.env` based on `.env.example`:
- `DATABASE_URL` must point to your Postgres instance.
- `AWS_REGION` and `S3_BUCKET_*` name your S3 buckets; use the default credential chain (`aws configure`, env keys, or an IAM role on the host/ECS task).
- `JWT_*` and `OTP_*` drive auth tokens and OTP expiry. Set `JWT_ACCESS_EXPIRES_IN` (e.g. `7d`, `24h`) for login session length; default is `7d`.
- `NEXT_PUBLIC_API_BASE` must match your API base URL (e.g. `http://localhost:4000` for local Express).
- **HTTPS frontend + HTTP API (ECS):** set `NEXT_PUBLIC_API_BASE=/api` and `API_URL=http://<ecs-ip>:4000`. For a **fixed IP** that survives redeploys, run `infra/aws-cheapest/scripts/setup-stable-api.ps1` once (NLB + Elastic IP), then redeploy the backend.
- **Vercel `ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR` on login:** stale `API_URL` on Vercel (ECS task got a new public IP). Update `API_URL` in Vercel project env and redeploy the frontend.
- `ANTHROPIC_API_KEY` switches the website assistant on. **Backend only** — it must never be given a `NEXT_PUBLIC_` name or reach the browser bundle, because a key in the frontend is a key anyone can spend. Leave it unset and the chat widget does not render at all. Get one from <https://console.anthropic.com>.
- `TRUST_PROXY=true` matters more once the assistant is live: the anonymous chat rate limit is keyed on the client IP, and behind a CDN every visitor looks like the proxy without it — so one person hitting the cap would lock out everyone.

## Useful commands
- Backend: `npm run lint`, `npm run format`, `npm run build`, `npm run prisma:migrate`
- Frontend: `npm run lint`, `npm run build`, `npm run start`
- Infra teardown: `cd docker && docker-compose down`
- App images: `docker build -t oet-lms-backend:latest ./backend` and `docker build -t oet-lms-frontend:latest ./frontend`

## URLs (defaults)
- API: `http://localhost:4000`
- Frontend: `http://localhost:3000`

## Notes
- `.gitignore` already excludes env files, build outputs, editor folders, and tooling caches.
- If you add new buckets or env keys, mirror them in `.env.example` to keep setup reproducible.
- CI for backend/frontend lint-build-test now lives in `.github/workflows/ci.yml`.
- Phase 3 launch ops notes for backup/restore live in [docker/BACKUP_RESTORE.md](docker/BACKUP_RESTORE.md).
- Environment promotion and rollout checklist live in [docker/DEPLOYMENT_PROMOTION.md](docker/DEPLOYMENT_PROMOTION.md).
- Monitoring stack notes for Prometheus and Alertmanager live in [docker/monitoring/README.md](docker/monitoring/README.md).
