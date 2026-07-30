-- AlterTable
ALTER TABLE "DailyTask" ALTER COLUMN "articleTitle" DROP DEFAULT,
ALTER COLUMN "lectureTitle" DROP DEFAULT,
ALTER COLUMN "title" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TestAttempt" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "TestAttempt_userId_idx" ON "TestAttempt"("userId");

-- CreateIndex
CREATE INDEX "TestAttempt_testId_idx" ON "TestAttempt"("testId");
