-- AlterTable
ALTER TABLE "User" ADD COLUMN "writingCode" TEXT;

-- CreateTable
CREATE TABLE "WritingCaseNote" (
    "id" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "caseNotesHtml" TEXT NOT NULL,
    "wordGuidance" TEXT,
    "timeLimitMin" INTEGER NOT NULL DEFAULT 45,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingCaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSetting" (
    "id" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "correctionEmail" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseNoteId" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "letterNumber" INTEGER NOT NULL,
    "letterText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "emailDelivered" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_writingCode_key" ON "User"("writingCode");
CREATE INDEX "WritingCaseNote_profession_isActive_displayOrder_idx" ON "WritingCaseNote"("profession", "isActive", "displayOrder");
CREATE UNIQUE INDEX "WritingSetting_profession_key" ON "WritingSetting"("profession");
CREATE INDEX "WritingSubmission_userId_submittedAt_idx" ON "WritingSubmission"("userId", "submittedAt");
CREATE INDEX "WritingSubmission_caseNoteId_idx" ON "WritingSubmission"("caseNoteId");
