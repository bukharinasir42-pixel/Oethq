-- CreateTable
CREATE TABLE "PastPaper" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "listeningTestId" TEXT NOT NULL,
    "readingTestId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastPaper_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "assignedPastPaperId" TEXT;

-- CreateIndex
CREATE INDEX "PastPaper_listeningTestId_idx" ON "PastPaper"("listeningTestId");
CREATE INDEX "PastPaper_readingTestId_idx" ON "PastPaper"("readingTestId");

-- AddForeignKey
ALTER TABLE "PastPaper" ADD CONSTRAINT "PastPaper_listeningTestId_fkey" FOREIGN KEY ("listeningTestId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PastPaper" ADD CONSTRAINT "PastPaper_readingTestId_fkey" FOREIGN KEY ("readingTestId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_assignedPastPaperId_fkey" FOREIGN KEY ("assignedPastPaperId") REFERENCES "PastPaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;
