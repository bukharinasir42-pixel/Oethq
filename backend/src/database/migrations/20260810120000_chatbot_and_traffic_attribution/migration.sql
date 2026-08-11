-- Chatbot + traffic attribution.
--
-- Additive only: no existing table is rewritten and no existing column changes
-- type or default, so this can be applied to a live database while it serves.
--
-- Written idempotently (IF NOT EXISTS / guarded DO blocks) because this is a
-- large migration and a half-applied run must be safe to re-run.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TrafficChannel" AS ENUM ('DIRECT', 'ORGANIC_SEARCH', 'PAID_SEARCH', 'YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'TELEGRAM', 'LINKEDIN', 'TWITTER', 'PAID_SOCIAL', 'EMAIL', 'REFERRAL', 'ADMIN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: measured signup attribution, alongside the self-reported heardFrom
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupChannel" "TrafficChannel";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupSource" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupCampaign" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupLandingPath" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Visitor" (
    "id" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "firstChannel" "TrafficChannel" NOT NULL,
    "firstSource" TEXT,
    "firstMedium" TEXT,
    "firstCampaign" TEXT,
    "firstTerm" TEXT,
    "firstContent" TEXT,
    "firstReferrer" TEXT,
    "firstLandingPath" TEXT,
    "firstClickId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChannel" "TrafficChannel" NOT NULL,
    "lastSource" TEXT,
    "lastMedium" TEXT,
    "lastCampaign" TEXT,
    "lastReferrer" TEXT,
    "lastLandingPath" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageViews" INTEGER NOT NULL DEFAULT 1,
    "sessions" INTEGER NOT NULL DEFAULT 1,
    "country" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatConversation" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT,
    "userId" TEXT,
    "channel" "TrafficChannel",
    "source" TEXT,
    "campaign" TEXT,
    "landingPath" TEXT,
    "title" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handoffAt" TIMESTAMP(3),

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citedChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'document',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
--
-- "searchVector" is a plain tsvector column rather than a GENERATED column: the
-- ingest writes it with to_tsvector in the same statement as the row, and a
-- stored generated column would be invisible to Prisma's migration diff and
-- report as drift on every subsequent `migrate dev`.
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "searchVector" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Visitor_visitorKey_key" ON "Visitor"("visitorKey");
CREATE INDEX IF NOT EXISTS "Visitor_firstChannel_idx" ON "Visitor"("firstChannel");
CREATE INDEX IF NOT EXISTS "Visitor_lastChannel_idx" ON "Visitor"("lastChannel");
CREATE INDEX IF NOT EXISTS "Visitor_userId_idx" ON "Visitor"("userId");
CREATE INDEX IF NOT EXISTS "Visitor_firstSeenAt_idx" ON "Visitor"("firstSeenAt");
CREATE INDEX IF NOT EXISTS "ChatConversation_userId_idx" ON "ChatConversation"("userId");
CREATE INDEX IF NOT EXISTS "ChatConversation_visitorId_idx" ON "ChatConversation"("visitorId");
CREATE INDEX IF NOT EXISTS "ChatConversation_channel_idx" ON "ChatConversation"("channel");
CREATE INDEX IF NOT EXISTS "ChatConversation_lastMessageAt_idx" ON "ChatConversation"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "ChatConversation_handoffAt_idx" ON "ChatConversation"("handoffAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "KnowledgeSource_isActive_idx" ON "KnowledgeSource"("isActive");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_sourceId_ordinal_idx" ON "KnowledgeChunk"("sourceId", "ordinal");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_searchVector_idx" ON "KnowledgeChunk" USING GIN ("searchVector");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
