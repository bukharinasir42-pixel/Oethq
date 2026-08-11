-- Lead capture and image attachments for the assistant. Additive and idempotent.

ALTER TABLE "ChatConversation" ADD COLUMN IF NOT EXISTS "leadAskedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChatConversation" ADD COLUMN IF NOT EXISTS "leadCapturedAt" TIMESTAMP(3);
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "attachmentCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ChatLead" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "name" TEXT,
    "profession" TEXT,
    "examDate" TEXT,
    "channel" "TrafficChannel",
    "source" TEXT,
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatLead_conversationId_key" ON "ChatLead"("conversationId");
CREATE INDEX IF NOT EXISTS "ChatLead_createdAt_idx" ON "ChatLead"("createdAt");
CREATE INDEX IF NOT EXISTS "ChatLead_channel_idx" ON "ChatLead"("channel");
CREATE INDEX IF NOT EXISTS "ChatLead_contactedAt_idx" ON "ChatLead"("contactedAt");

DO $$ BEGIN
  ALTER TABLE "ChatLead" ADD CONSTRAINT "ChatLead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
