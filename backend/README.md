# OET LMS Backend

Single **Node.js + Express** HTTP server (see [`src/server.ts`](src/server.ts), [`src/app.ts`](src/app.ts)) on **`API_PORT`** (default **4000**). Domain logic lives in [`src/modules/**`](src/modules/**) as plain TypeScript services (no NestJS).

The full route catalog is [`API_ENDPOINTS.md`](API_ENDPOINTS.md).

## Prerequisites

- **Node.js 20+** and npm
- **Docker Desktop** (optional: local Postgres via repo `docker/`)
- **AWS account** with S3 buckets for uploads (`S3_BUCKET_*` in `.env`)

## Environment files

- **Monorepo / Docker Compose:** the repo root [`.env.example`](../.env.example) is the template. Copy it to **repo root** `.env`.
- Commands run from **`backend/`**; ensure `DATABASE_URL` and `JWT_ACCESS_SECRET` are set (export, `backend/.env`, or `dotenv` loading the repo root `.env` depending on how you start the process).
- **`CORS_ALLOWED_ORIGINS`:** comma-separated list aligned with the Next app origin (e.g. `http://localhost:3000`).
- **`PAYMENTS_WEBHOOK_SECRET`:** optional locally; when set, `POST /subscriptions/purchases/mock-webhook` must send header **`x-webhook-secret`** with the same value.

## Local infrastructure (Postgres)

From the repo root:

```bash
cd docker
docker compose --env-file ../.env up -d
```

File storage is **AWS S3** only (see root `.env.example`: `AWS_REGION`, `S3_BUCKET_*`, credentials or IAM).

## Database: migrate and seed

From `backend/`:

```bash
npm install
npx prisma migrate deploy --schema ./src/database/schema.prisma
npx prisma generate --schema ./src/database/schema.prisma
npm run prisma:seed
```

On **Neon**, set `DATABASE_URL` to the **pooled** host (`-pooler`) for the API. For migrations, set `DIRECT_URL` to the **direct** host (no `-pooler`), or rely on `prisma.config.ts` to derive it automatically. Using only a pooler URL for `prisma migrate` causes advisory-lock timeouts (`P1002`).

Seeded accounts (after seed): Admin `admin@oet.test` / `Admin@123`; Candidate `candidate@oet.test` / `Candidate@123`.

## Run the API locally

```bash
cd backend
npm run start:dev
```

- Serves **all** routes in [`API_ENDPOINTS.md`](API_ENDPOINTS.md) (auth, users, tests, blogs, storage, subscriptions, health, metrics, …).
- **GET** `/auth/login` and **GET** `/auth/register` on the API host **302** to the Next app (`NEXT_PUBLIC_APP_URL` / `PUBLIC_APP_URL`, default `http://localhost:3000`).
- Set **`TRUST_PROXY=true`** when the app sits behind a reverse proxy so `req.ip` / rate limits respect `X-Forwarded-For`.

## Build and lint

```bash
npm run build   # compile src/ → dist/
npm run lint
```

## Docker image (ECS/Fargate)

See [`Dockerfile`](Dockerfile): production image runs **`node dist/server.js`** and exposes the **full REST** surface on port **4000** (same as local).

## Operational notes

- **HTTP logging:** Every request is logged with **morgan** to stdout. Default format is **`dev`** when `NODE_ENV` is not `production`, and **`combined`** in production. Override with **`MORGAN_FORMAT`** (see root `.env.example`).
- **S3:** Set `AWS_REGION` and `S3_BUCKET_*`; credentials via the default AWS provider chain (env keys, shared config, or IAM role when deployed).
- **Rate limiting:** in-process (`RateLimitService`) per server instance; keys are documented on auth and selected subscription routes in code.
- **Prisma:** schema at `src/database/schema.prisma`; migrations under `src/database/migrations`.

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| `JWT_ACCESS_SECRET is required` at startup | Set `JWT_ACCESS_SECRET` in `.env`. |
| CORS errors from the browser | Set `CORS_ALLOWED_ORIGINS` to include your Next origin (e.g. `http://localhost:3000`). |
| **404 on `POST /auth/login` from the browser** | The request must go to **this API** (e.g. `http://localhost:4000`), not the Next.js port. In the frontend, `NEXT_PUBLIC_API_BASE` must be the API origin (see browser console warning if it matches the site origin). |
| Upload / presign failures | S3 bucket names match `S3_BUCKET_*`; IAM (or keys) allows `s3:PutObject` / `s3:GetObject`; region matches buckets. |
| **`FUNCTION_PAYLOAD_TOO_LARGE` on audio upload** | Large files must use direct S3 upload (presign). Ensure each audio/video bucket has CORS allowing `PUT` from your site origin (see below). |

### S3 CORS for browser uploads (audio / video)

Listening audio and task videos upload **directly to S3/MinIO** (not through the Next.js `/api` proxy). Add CORS on each upload bucket (`S3_BUCKET_AUDIO`, `S3_BUCKET_VIDEO`, etc.):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["https://your-production-domain.com", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

For local MinIO, apply the same CORS policy to the `audio` and `video` buckets via the MinIO console or `mc cors set`.

## Backup / restore

- Postgres and S3 notes: [docker/BACKUP_RESTORE.md](../docker/BACKUP_RESTORE.md).

## Promotion / monitoring

- [docker/DEPLOYMENT_PROMOTION.md](../docker/DEPLOYMENT_PROMOTION.md)
- [docker/monitoring/README.md](../docker/monitoring/README.md)
