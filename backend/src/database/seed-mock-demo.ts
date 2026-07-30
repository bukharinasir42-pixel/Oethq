/**
 * Clears all tests/tasks, uploads sample audio + PDF assets to S3/MinIO, and seeds one mock
 * listening test, one mock reading test, and Day 1 daily task with linked assets.
 *
 * Requires: DATABASE_URL, S3/MinIO env (see backend/.env). Start MinIO: docker compose -f docker/docker-compose.yml up -d minio
 */
import { createWriteStream } from "node:fs";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { config as loadEnv } from "dotenv";
import { AssetKind, PrismaClient, TestType } from "@prisma/client";
import { buildQuestions, LISTENING_TRACK_LABELS } from "../modules/tests/question-templates";
import { PrismaPg } from "@prisma/adapter-pg";
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const envRoot = resolve(__dirname, "../../../.env");
const envBackend = resolve(__dirname, "../../.env");
if (existsSync(envRoot)) loadEnv({ path: envRoot });
if (existsSync(envBackend)) loadEnv({ path: envBackend, override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const SAMPLE_AUDIO_URL = "https://filesamples.com/samples/audio/mp3/sample3.mp3";
const SAMPLE_PDF_URL = "https://pdfobject.com/pdf/sample.pdf";

function createS3Client(): S3Client {
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const endpoint = process.env.S3_ENDPOINT?.trim() || process.env.MINIO_ENDPOINT?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (endpoint) {
    return new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {})
    });
  }

  return new S3Client({ region, followRegionRedirects: true });
}

function bucketForKind(kind: AssetKind): string {
  switch (kind) {
    case AssetKind.AUDIO:
      return process.env.S3_BUCKET_AUDIO || process.env.MINIO_BUCKET_AUDIO || "audio";
    case AssetKind.PDF:
      return process.env.S3_BUCKET_PDFS || process.env.MINIO_BUCKET_PDFS || "pdfs";
    default:
      throw new Error(`Unsupported asset kind for demo seed: ${kind}`);
  }
}

async function ensureBucket(client: S3Client, bucket: string) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch {
    // bucket missing — create below
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const code =
      error && typeof error === "object" && "Code" in error
        ? String((error as { Code?: string }).Code)
        : "";
    if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists") {
      throw error;
    }
  }
}

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
}

async function uploadAsset(
  client: S3Client,
  input: {
    localPath: string;
    kind: AssetKind;
    title: string;
    contentType: string;
  }
) {
  const bucket = bucketForKind(input.kind);
  await ensureBucket(client, bucket);

  const buffer = await readFile(input.localPath);
  const basename = sanitizeFilename(input.localPath.split(/[/\\]/).pop() || "file");
  const objectKey = `${input.kind.toLowerCase()}/demo-${Date.now()}-${basename}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: input.contentType
    })
  );

  return prisma.storageObject.upsert({
    where: { objectKey },
    create: {
      kind: input.kind,
      bucket,
      objectKey,
      title: input.title,
      contentType: input.contentType,
      sizeBytes: buffer.length
    },
    update: {
      kind: input.kind,
      bucket,
      title: input.title,
      contentType: input.contentType,
      sizeBytes: buffer.length
    }
  });
}

async function clearTestsAndTasks() {
  const counts = await prisma.$transaction(async (tx) => {
    const a = await tx.attemptAnswer.deleteMany();
    const att = await tx.testAttempt.deleteMany();
    const res = await tx.testResult.deleteMany();
    const trk = await tx.listeningAudioTrack.deleteMany();
    const q = await tx.question.deleteMany();
    const dt = await tx.dailyTask.deleteMany();
    const t = await tx.test.deleteMany();
    return {
      attemptAnswers: a.count,
      testAttempts: att.count,
      testResults: res.count,
      listeningTracks: trk.count,
      questions: q.count,
      dailyTasks: dt.count,
      tests: t.count
    };
  });
  // eslint-disable-next-line no-console
  console.log("Cleared test/task data:", counts);
}

async function main() {
  const cacheDir = resolve(__dirname, "../../../.cache/seed-mock-demo");
  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });

  const audioPath = resolve(cacheDir, "listening-extract.mp3");
  const pdfPath = resolve(cacheDir, "reading-booklet.pdf");

  // eslint-disable-next-line no-console
  console.log("Downloading sample assets...");
  await downloadFile(SAMPLE_AUDIO_URL, audioPath);
  await downloadFile(SAMPLE_PDF_URL, pdfPath);

  await clearTestsAndTasks();

  const s3 = createS3Client();

  // eslint-disable-next-line no-console
  console.log("Uploading assets to storage...");
  await ensureBucket(s3, bucketForKind(AssetKind.AUDIO));
  await ensureBucket(s3, bucketForKind(AssetKind.PDF));

  const listeningAudioAssets = await Promise.all(
    LISTENING_TRACK_LABELS.map((label) =>
      uploadAsset(s3, {
        localPath: audioPath,
        kind: AssetKind.AUDIO,
        title: label,
        contentType: "audio/mpeg"
      })
    )
  );

  const [readingPartA, readingPartB, readingPartC, lecturePdf, pastPaperPdf] = await Promise.all([
      uploadAsset(s3, {
        localPath: pdfPath,
        kind: AssetKind.PDF,
        title: "Reading Part A booklet",
        contentType: "application/pdf"
      }),
      uploadAsset(s3, {
        localPath: pdfPath,
        kind: AssetKind.PDF,
        title: "Reading Part B booklet",
        contentType: "application/pdf"
      }),
      uploadAsset(s3, {
        localPath: pdfPath,
        kind: AssetKind.PDF,
        title: "Reading Part C booklet",
        contentType: "application/pdf"
      }),
      uploadAsset(s3, {
        localPath: pdfPath,
        kind: AssetKind.PDF,
        title: "Day 1 Lecture Slides",
        contentType: "application/pdf"
      }),
      uploadAsset(s3, {
        localPath: pdfPath,
        kind: AssetKind.PDF,
        title: "Day 1 Past Paper PDF",
        contentType: "application/pdf"
      })
    ]);

  const listeningTest = await prisma.test.create({
    data: {
      type: TestType.LISTENING,
      title: "Listening Test",
      description: "Demo listening test with 10 OET-style audio extracts (sample MP3).",
      instructions: "Listen once per extract. No pause or rewind.",
      totalQuestions: 42,
      timerDuration: 50,
      isPublished: true,
      listeningTracks: {
        create: listeningAudioAssets.map((asset, sortOrder) => ({
          sortOrder,
          label: LISTENING_TRACK_LABELS[sortOrder],
          assetId: asset.id
        }))
      },
      questions: { create: buildQuestions(TestType.LISTENING) }
    }
  });

  const readingTest = await prisma.test.create({
    data: {
      type: TestType.READING,
      title: "Reading Test",
      description: "Demo reading test with separate Part B and Part C booklets.",
      instructions: "Part A: 15 minutes. Parts B & C: 45 minutes shared.",
      totalQuestions: 42,
      timerDuration: 60,
      partATimer: 15,
      partBCTimer: 45,
      bookletAssetId: readingPartA.id,
      partBBookletAssetId: readingPartB.id,
      partCBookletAssetId: readingPartC.id,
      isPublished: true,
      questions: { create: buildQuestions(TestType.READING) }
    }
  });

  const pastPaperTest = await prisma.test.create({
    data: {
      type: TestType.READING,
      title: "Past Paper Test",
      description: "Demo past paper linked from Day 1 task.",
      instructions: "Exam-condition review using the attached PDF.",
      totalQuestions: 42,
      timerDuration: 60,
      partATimer: 15,
      partBCTimer: 45,
      bookletAssetId: pastPaperPdf.id,
      isPublished: true,
      questions: { create: buildQuestions(TestType.READING) }
    }
  });

  await prisma.dailyTask.create({
    data: {
      dayNumber: 1,
      title: "Task day 1",
      summary: "Sample lecture PDF, article link, and listening/reading/past-paper tests.",
      lectureTitle: "Introduction to OET Listening",
      lectureUrl: "https://example.com/lectures/day-1",
      lectureAssetId: lecturePdf.id,
      articleTitle: "Reading strategies overview",
      articleUrl: "https://example.com/articles/reading-strategies",
      assignedReadingTestId: readingTest.id,
      assignedListeningTestId: listeningTest.id,
      assignedPastPaperTestId: pastPaperTest.id,
      pastPaperTitle: "Past Paper (PDF)",
      pastPaperUrl: "https://example.com/past-papers/mock-1.pdf",
      pastPaperAssetId: pastPaperPdf.id,
      isPublished: true
    }
  });

  // eslint-disable-next-line no-console
  console.log("Mock demo seed complete:");
  // eslint-disable-next-line no-console
  console.log(`  Listening test: ${listeningTest.id} (${listeningTest.title})`);
  // eslint-disable-next-line no-console
  console.log(`  Reading test:   ${readingTest.id} (${readingTest.title})`);
  // eslint-disable-next-line no-console
  console.log(`  Past paper:     ${pastPaperTest.id} (${pastPaperTest.title})`);
  // eslint-disable-next-line no-console
  console.log("  Daily task:     Day 1 with lecture PDF + past paper PDF + assigned tests");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
