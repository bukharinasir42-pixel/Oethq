-- Rich-text article body per daily task (task builder)
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "articleContent" TEXT;
