-- CreateTable
CREATE TABLE "WebsiteHomeContent" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "heroVideoAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteHomeContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteHomeContent_heroVideoAssetId_key" ON "WebsiteHomeContent"("heroVideoAssetId");

-- AddForeignKey
ALTER TABLE "WebsiteHomeContent" ADD CONSTRAINT "WebsiteHomeContent_heroVideoAssetId_fkey" FOREIGN KEY ("heroVideoAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
