import { isRichContentEmpty } from "@/lib/rich-content";

export const READING_PART_B_EXTRACT_IDS = [
  "reading-b-1",
  "reading-b-2",
  "reading-b-3",
  "reading-b-4",
  "reading-b-5",
  "reading-b-6"
] as const;

export function buildDefaultPartBExtractBooklets(fallback = "") {
  return Object.fromEntries(READING_PART_B_EXTRACT_IDS.map((id) => [id, fallback]));
}

/** Maps legacy extract ids (e.g. b-extract-1) to a 0-based Part B extract index. */
export function resolveReadingPartBExtractIndex(extractId?: string | null): number | null {
  if (!extractId) return null;

  const readingMatch = extractId.match(/^reading-b-(\d+)$/);
  if (readingMatch) {
    const index = Number(readingMatch[1]) - 1;
    return index >= 0 && index < READING_PART_B_EXTRACT_IDS.length ? index : null;
  }

  const suffixMatch = extractId.match(/(\d+)$/);
  if (!suffixMatch) return null;

  const index = Number(suffixMatch[1]) - 1;
  return index >= 0 && index < READING_PART_B_EXTRACT_IDS.length ? index : null;
}

export function resolveReadingPartBExtractId(extractId: string | undefined | null, index: number) {
  return READING_PART_B_EXTRACT_IDS[index] ?? READING_PART_B_EXTRACT_IDS[0];
}

export function normalizePartBExtractBooklets(
  booklets?: Record<string, string> | null,
  legacyPartBBookletHtml?: string | null
) {
  const normalized = buildDefaultPartBExtractBooklets();
  const fallback = legacyPartBBookletHtml?.trim() || "";

  if (booklets) {
    for (const [key, value] of Object.entries(booklets)) {
      const index = resolveReadingPartBExtractIndex(key);
      const trimmed = value?.trim();
      if (index !== null && trimmed) {
        normalized[READING_PART_B_EXTRACT_IDS[index]] = trimmed;
      }
    }
  }

  for (const id of READING_PART_B_EXTRACT_IDS) {
    if (!normalized[id] && fallback) {
      normalized[id] = fallback;
    }
  }

  return normalized;
}

export function serializePartBExtractBooklets(
  booklets: Record<string, string>
): Record<string, string> | null {
  const normalized = normalizePartBExtractBooklets(booklets);
  const serialized: Record<string, string> = {};

  for (const id of READING_PART_B_EXTRACT_IDS) {
    const value = normalized[id]?.trim();
    if (value && !isRichContentEmpty(value)) {
      serialized[id] = value;
    }
  }

  return Object.keys(serialized).length > 0 ? serialized : null;
}
