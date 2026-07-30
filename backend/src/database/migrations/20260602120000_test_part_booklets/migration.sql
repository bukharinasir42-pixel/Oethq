-- AlterTable
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "partBBookletAssetId" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "partCBookletAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "Test" DROP CONSTRAINT IF EXISTS "Test_partBBookletAssetId_fkey";
ALTER TABLE "Test" ADD CONSTRAINT "Test_partBBookletAssetId_fkey" FOREIGN KEY ("partBBookletAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Test" DROP CONSTRAINT IF EXISTS "Test_partCBookletAssetId_fkey";
ALTER TABLE "Test" ADD CONSTRAINT "Test_partCBookletAssetId_fkey" FOREIGN KEY ("partCBookletAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
