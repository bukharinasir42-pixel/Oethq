/**
 * The professions a candidate may hold.
 *
 * This is not cosmetic. A student's profession selects which writing case-note
 * library and which Speaking hack-sentence PDF they are served, so a value that
 * does not match one of these exactly leaves them with an empty library and no
 * explanation. That is why self-serve updates are validated against this list
 * rather than accepting free text.
 *
 * Kept in step with `frontend/src/lib/profile-options.ts`. If you add one here,
 * add it there — and remember the admin's writing case notes and speaking sheets
 * are filed under these exact strings.
 */
export const PROFESSIONS: readonly string[] = [
  "Medicine / Doctor",
  "Nursing",
  "Midwifery",
  "Dentistry",
  "Pharmacy",
  "Physiotherapy",
  "Occupational Therapy",
  "Dietetics / Nutrition",
  "Optometry",
  "Podiatry",
  "Radiography",
  "Speech Pathology",
  "Veterinary Science",
  "Medical Laboratory Science",
  "Paramedicine",
  "Psychology",
  "Audiology",
  "Respiratory Therapy",
  "Chiropractic",
  "Osteopathy",
  "Medical Student",
  "Other healthcare professional"
] as const;

/** Exact match only — a near-miss silently empties the student's libraries. */
export function isValidProfession(value: unknown): value is string {
  return typeof value === "string" && PROFESSIONS.includes(value.trim());
}
