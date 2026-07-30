import { isRichContentEmpty } from "@/lib/rich-content";
import {
  LISTENING_PART_A_EXTRACT_IDS,
  canonicalListeningPartAExtractId,
  resolveListeningPartAExtractId
} from "@/lib/listening-extract-question-headings";
import type { TestQuestionDto } from "@/lib/types";

export type ListeningPartAQuestionHeadingGroup = {
  id: string;
  heading: string;
  questionSequences: number[];
};

export type ListeningPartAQuestionHeadingGroupsByExtract = Record<string, ListeningPartAQuestionHeadingGroup[]>;

/** Minimum assigned questions per Part A sub-heading (regular tests and past papers). */
export const LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING = 1;

export function getListeningPartAExtractSequenceRange(extractId: string) {
  const canonicalId = canonicalListeningPartAExtractId(extractId) ?? extractId;
  if (canonicalId === "listening-a-1") return { start: 1, end: 12 };
  return { start: 13, end: 24 };
}

export function buildListeningPartAExtractSequences(extractId: string) {
  const { start, end } = getListeningPartAExtractSequenceRange(extractId);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function createListeningPartAQuestionHeadingGroup(
  questionSequences: number[] = []
): ListeningPartAQuestionHeadingGroup {
  return {
    id: `part-a-heading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    heading: "",
    questionSequences
  };
}

export function buildDefaultListeningPartAQuestionHeadingGroups(): ListeningPartAQuestionHeadingGroupsByExtract {
  return Object.fromEntries(LISTENING_PART_A_EXTRACT_IDS.map((id) => [id, []]));
}

function groupsForExtract(
  groups: ListeningPartAQuestionHeadingGroupsByExtract,
  extractId: string
): ListeningPartAQuestionHeadingGroup[] {
  const merged: ListeningPartAQuestionHeadingGroup[] = [];
  for (const [rawKey, rawGroups] of Object.entries(groups)) {
    if (canonicalListeningPartAExtractId(rawKey) !== extractId || !Array.isArray(rawGroups)) continue;
    merged.push(...rawGroups);
  }
  return merged;
}

function sanitizeGroup(
  group: ListeningPartAQuestionHeadingGroup,
  allowedSequences: Set<number>
): ListeningPartAQuestionHeadingGroup | null {
  const headingRaw = group.heading ?? "";
  const questionSequences = [...new Set(group.questionSequences)]
    .filter((sequence) => allowedSequences.has(sequence))
    .sort((left, right) => left - right);

  if (isRichContentEmpty(headingRaw) || questionSequences.length < LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING) {
    return null;
  }

  return {
    id: group.id || createListeningPartAQuestionHeadingGroup().id,
    heading: headingRaw.trim(),
    questionSequences
  };
}

export function normalizeListeningPartAQuestionHeadingGroups(
  groups?: ListeningPartAQuestionHeadingGroupsByExtract | null
): ListeningPartAQuestionHeadingGroupsByExtract {
  const normalized = buildDefaultListeningPartAQuestionHeadingGroups();
  if (!groups || typeof groups !== "object") return normalized;

  for (const extractId of LISTENING_PART_A_EXTRACT_IDS) {
    const allowed = new Set(buildListeningPartAExtractSequences(extractId));
    const merged: ListeningPartAQuestionHeadingGroup[] = [];

    for (const group of groupsForExtract(groups, extractId)) {
      const sanitized = sanitizeGroup(group, allowed);
      if (sanitized) merged.push(sanitized);
    }

    if (merged.length > 0) {
      normalized[extractId] = merged;
    }
  }

  return normalized;
}

export function serializeListeningPartAQuestionHeadingGroups(
  groups: ListeningPartAQuestionHeadingGroupsByExtract
): ListeningPartAQuestionHeadingGroupsByExtract | null {
  const normalized = normalizeListeningPartAQuestionHeadingGroups(groups);
  return LISTENING_PART_A_EXTRACT_IDS.some((id) => (normalized[id] ?? []).length > 0) ? normalized : null;
}

export function resolveListeningPartAExtractIdFromGroup(
  extractId: string | undefined | null,
  extractIndex: number
) {
  return resolveListeningPartAExtractId(extractId, extractIndex);
}

export type ListeningPartAQuestionSection = {
  heading: string | null;
  questions: TestQuestionDto[];
};

export function buildListeningPartAQuestionSections(
  groups: ListeningPartAQuestionHeadingGroup[] | undefined,
  questions: TestQuestionDto[]
): ListeningPartAQuestionSection[] {
  const headingBySequence = new Map<number, string>();
  for (const group of groups ?? []) {
    if (isRichContentEmpty(group.heading)) continue;
    for (const sequence of group.questionSequences) {
      headingBySequence.set(sequence, group.heading.trim());
    }
  }

  const sorted = [...questions].sort((left, right) => left.sequence - right.sequence);
  const sections: ListeningPartAQuestionSection[] = [];

  for (const question of sorted) {
    const heading = headingBySequence.get(question.sequence) ?? null;
    const last = sections[sections.length - 1];
    if (last && last.heading === heading) {
      last.questions.push(question);
    } else {
      sections.push({ heading, questions: [question] });
    }
  }

  return sections.length > 0 ? sections : [{ heading: null, questions: sorted }];
}

export function hasListeningPartAQuestionHeadingGroups(
  groups: ListeningPartAQuestionHeadingGroup[] | undefined
) {
  return (groups ?? []).some(
    (group) =>
      !isRichContentEmpty(group.heading) &&
      group.questionSequences.length >= LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING
  );
}

export function validateListeningPartAQuestionHeadingGroups(
  groups: ListeningPartAQuestionHeadingGroupsByExtract
): string | null {
  for (const extractId of LISTENING_PART_A_EXTRACT_IDS) {
    const allowed = buildListeningPartAExtractSequences(extractId);
    const used = new Set<number>();

    for (const group of groupsForExtract(groups, extractId)) {
      const heading = group.heading?.trim() || "";
      const sequences = [...new Set(group.questionSequences)].sort((left, right) => left - right);
      const hasHeading = !isRichContentEmpty(heading);
      const hasQuestions = sequences.length > 0;

      if (!hasHeading && !hasQuestions) continue;

      if (hasHeading && sequences.length < LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING) {
        const label = extractId === "listening-a-1" ? "Extract 1" : "Extract 2";
        return `${label}: each question heading must include at least ${LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING} question${LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING === 1 ? "" : "s"}.`;
      }

      if (!hasHeading && hasQuestions) {
        return "Add heading text for every Part A question group that has assigned questions.";
      }

      for (const sequence of sequences) {
        if (!allowed.includes(sequence)) {
          return `Question ${sequence} is outside the allowed range for ${extractId === "listening-a-1" ? "Extract 1" : "Extract 2"}.`;
        }
        if (used.has(sequence)) {
          return `Question ${sequence} is assigned to more than one Part A heading group.`;
        }
        used.add(sequence);
      }
    }
  }

  return null;
}
