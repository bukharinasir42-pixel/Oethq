-- AlterEnum
ALTER TYPE "PortalResourcePlacement" ADD VALUE 'SPEAKING_HACK_SENTENCES';

-- AlterTable
ALTER TABLE "PortalResource" ADD COLUMN "profession" TEXT;

-- CreateIndex
CREATE INDEX "PortalResource_placement_profession_isPublished_idx"
  ON "PortalResource"("placement", "profession", "isPublished");
