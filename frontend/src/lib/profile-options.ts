/**
 * Shared option lists for the required onboarding fields:
 *  - PROFESSIONS: the candidate's healthcare profession (OET's 12 + common ones).
 *  - HEARD_FROM: where they first heard about OET HQ, each with a brand colour
 *    used for the admin badge.
 * Values are stored verbatim as strings on the User row.
 */

export const PROFESSIONS: string[] = [
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
];

export type HeardFromOption = { value: string; label: string; color: string; bg: string };

/** `color` = text/accent, `bg` = soft background — used for the admin badge. */
export const HEARD_FROM: HeardFromOption[] = [
  { value: "YouTube", label: "YouTube", color: "#DC2626", bg: "#FEE2E2" },
  { value: "Google", label: "Google", color: "#2563EB", bg: "#DBEAFE" },
  { value: "Google Ads", label: "Google Ads", color: "#15803D", bg: "#DCFCE7" },
  { value: "Facebook", label: "Facebook", color: "#1D4ED8", bg: "#DBEAFE" },
  { value: "Facebook Ads", label: "Facebook Ads", color: "#4F46E5", bg: "#E0E7FF" },
  { value: "Instagram", label: "Instagram", color: "#BE185D", bg: "#FCE7F3" },
  { value: "Refer by a friend", label: "Refer by a friend", color: "#B45309", bg: "#FEF3C7" },
  { value: "ChatGPT or AI", label: "ChatGPT / AI", color: "#0F766E", bg: "#CCFBF1" },
  { value: "Other", label: "Other", color: "#475569", bg: "#E2E8F0" }
];

export const HEARD_FROM_VALUES = HEARD_FROM.map((h) => h.value);

export function heardFromStyle(value: string | null | undefined): HeardFromOption {
  return HEARD_FROM.find((h) => h.value === value) ?? { value: value ?? "", label: value ?? "—", color: "#475569", bg: "#E2E8F0" };
}
