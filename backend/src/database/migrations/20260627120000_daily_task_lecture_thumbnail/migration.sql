-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN "lectureThumbnailAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_lectureThumbnailAssetId_fkey" FOREIGN KEY ("lectureThumbnailAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
