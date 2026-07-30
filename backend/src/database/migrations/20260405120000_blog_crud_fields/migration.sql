-- BlogType for category badges
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BlogType') THEN
    CREATE TYPE "BlogType" AS ENUM ('READING', 'SPEAKING', 'WRITING', 'LISTENING');
  END IF;
END $$;

-- IMAGE uploads (StorageObject.kind)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetKind') THEN
    CREATE TYPE "AssetKind" AS ENUM ('AUDIO', 'PDF', 'LINK', 'IMAGE');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetKind')
     AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AssetKind' AND e.enumlabel = 'IMAGE'
  ) THEN
    ALTER TYPE "AssetKind" ADD VALUE 'IMAGE';
  END IF;
END $$;

ALTER TABLE "Blog" DROP CONSTRAINT IF EXISTS "Blog_title_key";

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "blogType" "BlogType" NOT NULL DEFAULT 'READING';
ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "imageAssetId" TEXT;

UPDATE "Blog" SET "description" = LEFT(COALESCE("content", ''), 500) WHERE "description" = '';

ALTER TABLE "Blog" ALTER COLUMN "content" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Blog_status_publishedAt_idx" ON "Blog"("status", "publishedAt");
