-- Reading answer explanations. Additive and idempotent.

DO $$ BEGIN
  CREATE TYPE "ExplanationStatus" AS ENUM ('DRAFT', 'APPROVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A score earned after the answer key has been read is not evidence of anything,
-- and the Pass Predictor must never be fed one.
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "isPractice" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "TestExplanation" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "part" "QuestionPart",
    "evidence" TEXT NOT NULL,
    "evidenceLetter" TEXT,
    "reasoning" TEXT NOT NULL,
    "options" JSONB,
    "skillTag" TEXT,
    "status" "ExplanationStatus" NOT NULL DEFAULT 'DRAFT',
    "model" TEXT,
    "generatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestExplanation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExplanationView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplanationView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TestExplanation_testId_questionNumber_key" ON "TestExplanation"("testId", "questionNumber");
CREATE INDEX IF NOT EXISTS "TestExplanation_testId_status_idx" ON "TestExplanation"("testId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ExplanationView_userId_testId_key" ON "ExplanationView"("userId", "testId");
CREATE INDEX IF NOT EXISTS "ExplanationView_testId_idx" ON "ExplanationView"("testId");

DO $$ BEGIN
  ALTER TABLE "TestExplanation" ADD CONSTRAINT "TestExplanation_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ExplanationView" ADD CONSTRAINT "ExplanationView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ExplanationView" ADD CONSTRAINT "ExplanationView_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
