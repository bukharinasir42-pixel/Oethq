-- add_cohort_layer — additive only; safe on production
CREATE TYPE "CohortSessionSlot" AS ENUM ('LECTURE','CORE_SKILLS');
CREATE TYPE "CohortAttendance" AS ENUM ('UPCOMING','ATTENDED','LATE','MISSED','EXCUSED');
CREATE TYPE "CohortDayStatus" AS ENUM ('UPCOMING','ACTIVE','PARTIAL','COMPLETED','COMPLETED_LATE','MISSED');

CREATE TABLE "CohortSchedule" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id"),
  "country" TEXT NOT NULL, "timezone" TEXT NOT NULL,
  "class1Time" TEXT NOT NULL, "class2Time" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL, "totalDays" INTEGER NOT NULL DEFAULT 40,
  "restWeekday" INTEGER NOT NULL DEFAULT 0, "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "CohortScheduleChange" (
  "id" TEXT PRIMARY KEY, "scheduleId" TEXT NOT NULL REFERENCES "CohortSchedule"("id"),
  "field" TEXT NOT NULL, "oldValue" TEXT NOT NULL, "newValue" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CohortScheduleChange_scheduleId_idx" ON "CohortScheduleChange"("scheduleId");

CREATE TABLE "CohortSessionRecord" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "dayNumber" INTEGER NOT NULL, "slot" "CohortSessionSlot" NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "attendance" "CohortAttendance" NOT NULL DEFAULT 'UPCOMING',
  "firstJoinedAt" TIMESTAMP(3), "lastActivityAt" TIMESTAMP(3),
  "activeWatchSec" INTEGER NOT NULL DEFAULT 0, "recordingWatchSec" INTEGER NOT NULL DEFAULT 0,
  "lastPositionSec" INTEGER NOT NULL DEFAULT 0, "furthestPositionSec" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3), "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CohortSessionRecord_userId_dayNumber_slot_key" ON "CohortSessionRecord"("userId","dayNumber","slot");
CREATE INDEX "CohortSessionRecord_userId_scheduledAt_idx" ON "CohortSessionRecord"("userId","scheduledAt");
CREATE INDEX "CohortSessionRecord_scheduledAt_idx" ON "CohortSessionRecord"("scheduledAt");

CREATE TABLE "CohortDayProgress" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "dayNumber" INTEGER NOT NULL,
  "status" "CohortDayStatus" NOT NULL DEFAULT 'UPCOMING',
  "completionPct" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3), "completedLate" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CohortDayProgress_userId_dayNumber_key" ON "CohortDayProgress"("userId","dayNumber");
CREATE INDEX "CohortDayProgress_userId_status_idx" ON "CohortDayProgress"("userId","status");

CREATE TABLE "CohortNotificationLog" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "type" TEXT NOT NULL,
  "refKey" TEXT NOT NULL UNIQUE, "scheduledFor" TIMESTAMP(3), "sentAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending', "providerMessageId" TEXT, "error" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CohortNotificationLog_userId_type_idx" ON "CohortNotificationLog"("userId","type");
CREATE INDEX "CohortNotificationLog_status_scheduledFor_idx" ON "CohortNotificationLog"("status","scheduledFor");

CREATE TABLE "CohortWarning" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "type" TEXT NOT NULL, "reason" TEXT NOT NULL, "relatedDates" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3), "resolvedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX "CohortWarning_userId_status_idx" ON "CohortWarning"("userId","status");

CREATE TABLE "CohortWeeklyReport" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL, "emailedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CohortWeeklyReport_userId_periodStart_key" ON "CohortWeeklyReport"("userId","periodStart");
