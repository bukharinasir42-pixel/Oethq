/**
 * Deletes all tests, **all DailyTask rows** (daily schedule), attempts, results, and related rows.
 * Preserves: User, OTPCode, Plan, Subscription, Purchase, Blog, AuditLog, StorageObject (orphans may remain).
 *
 * To remove only the task calendar without touching tests: `npm run db:clear-tasks`
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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

async function main() {
  const counts = await prisma.$transaction(async (tx) => {
    const a = await tx.attemptAnswer.deleteMany();
    const att = await tx.testAttempt.deleteMany();
    const res = await tx.testResult.deleteMany();
    const trk = await tx.listeningAudioTrack.deleteMany();
    const q = await tx.question.deleteMany();
    const dt = await tx.dailyTask.deleteMany();
    const t = await tx.test.deleteMany();
    return { attemptAnswers: a.count, testAttempts: att.count, testResults: res.count, listeningTracks: trk.count, questions: q.count, dailyTasks: dt.count, tests: t.count };
  });

  // eslint-disable-next-line no-console
  console.log("Cleared test/task data:", counts);
  const users = await prisma.user.count();
  const otps = await prisma.oTPCode.count();
  // eslint-disable-next-line no-console
  console.log(`Preserved: ${users} user(s), ${otps} OTP row(s).`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
