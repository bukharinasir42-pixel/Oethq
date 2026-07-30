import { isRichContentEmpty } from "@/lib/rich-content";

export const READING_PART_C_EXTRACT_IDS = ["reading-c-1", "reading-c-2"] as const;

export function buildDefaultPartCExtractBooklets(fallback = "") {
  return Object.fromEntries(READING_PART_C_EXTRACT_IDS.map((id) => [id, fallback]));
}

/** Maps extract ids (e.g. reading-c-1, c-extract-1) to a 0-based Part C extract index. */
export function resolveReadingPartCExtractIndex(extractId?: string | null): number | null {
  if (!extractId) return null;

  const readingMatch = extractId.match(/^reading-c-(\d+)$/);
  if (readingMatch) {
    const index = Number(readingMatch[1]) - 1;
    return index >= 0 && index < READING_PART_C_EXTRACT_IDS.length ? index : null;
  }

  const suffixMatch = extractId.match(/(\d+)$/);
  if (!suffixMatch) return null;

  const index = Number(suffixMatch[1]) - 1;
  return index >= 0 && index < READING_PART_C_EXTRACT_IDS.length ? index : null;
}

export function resolveReadingPartCExtractId(extractId: string | undefined | null, index: number) {
  return READING_PART_C_EXTRACT_IDS[index] ?? READING_PART_C_EXTRACT_IDS[0];
}

export function resolveReadingPartCExtractIdForSequence(sequence: number): string | null {
  if (sequence >= 27 && sequence <= 34) return READING_PART_C_EXTRACT_IDS[0];
  if (sequence >= 35 && sequence <= 42) return READING_PART_C_EXTRACT_IDS[1];
  return null;
}

export function resolveReadingPartCExtractIdForQuestion(question: {
  extractId?: string | null;
  sequence: number;
}): string | null {
  if (question.extractId) {
    const index = resolveReadingPartCExtractIndex(question.extractId);
    if (index !== null) return READING_PART_C_EXTRACT_IDS[index];
    return question.extractId;
  }
  return resolveReadingPartCExtractIdForSequence(question.sequence);
}

export function questionMatchesReadingPartCExtract(
  question: { part: string; extractId?: string | null; sequence: number },
  extractId: string
): boolean {
  if (question.part !== "C") return false;
  const questionExtractId = resolveReadingPartCExtractIdForQuestion(question);
  const targetIndex = resolveReadingPartCExtractIndex(extractId);
  const targetExtractId =
    targetIndex !== null ? READING_PART_C_EXTRACT_IDS[targetIndex] : extractId;
  return questionExtractId === targetExtractId;
}

export function normalizePartCExtractBooklets(
  booklets?: Record<string, string> | null,
  legacyPartCBookletHtml?: string | null
) {
  const normalized = buildDefaultPartCExtractBooklets();
  const fallback = legacyPartCBookletHtml?.trim() || "";

  if (booklets) {
    for (const [key, value] of Object.entries(booklets)) {
      const index = resolveReadingPartCExtractIndex(key);
      const trimmed = value?.trim();
      if (index !== null && trimmed) {
        normalized[READING_PART_C_EXTRACT_IDS[index]] = trimmed;
      }
    }
  }

  for (const id of READING_PART_C_EXTRACT_IDS) {
    if (!normalized[id] && fallback) {
      normalized[id] = fallback;
    }
  }

  return normalized;
}

export function serializePartCExtractBooklets(
  booklets: Record<string, string>
): Record<string, string> | null {
  const normalized = normalizePartCExtractBooklets(booklets);
  const serialized: Record<string, string> = {};

  for (const id of READING_PART_C_EXTRACT_IDS) {
    const value = normalized[id]?.trim();
    if (value && !isRichContentEmpty(value)) {
      serialized[id] = value;
    }
  }

  return Object.keys(serialized).length > 0 ? serialized : null;
}
