-- Repair drift between schema.prisma and the migration history.
--
-- These columns and this enum value were added to the schema and pushed
-- straight to the running database (prisma db push) without a migration ever
-- being written. The live database has them, so this is a no-op there — but a
-- database built purely from `prisma migrate deploy` did NOT, which meant a
-- fresh environment could not be created at all: the seed died on
-- `Product.tierRank` and `User.onboardingWatchedAt` before writing a row.
--
-- That breaks a new deploy, a new developer's machine, a staging rebuild and
-- disaster recovery. Every statement is IF NOT EXISTS so it is safe to run
-- against the live database, which already has all of it.
--
-- Dated ahead of the 2026-08-02 migrations so a fresh database gets these
-- columns before the work that depends on them.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "caseNoteLimit"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mockTestLimit"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "passPredictor"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pastPaperLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "retiredAt"      TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tierRank"       INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingWatchedAt" TIMESTAMP(3);

-- ADD VALUE IF NOT EXISTS is transactional-safe on PostgreSQL 12+.
ALTER TYPE "PortalResourcePlacement" ADD VALUE IF NOT EXISTS 'ONBOARDING_INTRO';
