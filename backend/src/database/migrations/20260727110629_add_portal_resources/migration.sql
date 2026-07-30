-- CreateEnum
CREATE TYPE "PortalResourcePlacement" AS ENUM ('READING_CHEATSHEET', 'LISTENING_CHEATSHEET', 'READING_ARTICLE_INTRO');

-- CreateEnum
CREATE TYPE "PortalResourceKind" AS ENUM ('PDF', 'VIDEO');

-- CreateTable
CREATE TABLE "PortalResource" (
    "id" TEXT NOT NULL,
    "placement" "PortalResourcePlacement" NOT NULL,
    "kind" "PortalResourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "pdfUrl" TEXT,
    "bunnyVideoId" TEXT,
    "videoUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalResource_placement_isPublished_displayOrder_idx" ON "PortalResource"("placement", "isPublished", "displayOrder");
