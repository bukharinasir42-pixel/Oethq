import { Prisma, QuestionPart, TestType } from "@prisma/client";

export const READING_PART_B_EXTRACT_IDS = [
  "reading-b-1",
  "reading-b-2",
  "reading-b-3",
  "reading-b-4",
  "reading-b-5",
  "reading-b-6"
] as const;

function buildDefaultPartBExtractBooklets(fallback = "") {
  return Object.fromEntries(READING_PART_B_EXTRACT_IDS.map((id) => [id, fallback]));
}

export function hasPartBExtractBookletContent(booklets: Prisma.JsonValue | null | undefined) {
  if (!booklets || typeof booklets !== "object" || Array.isArray(booklets)) {
    return false;
  }

  return Object.values(booklets as Record<string, unknown>).some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

/** Ensures Q21–Q26 use reading-b-* extract ids and migrates legacy partBBookletHtml when needed. */
export async function reconcileReadingPartBStructure(
  prisma: Prisma.TransactionClient | PrismaServiceLike,
  testId: string
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      type: true,
      partBBookletHtml: true,
      partBExtractBooklets: true,
      questions: {
        where: { part: QuestionPart.B },
        select: { id: true, sequence: true, extractId: true },
        orderBy: { sequence: "asc" }
      }
    }
  });

  if (!test || test.type !== TestType.READING) {
    return;
  }

  for (const question of test.questions) {
    if (question.sequence < 21 || question.sequence > 26) {
      continue;
    }

    const expectedExtractId = `reading-b-${question.sequence - 20}`;
    if (question.extractId !== expectedExtractId) {
      await prisma.question.update({
        where: { id: question.id },
        data: { extractId: expectedExtractId }
      });
    }
  }

  const legacyHtml = test.partBBookletHtml?.trim() || "";
  if (!legacyHtml || hasPartBExtractBookletContent(test.partBExtractBooklets)) {
    return;
  }

  await prisma.test.update({
    where: { id: testId },
    data: {
      partBExtractBooklets: buildDefaultPartBExtractBooklets(legacyHtml),
      partBBookletHtml: null
    }
  });
}

type PrismaServiceLike = {
  test: Prisma.TransactionClient["test"];
  question: Prisma.TransactionClient["question"];
};
