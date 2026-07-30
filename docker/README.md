# Docker services

From this directory (`docker/`):

```bash
docker compose --env-file ../.env up -d
```

This loads the repo root `.env` for variable substitution and starts **Postgres** only. File uploads use **AWS S3** (configure `AWS_REGION`, `S3_BUCKET_*`, and credentials in `../.env` — see root `.env.example`).
