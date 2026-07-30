import { isRichContentEmpty } from "@/lib/rich-content";

export const LISTENING_PART_A_EXTRACT_IDS = ["listening-a-1", "listening-a-2"] as const;
export const LISTENING_PART_C_EXTRACT_IDS = ["listening-c-1", "listening-c-2"] as const;

export function buildDefaultListeningPartAExtractQuestionHeadings(fallback = "") {
  return Object.fromEntries(LISTENING_PART_A_EXTRACT_IDS.map((id) => [id, fallback]));
}

export function buildDefaultListeningPartCExtractQuestionHeadings(fallback = "") {
  return Object.fromEntries(LISTENING_PART_C_EXTRACT_IDS.map((id) => [id, fallback]));
}

function resolveListeningPartAExtractIndex(extractId?: string | null): number | null {
  if (!extractId) return null;
  const listeningMatch = extractId.match(/^listening-a-(\d+)$/i);
  if (listeningMatch) {
    const index = Number(listeningMatch[1]) - 1;
    return index >= 0 && index < LISTENING_PART_A_EXTRACT_IDS.length ? index : null;
  }
  const legacyMatch = extractId.match(/^a-extract-(\d+)$/i);
  if (legacyMatch) {
    const index = Number(legacyMatch[1]) - 1;
    return index >= 0 && index < LISTENING_PART_A_EXTRACT_IDS.length ? index : null;
  }
  return null;
}

function resolveListeningPartCExtractIndex(extractId?: string | null): number | null {
  if (!extractId) return null;
  const listeningMatch = extractId.match(/^listening-c-(\d+)$/i);
  if (listeningMatch) {
    const index = Number(listeningMatch[1]) - 1;
    return index >= 0 && index < LISTENING_PART_C_EXTRACT_IDS.length ? index : null;
  }
  const legacyMatch = extractId.match(/^c-extract-(\d+)$/i);
  if (legacyMatch) {
    const index = Number(legacyMatch[1]) - 1;
    return index >= 0 && index < LISTENING_PART_C_EXTRACT_IDS.length ? index : null;
  }
  return null;
}

export function canonicalListeningPartAExtractId(key: string): string | null {
  const index = resolveListeningPartAExtractIndex(key);
  return index === null ? null : LISTENING_PART_A_EXTRACT_IDS[index];
}

export function resolveListeningPartAExtractId(extractId: string | undefined | null, index: number) {
  const resolved = resolveListeningPartAExtractIndex(extractId);
  if (resolved !== null) return LISTENING_PART_A_EXTRACT_IDS[resolved];
  return LISTENING_PART_A_EXTRACT_IDS[index] ?? LISTENING_PART_A_EXTRACT_IDS[0];
}

export function resolveListeningPartCExtractId(extractId: string | undefined | null, index: number) {
  const resolved = resolveListeningPartCExtractIndex(extractId);
  if (resolved !== null) return LISTENING_PART_C_EXTRACT_IDS[resolved];
  return LISTENING_PART_C_EXTRACT_IDS[index] ?? LISTENING_PART_C_EXTRACT_IDS[0];
}

export function normalizeListeningPartAExtractQuestionHeadings(headings?: Record<string, string> | null) {
  const normalized = buildDefaultListeningPartAExtractQuestionHeadings();
  if (headings) {
    for (const [key, value] of Object.entries(headings)) {
      const index = resolveListeningPartAExtractIndex(key);
      const trimmed = value?.trim();
      if (index !== null && trimmed) {
        normalized[LISTENING_PART_A_EXTRACT_IDS[index]] = trimmed;
      }
    }
  }
  return normalized;
}

export function normalizeListeningPartCExtractQuestionHeadings(headings?: Record<string, string> | null) {
  const normalized = buildDefaultListeningPartCExtractQuestionHeadings();
  if (headings) {
    for (const [key, value] of Object.entries(headings)) {
      const index = resolveListeningPartCExtractIndex(key);
      const trimmed = value?.trim();
      if (index !== null && trimmed) {
        normalized[LISTENING_PART_C_EXTRACT_IDS[index]] = trimmed;
      }
    }
  }
  return normalized;
}

function serializeExtractQuestionHeadings(ids: readonly string[], headings: Record<string, string>) {
  const serialized: Record<string, string> = {};
  for (const id of ids) {
    const value = headings[id]?.trim();
    if (value && !isRichContentEmpty(value)) {
      serialized[id] = value;
    }
  }
  return Object.keys(serialized).length > 0 ? serialized : null;
}

export function serializeListeningPartAExtractQuestionHeadings(headings: Record<string, string>) {
  return serializeExtractQuestionHeadings(
    LISTENING_PART_A_EXTRACT_IDS,
    normalizeListeningPartAExtractQuestionHeadings(headings)
  );
}

export function serializeListeningPartCExtractQuestionHeadings(headings: Record<string, string>) {
  return serializeExtractQuestionHeadings(
    LISTENING_PART_C_EXTRACT_IDS,
    normalizeListeningPartCExtractQuestionHeadings(headings)
  );
}
