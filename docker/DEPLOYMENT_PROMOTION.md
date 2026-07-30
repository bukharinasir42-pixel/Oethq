# Deployment Promotion

## Goal
Promote the same Phase 3 codebase safely from local verification to staging and then to production.

## Environment promotion sequence
1. Apply the latest `.env` values for the target environment.
2. Run the CI gates: backend lint, backend tests, backend build, frontend lint, frontend build.
3. Apply Prisma migrations against the target Postgres database.
4. Build fresh backend and frontend images from the repo Dockerfiles.
5. Deploy backend first, then frontend, then the monitoring stack if it is separate.
6. Confirm `/health`, `/health/ready`, and `/metrics` from the deployed backend.
7. Run the candidate purchase flow in staging:
   - sign in
   - create purchase
   - complete purchase
   - open activation link
   - verify OTP
   - confirm portal access
8. Verify Prometheus scrape health and confirm Alertmanager receiver routing.

## Launch checklist
- Database backup completed before deployment.
- S3 asset buckets (`S3_BUCKET_*`) exist and the task role allows required object operations.
- `PAYMENTS_WEBHOOK_SECRET` rotated or verified.
- `CORS_ALLOWED_ORIGINS` matches the deployed frontend hostname.
- `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_APP_URL` point at the target environment.
- The backend `/metrics` endpoint is reachable from the monitoring stack.
- At least one completed and one failed staging purchase have been exercised after deploy.
- A candidate activation email has been received and the OTP verified successfully.
- Admin pricing, blogs, subscribed users, and payments pages load after deploy.

## Docker image commands
```bash
docker build -t oet-lms-backend:latest ./backend
docker build -t oet-lms-frontend:latest ./frontend
```

## Rollback guidance
- Restore the latest Postgres backup and revert S3 changes if needed after a failed deploy.
- Redeploy the previous backend and frontend image tags.
- Re-check `/health/ready` and monitoring alerts before reopening traffic.
