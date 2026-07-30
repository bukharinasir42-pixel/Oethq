import { isHtmlEmpty } from "@/lib/html";
import { isRichContentEmpty } from "@/lib/rich-content";
import { resolveListeningPartAExtractId } from "@/lib/listening-extract-question-headings";
import {
  buildListeningPartAQuestionSections,
  hasListeningPartAQuestionHeadingGroups,
  normalizeListeningPartAQuestionHeadingGroups,
  type ListeningPartAQuestionHeadingGroup,
  type ListeningPartAQuestionSection
} from "@/lib/listening-part-a-question-heading-groups";
import type { TestQuestionDto } from "@/lib/types";
import { READING_PART_B_EXTRACT_IDS } from "@/lib/reading-part-b-booklets";
import {
  READING_PART_C_EXTRACT_IDS,
  questionMatchesReadingPartCExtract,
  resolveReadingPartCExtractIdForQuestion,
  resolveReadingPartCExtractIndex
} from "@/lib/reading-part-c-booklets";

type PartSubInstructionsSource = {
  partASubInstructions?: string | null;
  partBSubInstructions?: string | null;
  partCSubInstructions?: string | null;
};

export function getPartSubInstructions(test: PartSubInstructionsSource, part: "A" | "B" | "C") {
  let value: string | null | undefined;
  switch (part) {
    case "A":
      value = test.partASubInstructions;
      break;
    case "B":
      value = test.partBSubInstructions;
      break;
    case "C":
      value = test.partCSubInstructions;
      break;
  }

  const trimmed = value?.trim() || "";
  if (!trimmed || isRichContentEmpty(trimmed)) {
    return null;
  }

  return trimmed;
}

export function getFirstQuestionOfPart(questions: TestQuestionDto[], part: "A" | "B" | "C") {
  return questions
    .filter((question) => question.part === part)
    .sort((left, right) => left.sequence - right.sequence)[0];
}

/** Show part instructions above question 1, or above a multi-question block that starts at question 1. */
export function shouldShowPartInstructions(
  allQuestions: TestQuestionDto[],
  part: "A" | "B" | "C",
  displayQuestions: TestQuestionDto[]
) {
  const firstOfPart = getFirstQuestionOfPart(allQuestions, part);
  if (!firstOfPart || displayQuestions.length === 0) {
    return false;
  }

  if (displayQuestions.length > 1) {
    return displayQuestions[0]?.id === firstOfPart.id;
  }

  return displayQuestions[0]?.id === firstOfPart.id;
}

/** Listening tests paginate by extract — show part instructions on every page for the active part. */
export function shouldShowListeningPartInstructions(
  part: "A" | "B" | "C",
  displayQuestions: TestQuestionDto[],
  subInstructions: string | null | undefined
) {
  if (!subInstructions || displayQuestions.length === 0) {
    return false;
  }

  return displayQuestions.every((question) => question.part === part);
}

export function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "N/A";
  }
  const safeValue = Math.max(0, value);
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatMinutesRemaining(seconds: number) {
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"} remaining`;
}

/** Compact mm:ss countdown for section timers (e.g. Reading Part A). */
export function formatCountdownClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Shared Parts B & C window — always defaults to 45 minutes. */
export function resolveReadingPartBCMinutes(partBCTimer?: number | null) {
  return typeof partBCTimer === "number" && partBCTimer > 0 ? partBCTimer : 45;
}

/** Wall-clock end of Parts B & C: Part A end + 45 minutes. */
export function getReadingPartBCDeadlineIso(
  startedAt: string,
  partATimer?: number | null,
  partBCTimer?: number | null
) {
  const partAMinutes = typeof partATimer === "number" && partATimer > 0 ? partATimer : 15;
  const partAEndMs = new Date(startedAt).getTime() + partAMinutes * 60 * 1000;
  return new Date(partAEndMs + resolveReadingPartBCMinutes(partBCTimer) * 60 * 1000).toISOString();
}

/** Fresh B & C window starting now (used when the candidate finishes Part A early). */
export function getReadingPartBCEarlyDeadlineIso(partBCTimer?: number | null, from: Date = new Date()) {
  return new Date(from.getTime() + resolveReadingPartBCMinutes(partBCTimer) * 60 * 1000).toISOString();
}

export function formatSectionLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function isSingleCharacterReadingAnswer(
  question: TestQuestionDto,
  testType?: "READING" | "LISTENING"
) {
  return (
    testType === "READING" &&
    question.type === "FILL_BLANK" &&
    question.part === "A" &&
    question.sequence >= 1 &&
    question.sequence <= 6
  );
}

export function isCaseSensitiveFill(question: TestQuestionDto) {
  return (
    question.type === "FILL_BLANK" &&
    question.part === "A" &&
    question.sequence >= 8 &&
    question.sequence <= 20
  );
}

type ReadingBookletSource = {
  partABookletHtml?: string | null;
  partBBookletHtml?: string | null;
  partBExtractBooklets?: Record<string, string> | null;
  partCBookletHtml?: string | null;
  partCExtractBooklets?: Record<string, string> | null;
  partBBookletAsset?: { signedUrl: string } | null;
  partCBookletAsset?: { signedUrl: string } | null;
  bookletAsset?: { signedUrl: string } | null;
};

function readingBookletHtml(value?: string | null) {
  const html = value?.trim() || "";
  return html && !isHtmlEmpty(html) ? html : null;
}

export function getReadingBookletHtml(
  part: "A" | "B" | "C",
  test: ReadingBookletSource,
  extractId?: string | null
) {
  switch (part) {
    case "A":
      return readingBookletHtml(test.partABookletHtml);
    case "B": {
      if (extractId && test.partBExtractBooklets?.[extractId]) {
        return readingBookletHtml(test.partBExtractBooklets[extractId]);
      }
      return readingBookletHtml(test.partBBookletHtml);
    }
    case "C": {
      if (extractId) {
        const index = resolveReadingPartCExtractIndex(extractId);
        const resolvedId = index !== null ? READING_PART_C_EXTRACT_IDS[index] : extractId;
        if (test.partCExtractBooklets?.[resolvedId]) {
          return readingBookletHtml(test.partCExtractBooklets[resolvedId]);
        }
        if (test.partCExtractBooklets?.[extractId]) {
          return readingBookletHtml(test.partCExtractBooklets[extractId]);
        }
      }
      return readingBookletHtml(test.partCBookletHtml);
    }
  }
}

/** Legacy PDF booklets — used when HTML content is not set. */
export function getReadingBookletUrl(
  part: "A" | "B" | "C",
  test: ReadingBookletSource,
  extractId?: string | null
) {
  if (getReadingBookletHtml(part, test, extractId)) return null;
  if (part === "A") {
    return test.bookletAsset?.signedUrl || null;
  }
  if (part === "B") {
    return test.partBBookletAsset?.signedUrl || null;
  }
  if (part === "C") {
    return test.partCBookletAsset?.signedUrl || null;
  }
  return null;
}

export function getPartBExtractIds(questions: TestQuestionDto[]) {
  const partBQuestions = questions
    .filter((q) => q.part === "B")
    .sort((left, right) => left.sequence - right.sequence);
  const ids = partBQuestions.map((q) => q.extractId).filter(Boolean) as string[];
  const unique = [...new Set(ids)];
  if (unique.length > 0) return unique;
  if (partBQuestions.length === 0) return [];
  return partBQuestions.map((question, index) => {
    if (question.sequence >= 21 && question.sequence <= 26) {
      return `reading-b-${question.sequence - 20}`;
    }
    return READING_PART_B_EXTRACT_IDS[index] ?? `reading-b-${index + 1}`;
  });
}

export function getPartCExtractIds(questions: TestQuestionDto[]) {
  const partCQuestions = questions
    .filter((q) => q.part === "C")
    .sort((left, right) => left.sequence - right.sequence);
  const ids = [
    ...new Set(
      partCQuestions
        .map((question) => resolveReadingPartCExtractIdForQuestion(question))
        .filter((id): id is string => Boolean(id))
    )
  ];
  if (ids.length > 0) {
    return ids.sort((left, right) => {
      const leftIndex = READING_PART_C_EXTRACT_IDS.indexOf(left as (typeof READING_PART_C_EXTRACT_IDS)[number]);
      const rightIndex = READING_PART_C_EXTRACT_IDS.indexOf(right as (typeof READING_PART_C_EXTRACT_IDS)[number]);
      if (leftIndex === -1 || rightIndex === -1) return left.localeCompare(right);
      return leftIndex - rightIndex;
    });
  }
  if (partCQuestions.length === 0) return [];
  const hasExtract1 = partCQuestions.some((q) => q.sequence >= 27 && q.sequence <= 34);
  const hasExtract2 = partCQuestions.some((q) => q.sequence >= 35 && q.sequence <= 42);
  return [
    ...(hasExtract1 ? [READING_PART_C_EXTRACT_IDS[0]] : []),
    ...(hasExtract2 ? [READING_PART_C_EXTRACT_IDS[1]] : [])
  ];
}

export function getQuestionsInReadingPartCExtract(questions: TestQuestionDto[], extractId: string) {
  return questions
    .filter((question) => questionMatchesReadingPartCExtract(question, extractId))
    .sort((left, right) => left.sequence - right.sequence);
}

type ListeningQuestionHeadingSource = {
  partAExtractQuestionHeadings?: Record<string, string> | null;
  partAQuestionHeadingGroups?: Record<
    string,
    Array<{ id: string; heading: string; questionSequences: number[] }>
  > | null;
  partCExtractQuestionHeadings?: Record<string, string> | null;
};

export function getListeningPartAQuestionHeadingGroups(
  test: ListeningQuestionHeadingSource,
  extractId?: string | null,
  extractIndex = 0
): ListeningPartAQuestionHeadingGroup[] {
  const resolvedId = resolveListeningPartAExtractId(extractId, extractIndex);
  return normalizeListeningPartAQuestionHeadingGroups(test.partAQuestionHeadingGroups)[resolvedId];
}

export function getListeningPartAQuestionSections(
  test: ListeningQuestionHeadingSource,
  extractId: string | null | undefined,
  extractIndex: number,
  questions: TestQuestionDto[]
): ListeningPartAQuestionSection[] | null {
  const groups = getListeningPartAQuestionHeadingGroups(test, extractId, extractIndex);
  if (!hasListeningPartAQuestionHeadingGroups(groups)) return null;
  return buildListeningPartAQuestionSections(groups, questions);
}

export function getListeningExtractQuestionHeading(
  test: ListeningQuestionHeadingSource,
  part: "A" | "B" | "C",
  extractId?: string | null,
  extractIndex = 0
) {
  if (part === "B" || !extractId) return null;
  const map = part === "A" ? test.partAExtractQuestionHeadings : test.partCExtractQuestionHeadings;
  const resolvedId =
    part === "A" ? resolveListeningPartAExtractId(extractId, extractIndex) : extractId;
  const html = map?.[resolvedId]?.trim() || map?.[extractId]?.trim() || "";
  if (!html || isRichContentEmpty(html)) return null;
  return html;
}

/**
 * True when an in-progress attempt should skip the intro and resume the exam.
 * Any started attempt must resume so refresh keeps the candidate in the test.
 */
export function hasExamResumeProgress(attempt: {
  status: string;
  currentQuestionIndex?: number | null;
  questionCountAnswered?: number | null;
  sectionExpiresAt?: string | null;
  answersJson?: Record<string, string> | null;
  startedAt?: string | null;
} | null): boolean {
  if (!attempt || attempt.status !== "IN_PROGRESS") return false;
  // Once the attempt exists, resume it — timers are wall-clock based and must not restart.
  return Boolean(attempt.startedAt || attempt.sectionExpiresAt);
}
