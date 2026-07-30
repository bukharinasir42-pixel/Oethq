import { BadRequestException } from "../../common/http-exception";

const LISTENING_PART_A_EXTRACT_IDS = ["listening-a-1", "listening-a-2"] as const;

/** Minimum assigned questions per Part A sub-heading (regular tests and past papers). */
export const LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING = 1;

type PartAQuestionHeadingGroup = {
  id: string;
  heading: string;
  questionSequences: number[];
};

export type PartAQuestionHeadingGroupsByExtract = Record<string, PartAQuestionHeadingGroup[]>;

function canonicalListeningPartAExtractId(key: string): string | null {
  const listeningMatch = key.match(/^listening-a-(\d+)$/i);
  if (listeningMatch) {
    const index = Number(listeningMatch[1]) - 1;
    return index >= 0 && index < LISTENING_PART_A_EXTRACT_IDS.length
      ? LISTENING_PART_A_EXTRACT_IDS[index]
      : null;
  }
  const legacyMatch = key.match(/^a-extract-(\d+)$/i);
  if (legacyMatch) {
    const index = Number(legacyMatch[1]) - 1;
    return index >= 0 && index < LISTENING_PART_A_EXTRACT_IDS.length
      ? LISTENING_PART_A_EXTRACT_IDS[index]
      : null;
  }
  return null;
}

function isRichContentEmpty(content: string): boolean {
  return (
    content
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim().length === 0
  );
}

function buildListeningPartAExtractSequences(extractId: string) {
  const start = extractId === "listening-a-1" ? 1 : 13;
  const end = extractId === "listening-a-1" ? 12 : 24;
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function groupsForExtract(groups: PartAQuestionHeadingGroupsByExtract, extractId: string) {
  const merged: PartAQuestionHeadingGroup[] = [];
  for (const [rawKey, rawGroups] of Object.entries(groups)) {
    if (canonicalListeningPartAExtractId(rawKey) !== extractId || !Array.isArray(rawGroups)) continue;
    merged.push(...rawGroups);
  }
  return merged;
}

export function validateListeningPartAQuestionHeadingGroups(
  groups: PartAQuestionHeadingGroupsByExtract
): void {
  for (const extractId of LISTENING_PART_A_EXTRACT_IDS) {
    const allowed = buildListeningPartAExtractSequences(extractId);
    const used = new Set<number>();

    for (const group of groupsForExtract(groups, extractId)) {
      const heading = group.heading?.trim() || "";
      const sequences = [...new Set(group.questionSequences ?? [])].sort((left, right) => left - right);
      const hasHeading = !isRichContentEmpty(heading);
      const hasQuestions = sequences.length > 0;

      if (!hasHeading && !hasQuestions) continue;

      if (hasHeading && sequences.length < LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING) {
        const label = extractId === "listening-a-1" ? "Extract 1" : "Extract 2";
        throw new BadRequestException(
          `${label}: each question heading must include at least ${LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING} question${LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING === 1 ? "" : "s"}.`
        );
      }

      if (!hasHeading && hasQuestions) {
        throw new BadRequestException(
          "Add heading text for every Part A question group that has assigned questions."
        );
      }

      for (const sequence of sequences) {
        if (!allowed.includes(sequence)) {
          throw new BadRequestException(
            `Question ${sequence} is outside the allowed range for ${extractId === "listening-a-1" ? "Extract 1" : "Extract 2"}.`
          );
        }
        if (used.has(sequence)) {
          throw new BadRequestException(
            `Question ${sequence} is assigned to more than one Part A heading group.`
          );
        }
        used.add(sequence);
      }
    }
  }
}
