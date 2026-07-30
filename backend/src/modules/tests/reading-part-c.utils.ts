import { Prisma, QuestionPart, TestType } from "@prisma/client";

export const READING_PART_C_EXTRACT_IDS = ["reading-c-1", "reading-c-2"] as const;

function buildDefaultPartCExtractBooklets(fallback = "") {
  return Object.fromEntries(READING_PART_C_EXTRACT_IDS.map((id) => [id, fallback]));
}

export function hasPartCExtractBookletContent(booklets: Prisma.JsonValue | null | undefined) {
  if (!booklets || typeof booklets !== "object" || Array.isArray(booklets)) {
    return false;
  }

  return Object.values(booklets as Record<string, unknown>).some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

/** Ensures Q27–Q42 use reading-c-* extract ids and migrates legacy partCBookletHtml when needed. */
export async function reconcileReadingPartCStructure(
  prisma: Prisma.TransactionClient | PrismaServiceLike,
  testId: string
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      type: true,
      partCBookletHtml: true,
      partCExtractBooklets: true,
      questions: {
        where: { part: QuestionPart.C },
        select: { id: true, sequence: true, extractId: true },
        orderBy: { sequence: "asc" }
      }
    }
  });

  if (!test || test.type !== TestType.READING) {
    return;
  }

  for (const question of test.questions) {
    if (question.sequence < 27 || question.sequence > 42) {
      continue;
    }

    const expectedExtractId = question.sequence <= 34 ? "reading-c-1" : "reading-c-2";
    if (question.extractId !== expectedExtractId) {
      await prisma.question.update({
        where: { id: question.id },
        data: { extractId: expectedExtractId }
      });
    }
  }

  const legacyHtml = test.partCBookletHtml?.trim() || "";
  if (!legacyHtml || hasPartCExtractBookletContent(test.partCExtractBooklets)) {
    return;
  }

  await prisma.test.update({
    where: { id: testId },
    data: {
      partCExtractBooklets: buildDefaultPartCExtractBooklets(legacyHtml),
      partCBookletHtml: null
    }
  });
}

type PrismaServiceLike = {
  test: Prisma.TransactionClient["test"];
  question: Prisma.TransactionClient["question"];
};
