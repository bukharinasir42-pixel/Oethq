-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('READING', 'LISTENING', 'WRITING', 'SPEAKING');

-- CreateTable
CREATE TABLE "CourseLecture" (
    "id" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "bunnyVideoId" TEXT,
    "videoUrl" TEXT,
    "durationMin" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLecture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLecture_skill_isPublished_displayOrder_idx" ON "CourseLecture"("skill", "isPublished", "displayOrder");
