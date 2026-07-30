-- AlterTable
ALTER TABLE "HowToIntroduction" ADD COLUMN "thumbnailAssetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HowToIntroduction_thumbnailAssetId_key" ON "HowToIntroduction"("thumbnailAssetId");

-- AddForeignKey
ALTER TABLE "HowToIntroduction" ADD CONSTRAINT "HowToIntroduction_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
