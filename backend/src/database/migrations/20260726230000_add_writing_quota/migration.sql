-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "writingLimit" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "writingCorrections" INTEGER NOT NULL DEFAULT 0;
