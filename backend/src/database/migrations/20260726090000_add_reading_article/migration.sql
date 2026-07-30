-- CreateTable
CREATE TABLE "ReadingArticle" (
    "id" TEXT NOT NULL,
    "kicker" TEXT,
    "title" TEXT NOT NULL,
    "standfirst" TEXT,
    "bodyText" TEXT NOT NULL,
    "attribution" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingArticle_isActive_displayOrder_idx" ON "ReadingArticle"("isActive", "displayOrder");
