-- Sync DB with current Prisma schema (test engine, TestResult, StorageObject, AttemptAnswer).
-- Safe re-run: uses IF EXISTS / IF NOT EXISTS where supported.

-- Enums for test attempts
DO $$ BEGIN
  CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'ABANDONED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttemptSection" AS ENUM ('LISTENING', 'READING_PART_A', 'READING_PART_BC', 'COMPLETE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- OTP enum alignment (no-op if already identical)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OTPPurpose') THEN
    BEGIN
      CREATE TYPE "OTPPurpose_new" AS ENUM ('REGISTER', 'LOGIN', 'FREE_TRIAL', 'SUBSCRIPTION_ACTIVATION');
      ALTER TABLE "OTPCode" ALTER COLUMN "purpose" TYPE "OTPPurpose_new" USING ("purpose"::text::"OTPPurpose_new");
      ALTER TYPE "OTPPurpose" RENAME TO "OTPPurpose_old";
      ALTER TYPE "OTPPurpose_new" RENAME TO "OTPPurpose";
      DROP TYPE "public"."OTPPurpose_old";
    EXCEPTION
      WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- phase1_init did not create TestAttempt; older deployments that skipped intermediate
-- migrations need a baseline table before the ALTERs below.
CREATE TABLE IF NOT EXISTS "TestAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "answers" JSONB,
    "attemptNumber" INTEGER,
    "completedAt" TIMESTAMP(3),
    "partScores" JSONB,
    "score" INTEGER NOT NULL,
    "bandLabel" "BandLabel" NOT NULL,
    "passProbability" DOUBLE PRECISION NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

-- Prepare Question for sequence (avoid NOT NULL violation on existing rows)
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "sequence" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Question' AND column_name = 'orderIndex'
  ) THEN
    UPDATE "Question" SET "sequence" = COALESCE("orderIndex", 1) WHERE "sequence" IS NULL;
    ALTER TABLE "Question" DROP COLUMN "orderIndex";
  END IF;
END $$;

UPDATE "Question" SET "sequence" = 1 WHERE "sequence" IS NULL;

ALTER TABLE "Question" ALTER COLUMN "sequence" SET NOT NULL;

DROP INDEX IF EXISTS "Question_testId_sequence_key";

ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_testId_fkey";

ALTER TABLE "Test" DROP COLUMN IF EXISTS "audioObjectKey";
ALTER TABLE "Test" DROP COLUMN IF EXISTS "isPastPaper";
ALTER TABLE "Test" DROP COLUMN IF EXISTS "listeningFinalizeSeconds";
ALTER TABLE "Test" DROP COLUMN IF EXISTS "pdfObjectKey";
ALTER TABLE "Test" DROP COLUMN IF EXISTS "readingPartAMinutes";
ALTER TABLE "Test" DROP COLUMN IF EXISTS "readingPartBCMinutes";

ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "audioAssetId" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "bookletAssetId" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "partATimer" INTEGER;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "partBCTimer" INTEGER;

ALTER TABLE "TestAttempt" DROP CONSTRAINT IF EXISTS "TestAttempt_testId_fkey";
ALTER TABLE "TestAttempt" DROP CONSTRAINT IF EXISTS "TestAttempt_userId_fkey";

DROP INDEX IF EXISTS "TestAttempt_userId_testId_attemptNumber_key";
DROP INDEX IF EXISTS "TestAttempt_userId_testId_idx";

ALTER TABLE "TestAttempt" DROP COLUMN IF EXISTS "answers";
ALTER TABLE "TestAttempt" DROP COLUMN IF EXISTS "attemptNumber";
ALTER TABLE "TestAttempt" DROP COLUMN IF EXISTS "completedAt";
ALTER TABLE "TestAttempt" DROP COLUMN IF EXISTS "partScores";

ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "answersJson" JSONB;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "audioCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "audioPositionSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "audioUnlockedAt" TIMESTAMP(3);
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "autoSubmittedAt" TIMESTAMP(3);
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "countdownStartedAt" TIMESTAMP(3);
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "partAScore" INTEGER;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "partBScore" INTEGER;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "partCScore" INTEGER;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "questionCountAnswered" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "sectionExpiresAt" TIMESTAMP(3);
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "timeRemainingSeconds" INTEGER;

ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
UPDATE "TestAttempt" SET "expiresAt" = CURRENT_TIMESTAMP + interval '1 day' WHERE "expiresAt" IS NULL;
ALTER TABLE "TestAttempt" ALTER COLUMN "expiresAt" SET NOT NULL;

ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "section" "AttemptSection";
UPDATE "TestAttempt" SET "section" = 'COMPLETE'::"AttemptSection" WHERE "section" IS NULL;
ALTER TABLE "TestAttempt" ALTER COLUMN "section" SET NOT NULL;

ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS';

ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "TestAttempt" ALTER COLUMN "score" DROP NOT NULL;
ALTER TABLE "TestAttempt" ALTER COLUMN "bandLabel" DROP NOT NULL;
ALTER TABLE "TestAttempt" ALTER COLUMN "passProbability" DROP NOT NULL;

ALTER TABLE "Blog" ALTER COLUMN "description" DROP DEFAULT;

ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "articleAssetId" TEXT;
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "articleTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "lectureAssetId" TEXT;
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "lectureTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "pastPaperAssetId" TEXT;
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "pastPaperTitle" TEXT;
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "pastPaperUrl" TEXT;
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';

UPDATE "DailyTask" SET "lectureTitle" = COALESCE(NULLIF("lectureTitle", ''), "lectureUrl") WHERE "lectureTitle" = '';
UPDATE "DailyTask" SET "articleTitle" = COALESCE(NULLIF("articleTitle", ''), "articleUrl") WHERE "articleTitle" = '';
UPDATE "DailyTask" SET "title" = COALESCE(NULLIF("title", ''), 'Day ' || "dayNumber"::text) WHERE "title" = '';

ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "activationToken" TEXT;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "activationUrl" TEXT;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "TestResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "latestAttemptId" TEXT,
    "score" INTEGER NOT NULL,
    "partAScore" INTEGER,
    "partBScore" INTEGER,
    "partCScore" INTEGER,
    "bandLabel" "BandLabel" NOT NULL,
    "passProbability" DOUBLE PRECISION NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "attemptsCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TestResult" ADD COLUMN IF NOT EXISTS "latestAttemptId" TEXT;
ALTER TABLE "TestResult" ADD COLUMN IF NOT EXISTS "partAScore" INTEGER;
ALTER TABLE "TestResult" ADD COLUMN IF NOT EXISTS "partBScore" INTEGER;
ALTER TABLE "TestResult" ADD COLUMN IF NOT EXISTS "partCScore" INTEGER;
ALTER TABLE "TestResult" ADD COLUMN IF NOT EXISTS "attemptsCount" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "StorageObject" (
    "id" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageObject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttemptAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TestResult_userId_idx" ON "TestResult"("userId");
CREATE INDEX IF NOT EXISTS "TestResult_testId_idx" ON "TestResult"("testId");
CREATE UNIQUE INDEX IF NOT EXISTS "TestResult_userId_testId_key" ON "TestResult"("userId", "testId");

CREATE UNIQUE INDEX IF NOT EXISTS "StorageObject_objectKey_key" ON "StorageObject"("objectKey");

CREATE INDEX IF NOT EXISTS "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");
CREATE UNIQUE INDEX IF NOT EXISTS "AttemptAnswer_attemptId_questionId_key" ON "AttemptAnswer"("attemptId", "questionId");

CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_activationToken_key" ON "Purchase"("activationToken");

CREATE UNIQUE INDEX IF NOT EXISTS "Question_testId_sequence_key" ON "Question"("testId", "sequence");

CREATE INDEX IF NOT EXISTS "TestAttempt_status_idx" ON "TestAttempt"("status");

ALTER TABLE "Test" DROP CONSTRAINT IF EXISTS "Test_audioAssetId_fkey";
ALTER TABLE "Test" DROP CONSTRAINT IF EXISTS "Test_bookletAssetId_fkey";
ALTER TABLE "Test" ADD CONSTRAINT "Test_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Test" ADD CONSTRAINT "Test_bookletAssetId_fkey" FOREIGN KEY ("bookletAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Question" ADD CONSTRAINT "Question_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TestResult" DROP CONSTRAINT IF EXISTS "TestResult_userId_fkey";
ALTER TABLE "TestResult" DROP CONSTRAINT IF EXISTS "TestResult_testId_fkey";
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyTask" DROP CONSTRAINT IF EXISTS "DailyTask_lectureAssetId_fkey";
ALTER TABLE "DailyTask" DROP CONSTRAINT IF EXISTS "DailyTask_articleAssetId_fkey";
ALTER TABLE "DailyTask" DROP CONSTRAINT IF EXISTS "DailyTask_pastPaperAssetId_fkey";
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_lectureAssetId_fkey" FOREIGN KEY ("lectureAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_articleAssetId_fkey" FOREIGN KEY ("articleAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_pastPaperAssetId_fkey" FOREIGN KEY ("pastPaperAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StorageObject" DROP CONSTRAINT IF EXISTS "StorageObject_uploadedById_fkey";
ALTER TABLE "StorageObject" ADD CONSTRAINT "StorageObject_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttemptAnswer" DROP CONSTRAINT IF EXISTS "AttemptAnswer_attemptId_fkey";
ALTER TABLE "AttemptAnswer" DROP CONSTRAINT IF EXISTS "AttemptAnswer_questionId_fkey";
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
