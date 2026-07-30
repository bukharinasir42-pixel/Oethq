-- CreateEnum
CREATE TYPE "CohortSessionSlot" AS ENUM ('LECTURE', 'CORE_SKILLS');

-- CreateEnum
CREATE TYPE "CohortAttendance" AS ENUM ('UPCOMING', 'ATTENDED', 'LATE', 'MISSED', 'EXCUSED');

-- CreateEnum
CREATE TYPE "CohortDayStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'PARTIAL', 'COMPLETED', 'COMPLETED_LATE', 'MISSED');

-- CreateTable
CREATE TABLE "CohortSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "class1Time" TEXT NOT NULL,
    "class2Time" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL DEFAULT 40,
    "restWeekday" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortScheduleChange" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortScheduleChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortSessionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "slot" "CohortSessionSlot" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "attendance" "CohortAttendance" NOT NULL DEFAULT 'UPCOMING',
    "firstJoinedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "activeWatchSec" INTEGER NOT NULL DEFAULT 0,
    "recordingWatchSec" INTEGER NOT NULL DEFAULT 0,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "furthestPositionSec" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortSessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortDayProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "status" "CohortDayStatus" NOT NULL DEFAULT 'UPCOMING',
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedLate" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortDayProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortNotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerMessageId" TEXT,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortWarning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "relatedDates" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "CohortWarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortWeeklyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortWeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CohortSchedule_userId_key" ON "CohortSchedule"("userId");

-- CreateIndex
CREATE INDEX "CohortScheduleChange_scheduleId_idx" ON "CohortScheduleChange"("scheduleId");

-- CreateIndex
CREATE INDEX "CohortSessionRecord_userId_scheduledAt_idx" ON "CohortSessionRecord"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "CohortSessionRecord_scheduledAt_idx" ON "CohortSessionRecord"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CohortSessionRecord_userId_dayNumber_slot_key" ON "CohortSessionRecord"("userId", "dayNumber", "slot");

-- CreateIndex
CREATE INDEX "CohortDayProgress_userId_status_idx" ON "CohortDayProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CohortDayProgress_userId_dayNumber_key" ON "CohortDayProgress"("userId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CohortNotificationLog_refKey_key" ON "CohortNotificationLog"("refKey");

-- CreateIndex
CREATE INDEX "CohortNotificationLog_userId_type_idx" ON "CohortNotificationLog"("userId", "type");

-- CreateIndex
CREATE INDEX "CohortNotificationLog_status_scheduledFor_idx" ON "CohortNotificationLog"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "CohortWarning_userId_status_idx" ON "CohortWarning"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CohortWeeklyReport_userId_periodStart_key" ON "CohortWeeklyReport"("userId", "periodStart");

-- AddForeignKey
ALTER TABLE "CohortSchedule" ADD CONSTRAINT "CohortSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortScheduleChange" ADD CONSTRAINT "CohortScheduleChange_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CohortSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSessionRecord" ADD CONSTRAINT "CohortSessionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortDayProgress" ADD CONSTRAINT "CohortDayProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortWarning" ADD CONSTRAINT "CohortWarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortWeeklyReport" ADD CONSTRAINT "CohortWeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
