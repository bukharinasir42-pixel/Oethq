# Backup And Restore

## Postgres
### Backup
```bash
cd docker
docker compose exec postgres pg_dump -U "$env:POSTGRES_USER" -d "$env:POSTGRES_DB" -Fc -f /tmp/oet_lms.dump
docker compose cp postgres:/tmp/oet_lms.dump ./backups/oet_lms.dump
```

### Restore
```bash
cd docker
docker compose cp ./backups/oet_lms.dump postgres:/tmp/oet_lms.dump
docker compose exec postgres pg_restore -U "$env:POSTGRES_USER" -d "$env:POSTGRES_DB" --clean --if-exists /tmp/oet_lms.dump
```

## S3 assets

Uploaded files live in the buckets configured as `S3_BUCKET_*` in your environment. Use AWS Backup, versioning, or `aws s3 sync` against those buckets according to your account policy.

## Notes
- Run backups before schema migrations, payment-provider cutovers, or bulk content uploads.
- Align Postgres dumps with your S3 backup window so database rows and object keys stay consistent.
- Store backup artifacts outside the repo working tree in real staging/production environments.
