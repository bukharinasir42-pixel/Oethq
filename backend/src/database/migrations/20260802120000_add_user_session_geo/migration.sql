-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN "country" TEXT;
ALTER TABLE "UserSession" ADD COLUMN "city" TEXT;

-- CreateIndex
CREATE INDEX "UserSession_userId_country_idx" ON "UserSession"("userId", "country");
