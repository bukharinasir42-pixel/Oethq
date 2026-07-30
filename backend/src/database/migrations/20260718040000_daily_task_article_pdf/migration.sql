-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN "articlePdfAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_articlePdfAssetId_fkey" FOREIGN KEY ("articlePdfAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
