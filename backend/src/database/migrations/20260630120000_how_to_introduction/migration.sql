-- CreateTable
CREATE TABLE "HowToIntroduction" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL DEFAULT 'Introduction (How to use)',
    "videoAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HowToIntroduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HowToIntroduction_videoAssetId_key" ON "HowToIntroduction"("videoAssetId");

-- AddForeignKey
ALTER TABLE "HowToIntroduction" ADD CONSTRAINT "HowToIntroduction_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed singleton row
INSERT INTO "HowToIntroduction" ("id", "title", "updatedAt") VALUES ('default', 'Introduction (How to use)', CURRENT_TIMESTAMP);
