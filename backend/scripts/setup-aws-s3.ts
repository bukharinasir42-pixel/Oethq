/**
 * Creates S3 asset buckets and verifies credentials.
 * Prerequisite: set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY in .env, then:
 *   cd backend && npm run storage:setup-aws
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client
} from "@aws-sdk/client-s3";
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

const region = process.env.AWS_REGION?.trim() || "us-east-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

if (!accessKeyId || !secretAccessKey) {
  console.error(
    "Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in .env.\n" +
      "Create an IAM access key (not your console password): IAM → Users → Security credentials → Create access key."
  );
  process.exit(1);
}

const accountId = process.env.AWS_ACCOUNT_ID?.trim() || "964019980553";
const prefix = process.env.S3_NAME_PREFIX?.trim() || `oetlms-${accountId}`;
const buckets = [
  process.env.S3_BUCKET_AUDIO?.trim() || `${prefix}-audio`,
  process.env.S3_BUCKET_VIDEO?.trim() || `${prefix}-video`,
  process.env.S3_BUCKET_PDFS?.trim() || `${prefix}-pdfs`,
  process.env.S3_BUCKET_IMAGES?.trim() || `${prefix}-images`
];

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey }
});

const cors = {
  CORSRules: [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
      AllowedOrigins: ["*"],
      MaxAgeSeconds: 3000
    }
  ]
};

function isBucketAlreadyOwned(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const o = error as { name?: string; Code?: string; message?: string };
  return (
    o.name === "BucketAlreadyOwnedByYou" ||
    o.Code === "BucketAlreadyOwnedByYou" ||
    (typeof o.message === "string" && o.message.includes("you already own it"))
  );
}

async function ensureBucket(name: string) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: name }));
    console.log(`OK  ${name} (exists)`);
  } catch {
    try {
      const input =
        region === "us-east-1"
          ? { Bucket: name }
          : {
              Bucket: name,
              CreateBucketConfiguration: {
                LocationConstraint: region as import("@aws-sdk/client-s3").BucketLocationConstraint
              }
            };
      await client.send(new CreateBucketCommand(input));
      console.log(`OK  ${name} (created)`);
    } catch (error) {
      if (isBucketAlreadyOwned(error)) {
        console.log(`OK  ${name} (exists)`);
      } else {
        throw error;
      }
    }
  }
  try {
    await client.send(new PutBucketCorsCommand({ Bucket: name, CORSConfiguration: cors }));
  } catch (error) {
    console.warn(`WARN ${name} CORS: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  console.log(`Region: ${region}`);
  console.log(`Buckets: ${buckets.join(", ")}`);
  for (const bucket of [...new Set(buckets)]) {
    await ensureBucket(bucket);
  }
  console.log("\nS3 setup complete. Restart the backend API if it is already running.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
