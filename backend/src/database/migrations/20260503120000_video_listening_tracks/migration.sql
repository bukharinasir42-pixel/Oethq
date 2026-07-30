-- AssetKind: VIDEO
DO $$
BEGIN
  ALTER TYPE "AssetKind" ADD VALUE 'VIDEO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "ListeningAudioTrack" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListeningAudioTrack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListeningAudioTrack_testId_sortOrder_key" ON "ListeningAudioTrack"("testId", "sortOrder");
CREATE INDEX "ListeningAudioTrack_testId_idx" ON "ListeningAudioTrack"("testId");

ALTER TABLE "ListeningAudioTrack"
  ADD CONSTRAINT "ListeningAudioTrack_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListeningAudioTrack"
  ADD CONSTRAINT "ListeningAudioTrack_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "StorageObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "currentListeningTrackIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "listeningFinalCountdownEndsAt" TIMESTAMP(3);
