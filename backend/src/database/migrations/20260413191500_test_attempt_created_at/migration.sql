-- TestAttempt.createdAt exists in schema.prisma but was omitted from the sync migration
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
