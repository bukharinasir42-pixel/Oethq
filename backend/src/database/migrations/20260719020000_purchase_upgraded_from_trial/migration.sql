-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "upgradedFromTrial" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Purchase_upgradedFromTrial_idx" ON "Purchase"("upgradedFromTrial");
