-- Fields the Dr Nasir reasoning model requires that the first cut did not carry:
-- a stressed restatement of the stem, the question type, the difficulty index,
-- the counterfactual stem rewrite, and the transferable lesson.
-- Additive and idempotent.

ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "stemFocus" TEXT;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "questionType" TEXT;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "difficulty" TEXT;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "counterfactual" TEXT;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "lesson" TEXT;
