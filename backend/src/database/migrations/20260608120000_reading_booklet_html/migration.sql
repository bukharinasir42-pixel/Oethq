-- Reading booklet content as rich HTML (replaces PDF uploads for Parts A, B, C)
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "partABookletHtml" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "partBBookletHtml" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "partCBookletHtml" TEXT;
