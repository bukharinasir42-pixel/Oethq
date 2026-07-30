import { GetBucketLocationCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

const backendDir = path.resolve(__dirname, "..");
const repoRootDir = path.resolve(backendDir, "..");
for (const envPath of [path.join(repoRootDir, ".env"), path.join(backendDir, ".env")]) {
  if (existsSync(envPath)) loadEnv({ path: envPath, override: true });
}

const bucket = process.env.S3_BUCKET_AUDIO?.trim();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
if (!bucket || !accessKeyId || !secretAccessKey) {
  console.error("Missing bucket or credentials");
  process.exit(1);
}

const credentials = { accessKeyId, secretAccessKey };

async function main() {
  const client = new S3Client({ region: "us-east-1", credentials });
  const loc = await client.send(new GetBucketLocationCommand({ Bucket: bucket }));
  const bucketRegion = loc.LocationConstraint || "us-east-1";
  console.log(`Bucket ${bucket} is in region: ${bucketRegion}`);

  const regional = new S3Client({ region: bucketRegion, credentials });
  await regional.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log("HeadBucket OK with regional client");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
