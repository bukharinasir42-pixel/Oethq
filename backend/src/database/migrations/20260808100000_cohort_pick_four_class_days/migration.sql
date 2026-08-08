-- Cohort: let a student pick four class weekdays, each with its own class times.
--
-- Students already enrolled keep the original six-day calendar untouched, so
-- every existing row is stamped LEGACY_SIX_DAY *after* the column is added with
-- the new default. New schedules get PICK_FOUR.
--
-- Written defensively (IF NOT EXISTS / DO blocks) because this schema has drifted
-- between environments before.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CohortScheduleMode') THEN
    CREATE TYPE "CohortScheduleMode" AS ENUM ('LEGACY_SIX_DAY', 'PICK_FOUR');
  END IF;
END $$;

ALTER TABLE "CohortSchedule"
  ADD COLUMN IF NOT EXISTS "startDayNumber" INTEGER NOT NULL DEFAULT 1;

-- Added with the OLD behaviour as the column default, so every row that already
-- exists is backfilled to LEGACY_SIX_DAY in the same statement. The default is
-- then flipped to PICK_FOUR for rows created from here on. Re-running is safe:
-- the ADD is a no-op and the SET DEFAULT is idempotent.
ALTER TABLE "CohortSchedule"
  ADD COLUMN IF NOT EXISTS "mode" "CohortScheduleMode" NOT NULL DEFAULT 'LEGACY_SIX_DAY';

ALTER TABLE "CohortSchedule"
  ALTER COLUMN "mode" SET DEFAULT 'PICK_FOUR';

CREATE TABLE IF NOT EXISTS "CohortClassDay" (
  "id"         TEXT    NOT NULL,
  "scheduleId" TEXT    NOT NULL,
  "weekday"    INTEGER NOT NULL,
  "class1Time" TEXT    NOT NULL,
  "class2Time" TEXT    NOT NULL,
  CONSTRAINT "CohortClassDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CohortClassDay_scheduleId_weekday_key"
  ON "CohortClassDay" ("scheduleId", "weekday");

CREATE INDEX IF NOT EXISTS "CohortClassDay_scheduleId_idx"
  ON "CohortClassDay" ("scheduleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CohortClassDay_scheduleId_fkey'
  ) THEN
    ALTER TABLE "CohortClassDay"
      ADD CONSTRAINT "CohortClassDay_scheduleId_fkey"
      FOREIGN KEY ("scheduleId") REFERENCES "CohortSchedule"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
