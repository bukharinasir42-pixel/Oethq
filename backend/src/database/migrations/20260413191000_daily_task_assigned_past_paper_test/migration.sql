-- Align DailyTask with schema: past-paper test assignment (was missing from sync migration)
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "assignedPastPaperTestId" TEXT;

DO $$
BEGIN
  ALTER TABLE "DailyTask"
    ADD CONSTRAINT "DailyTask_assignedPastPaperTestId_fkey"
    FOREIGN KEY ("assignedPastPaperTestId") REFERENCES "Test"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
