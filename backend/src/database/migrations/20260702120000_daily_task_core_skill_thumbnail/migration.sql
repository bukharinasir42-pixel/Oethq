-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN "articleThumbnailAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_articleThumbnailAssetId_fkey" FOREIGN KEY ("articleThumbnailAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
