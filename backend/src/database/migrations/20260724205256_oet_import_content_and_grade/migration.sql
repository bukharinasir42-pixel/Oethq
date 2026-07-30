-- CreateEnum
CREATE TYPE "OetGrade" AS ENUM ('A', 'B', 'C_PLUS', 'C', 'D', 'E');

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "contentJson" JSONB,
ADD COLUMN     "contentSchemaVersion" INTEGER;

-- AlterTable
ALTER TABLE "TestAttempt" ADD COLUMN     "oetGrade" "OetGrade",
ADD COLUMN     "scaledScore" INTEGER;

-- AlterTable
ALTER TABLE "TestResult" ADD COLUMN     "oetGrade" "OetGrade",
ADD COLUMN     "scaledScore" INTEGER;
