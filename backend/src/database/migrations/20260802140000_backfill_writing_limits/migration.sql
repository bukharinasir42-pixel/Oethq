-- Back-fill Plan.writingLimit.
--
-- 20260726230000_add_writing_quota added this column with DEFAULT 0 and never
-- populated it, so every plan in a deployed database has sat at 0 ever since.
-- writingAllowance() reads it directly, which meant a student on ANY paid plan
-- opened Writing Corrections, saw "No writing corrections in your plan yet" and
-- was asked to buy a pack — before submitting a single letter, having already
-- paid for corrections they could not use.
--
-- Values are the ones the Complete Material page advertises: Foundation Sprint 2,
-- Precision Engine 3, Elite Clearance 7, Total Clearance 10. STARTER stays 0 —
-- the free trial includes no corrections, which is correct.
--
-- Guarded on `= 0` so nothing an admin has deliberately set is overwritten.
UPDATE "Plan" SET "writingLimit" = 2  WHERE "tier" = 'FOUNDATION'  AND "writingLimit" = 0;
UPDATE "Plan" SET "writingLimit" = 3  WHERE "tier" = 'ACCELERATOR' AND "writingLimit" = 0;
UPDATE "Plan" SET "writingLimit" = 7  WHERE "tier" = 'MASTERY'     AND "writingLimit" = 0;
UPDATE "Plan" SET "writingLimit" = 10 WHERE "tier" = 'CUSTOM'      AND "writingLimit" = 0;
