-- AlterTable
ALTER TABLE "User" ADD COLUMN     "screenshotStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;
