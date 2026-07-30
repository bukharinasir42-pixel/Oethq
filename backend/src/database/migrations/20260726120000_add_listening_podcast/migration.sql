-- CreateTable
CREATE TABLE "ListeningPodcast" (
    "id" TEXT NOT NULL,
    "kicker" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "audioAssetId" TEXT,
    "audioUrl" TEXT,
    "durationSec" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningPodcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastListen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "dayKey" INTEGER NOT NULL,
    "listenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodcastListen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeningPodcast_isActive_displayOrder_idx" ON "ListeningPodcast"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastListen_userId_dayKey_key" ON "PodcastListen"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "PodcastListen_userId_idx" ON "PodcastListen"("userId");
