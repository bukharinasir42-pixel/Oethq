-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN "cheatSheetAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_cheatSheetAssetId_fkey" FOREIGN KEY ("cheatSheetAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
