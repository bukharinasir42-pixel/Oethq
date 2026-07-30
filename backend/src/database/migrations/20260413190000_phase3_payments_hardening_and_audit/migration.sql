ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "checkoutSessionId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "receiptData" JSONB;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "webhookEventId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "webhookPayload" JSONB;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "webhookReceivedAt" TIMESTAMP(3);
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_checkoutSessionId_key" ON "Purchase"("checkoutSessionId");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "route" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
