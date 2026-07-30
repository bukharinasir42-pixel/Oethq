-- CreateTable
CREATE TABLE "SkillDrill" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillDrill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillDrill_module_isActive_displayOrder_idx" ON "SkillDrill"("module", "isActive", "displayOrder");
