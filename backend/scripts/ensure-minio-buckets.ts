/**
 * Creates default asset buckets in local MinIO. Run after `docker compose -f docker/docker-compose.yml up -d minio`.
 *
 *   cd backend && npx ts-node --transpile-only scripts/ensure-minio-buckets.ts
 */
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

const backendDir = path.resolve(__dirname, "..");
const repoRootDir = path.resolve(backendDir, "..");
for (const envPath of [path.join(repoRootDir, ".env"), path.join(backendDir, ".env")]) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: true });
  }
}

const endpoint = process.env.S3_ENDPOINT?.trim() || process.env.MINIO_ENDPOINT?.trim();
if (!endpoint) {
  console.error("Set MINIO_ENDPOINT (or S3_ENDPOINT) in backend/.env first.");
  process.exit(1);
}

const accessKeyId =
  process.env.AWS_ACCESS_KEY_ID?.trim() || process.env.MINIO_ROOT_USER?.trim();
const secretAccessKey =
  process.env.AWS_SECRET_ACCESS_KEY?.trim() || process.env.MINIO_ROOT_PASSWORD?.trim();
if (!accessKeyId || !secretAccessKey) {
  console.error("Set MINIO_ROOT_USER/MINIO_ROOT_PASSWORD (or AWS keys) in backend/.env.");
  process.exit(1);
}

const region = process.env.AWS_REGION?.trim() || "us-east-1";
const buckets = [
  process.env.S3_BUCKET_AUDIO || process.env.MINIO_BUCKET_AUDIO || "audio",
  process.env.S3_BUCKET_VIDEO || process.env.MINIO_BUCKET_VIDEO || "video",
  process.env.S3_BUCKET_PDFS || process.env.MINIO_BUCKET_PDFS || "pdfs",
  process.env.S3_BUCKET_IMAGES || process.env.MINIO_BUCKET_IMAGES || "images"
];

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey }
});

async function ensureBucket(name: string) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: name }));
    console.log(`OK  ${name} (exists)`);
    return;
  } catch {
    // create below
  }
  await client.send(new CreateBucketCommand({ Bucket: name }));
  console.log(`OK  ${name} (created)`);
}

async function main() {
  console.log(`MinIO endpoint: ${endpoint}`);
  for (const bucket of [...new Set(buckets)]) {
    await ensureBucket(bucket);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error("Is MinIO running? docker compose -f docker/docker-compose.yml up -d minio");
  process.exit(1);
});
