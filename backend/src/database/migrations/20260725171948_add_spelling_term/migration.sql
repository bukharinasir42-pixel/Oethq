-- CreateTable
CREATE TABLE "SpellingTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hint" TEXT NOT NULL DEFAULT '',
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "words" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpellingTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpellingTerm_category_isActive_idx" ON "SpellingTerm"("category", "isActive");

-- CreateIndex
CREATE INDEX "SpellingTerm_isActive_idx" ON "SpellingTerm"("isActive");
