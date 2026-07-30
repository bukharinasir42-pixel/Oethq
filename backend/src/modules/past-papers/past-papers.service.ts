import { BadRequestException, NotFoundException } from "../../common/http-exception";
import { Prisma, TestType } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { buildQuestions } from "../tests/question-templates";
import { reconcileReadingPartBStructure } from "../tests/reading-part-b.utils";
import { reconcileReadingPartCStructure } from "../tests/reading-part-c.utils";
import { PublishPastPaperDto } from "./dto/publish-past-paper.dto";
import { UpsertPastPaperDto } from "./dto/upsert-past-paper.dto";
import {
  formatPastPaperDayTitle,
  isPastPaperTestTitle,
  MAX_PAST_PAPERS,
  parsePastPaperDayNumber
} from "./past-paper-title.utils";

type TestRef = { id: string; title: string; type: string; isPublished: boolean };

function serializeTestRef(test: TestRef) {
  return {
    id: test.id,
    title: test.title,
    type: test.type as "LISTENING" | "READING",
    isPublished: test.isPublished
  };
}

function listeningTestTitle(pastPaperTitle: string) {
  return `${pastPaperTitle} — Listening`;
}

function readingTestTitle(pastPaperTitle: string) {
  return `${pastPaperTitle} — Reading`;
}

export class PastPapersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAdmin() {
    await this.reconcileOrphanedPastPaperTests();

    const rows = await this.prisma.pastPaper.findMany({
      include: {
        listeningTest: { select: { id: true, title: true, type: true, isPublished: true } },
        readingTest: { select: { id: true, title: true, type: true, isPublished: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    await Promise.all(
      rows.flatMap((row) => [
        reconcileReadingPartBStructure(this.prisma, row.readingTest.id),
        reconcileReadingPartCStructure(this.prisma, row.readingTest.id)
      ])
    );

    return rows.map((row) => this.serialize(row));
  }

  async listPublished() {
    const rows = await this.prisma.pastPaper.findMany({
      where: { isPublished: true },
      include: {
        listeningTest: { select: { id: true, title: true, type: true, isPublished: true } },
        readingTest: { select: { id: true, title: true, type: true, isPublished: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    return rows.map((row) => this.serialize(row));
  }

  async getForAdmin(id: string) {
    const row = await this.findWithTests(id);
    await reconcileReadingPartBStructure(this.prisma, row.readingTest.id);
    await reconcileReadingPartCStructure(this.prisma, row.readingTest.id);
    return this.serialize(row);
  }

  async create(dto: UpsertPastPaperDto) {
    const existingCount = await this.prisma.pastPaper.count();
    if (existingCount >= MAX_PAST_PAPERS) {
      throw new BadRequestException(`Cannot create more than ${MAX_PAST_PAPERS} past papers`);
    }

    const title = dto.title.trim();
    const listeningTitle = listeningTestTitle(title);
    const readingTitle = readingTestTitle(title);

    const created = await this.prisma.$transaction(async (tx) => {
      const listeningTest = await this.createDraftTest(tx, TestType.LISTENING, listeningTitle);
      const readingTest = await this.createDraftTest(tx, TestType.READING, readingTitle);

      return tx.pastPaper.create({
        data: {
          title,
          description: dto.description?.trim() || null,
          listeningTestId: listeningTest.id,
          readingTestId: readingTest.id,
          isPublished: dto.isPublished ?? false
        },
        include: {
          listeningTest: { select: { id: true, title: true, type: true, isPublished: true } },
          readingTest: { select: { id: true, title: true, type: true, isPublished: true } }
        }
      });
    });

    await reconcileReadingPartBStructure(this.prisma, created.readingTest.id);
    await reconcileReadingPartCStructure(this.prisma, created.readingTest.id);

    return this.serialize(created);
  }

  async update(id: string, dto: UpsertPastPaperDto) {
    const existing = await this.findWithTests(id);
    const title = dto.title.trim();
    const listeningTitle = listeningTestTitle(title);
    const readingTitle = readingTestTitle(title);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id: existing.listeningTest.id },
        data: { title: listeningTitle }
      });
      await tx.test.update({
        where: { id: existing.readingTest.id },
        data: { title: readingTitle }
      });

      return tx.pastPaper.update({
        where: { id },
        data: {
          title,
          description: dto.description?.trim() || null,
          isPublished: dto.isPublished ?? existing.isPublished
        },
        include: {
          listeningTest: { select: { id: true, title: true, type: true, isPublished: true } },
          readingTest: { select: { id: true, title: true, type: true, isPublished: true } }
        }
      });
    });

    return this.serialize(updated);
  }

  async publish(id: string, dto: PublishPastPaperDto) {
    const row = await this.findWithTests(id);

    if (dto.isPublished) {
      await reconcileReadingPartBStructure(this.prisma, row.readingTest.id);
      await reconcileReadingPartCStructure(this.prisma, row.readingTest.id);
      await this.ensurePastPaperReadyToPublish(row.listeningTest.id, row.readingTest.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id: row.listeningTest.id },
        data: { isPublished: dto.isPublished }
      });
      await tx.test.update({
        where: { id: row.readingTest.id },
        data: { isPublished: dto.isPublished }
      });

      return tx.pastPaper.update({
        where: { id },
        data: { isPublished: dto.isPublished },
        include: {
          listeningTest: { select: { id: true, title: true, type: true, isPublished: true } },
          readingTest: { select: { id: true, title: true, type: true, isPublished: true } }
        }
      });
    });

    return this.serialize(updated);
  }

  async remove(id: string) {
    const row = await this.findWithTests(id);
    const listeningTestId = row.listeningTest.id;
    const readingTestId = row.readingTest.id;

    await this.prisma.$transaction(async (tx) => {
      await tx.dailyTask.updateMany({
        where: { assignedPastPaperId: id },
        data: { assignedPastPaperId: null }
      });
      await tx.pastPaper.delete({ where: { id } });
      await this.deleteTestWithDependents(tx, listeningTestId);
      await this.deleteTestWithDependents(tx, readingTestId);
    });

    return { ok: true };
  }

  async isPastPaperOwnedTest(testId: string) {
    const linked = await this.prisma.pastPaper.findFirst({
      where: { OR: [{ listeningTestId: testId }, { readingTestId: testId }] },
      select: { id: true }
    });
    if (linked) {
      return true;
    }

    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { title: true }
    });

    return Boolean(test && isPastPaperTestTitle(test.title));
  }

  /** Links legacy "Past Paper Day N" tests that were created without a PastPaper row. */
  private async reconcileOrphanedPastPaperTests() {
    const bundles = await this.prisma.pastPaper.findMany({
      select: { listeningTestId: true, readingTestId: true }
    });
    const linkedTestIds = new Set(
      bundles.flatMap((paper) => [paper.listeningTestId, paper.readingTestId])
    );

    const orphanCandidates = await this.prisma.test.findMany({
      where: linkedTestIds.size > 0 ? { id: { notIn: [...linkedTestIds] } } : undefined,
      select: { id: true, type: true, title: true, isPublished: true }
    });

    const pairsByDay = new Map<number, { listeningId?: string; readingId?: string; published: boolean }>();

    for (const test of orphanCandidates) {
      if (!isPastPaperTestTitle(test.title)) {
        continue;
      }

      const dayNumber = parsePastPaperDayNumber(test.title);
      if (dayNumber === Number.MAX_SAFE_INTEGER) {
        continue;
      }

      const entry = pairsByDay.get(dayNumber) ?? { published: true };
      if (test.type === TestType.LISTENING) {
        entry.listeningId = test.id;
      } else if (test.type === TestType.READING) {
        entry.readingId = test.id;
      }
      entry.published = entry.published && test.isPublished;
      pairsByDay.set(dayNumber, entry);
    }

    for (const [dayNumber, pair] of pairsByDay) {
      if (!pair.listeningId || !pair.readingId) {
        continue;
      }

      const existing = await this.prisma.pastPaper.findFirst({
        where: {
          OR: [{ listeningTestId: pair.listeningId }, { readingTestId: pair.readingId }]
        },
        select: { id: true }
      });
      if (existing) {
        continue;
      }

      await this.prisma.pastPaper.create({
        data: {
          title: formatPastPaperDayTitle(dayNumber),
          listeningTestId: pair.listeningId,
          readingTestId: pair.readingId,
          isPublished: pair.published
        }
      });
    }
  }

  private async createDraftTest(tx: Prisma.TransactionClient, type: TestType, title: string) {
    const questions = buildQuestions(type, "Past paper ");

    return tx.test.create({
      data: {
        type,
        title,
        description: null,
        instructions:
          type === TestType.LISTENING
            ? "Listen once per extract. No pause or rewind. The attempt auto-submits 10 seconds after the final audio ends."
            : "Part A: 20 fill-in-the-blank questions, 15 minutes (auto-submit). Parts B and C: 45 minutes shared.",
        totalQuestions: 42,
        timerDuration: type === TestType.LISTENING ? 1 : 60,
        partATimer: type === TestType.READING ? 15 : null,
        partBCTimer: type === TestType.READING ? 45 : null,
        isPublished: false,
        questions: {
          create: questions.map((question) => ({
            sequence: question.sequence,
            part: question.part,
            extractId: question.extractId,
            type: question.type,
            content: question.content,
            options: question.options ?? undefined,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            points: question.points
          }))
        }
      }
    });
  }

  private async deleteTestWithDependents(tx: Prisma.TransactionClient, testId: string) {
    const attempts = await tx.testAttempt.findMany({
      where: { testId },
      select: { id: true }
    });
    const attemptIds = attempts.map((attempt) => attempt.id);

    if (attemptIds.length > 0) {
      await tx.attemptAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } });
      await tx.testAttempt.deleteMany({ where: { id: { in: attemptIds } } });
    }

    await tx.testResult.deleteMany({ where: { testId } });
    await tx.listeningAudioTrack.deleteMany({ where: { testId } });
    await tx.question.deleteMany({ where: { testId } });
    await tx.test.delete({ where: { id: testId } });
  }

  private async ensurePastPaperReadyToPublish(listeningTestId: string, readingTestId: string) {
    const tests = await this.prisma.test.findMany({
      where: { id: { in: [listeningTestId, readingTestId] } },
      include: {
        listeningTracks: true,
        questions: { select: { id: true } }
      }
    });

    for (const test of tests) {
      // OET-import tests keep their questions in contentJson (the legacy question
      // rows are empty); accept either source so contentJson-driven past papers
      // can be published, not just legacy row-built ones.
      const hasQuestions =
        test.questions.length > 0 ||
        (test.contentJson != null && (test.totalQuestions ?? 0) > 0);
      if (!hasQuestions) {
        throw new BadRequestException(`${test.title} has no questions and cannot be published yet`);
      }
    }
  }

  private async findWithTests(id: string) {
    const row = await this.prisma.pastPaper.findUnique({
      where: { id },
      include: {
        listeningTest: { select: { id: true, title: true, type: true, isPublished: true } },
        readingTest: { select: { id: true, title: true, type: true, isPublished: true } }
      }
    });

    if (!row) {
      throw new NotFoundException("Past paper not found");
    }

    return row;
  }

  private serialize(row: {
    id: string;
    title: string;
    description: string | null;
    isPublished: boolean;
    listeningTest: TestRef;
    readingTest: TestRef;
  }) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      isPublished: row.isPublished,
      listeningTest: serializeTestRef(row.listeningTest),
      readingTest: serializeTestRef(row.readingTest)
    };
  }
}
