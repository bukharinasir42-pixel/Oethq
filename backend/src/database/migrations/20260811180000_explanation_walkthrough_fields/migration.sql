-- The walkthrough screen shows more than the first cut stored: several located
-- quotes rather than one, the paraphrase mapping as its own object, the exact
-- phrase each wrong option fails on, the near misses for short-answer items,
-- and editorial fields that never reach a student.
-- Additive and idempotent.

ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "evidenceQuotes" JSONB;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "bridge" JSONB;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "commonWrong" JSONB;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "skillLabel" TEXT;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "typeLabel" TEXT;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "trapNote" TEXT;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "TestExplanation" ADD COLUMN IF NOT EXISTS "confidence" TEXT;

-- Papers imported before this migration carry a single evidence string. Give
-- them the array shape so the walkthrough has one code path, not two.
UPDATE "TestExplanation"
   SET "evidenceQuotes" = jsonb_build_array(
         jsonb_build_object(
           'loc', COALESCE(NULLIF('Text ' || "evidenceLetter", 'Text '), ''),
           'quote', "evidence"
         )
       )
 WHERE "evidenceQuotes" IS NULL;
