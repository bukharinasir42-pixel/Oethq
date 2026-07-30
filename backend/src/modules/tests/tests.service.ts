import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "../../common/http-exception";
import {
  AttemptSection,
  AttemptStatus,
  PlanTier,
  Prisma,
  Role,
  SubscriptionStatus,
  TestType
} from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { GradingService } from "../grading/grading.service";
import { StorageService } from "../storage/storage.service";
import { pickEffectiveSubscriptionForAccess } from "../subscriptions/subscription-access.utils";
import { PublishTestDto } from "./dto/publish-test.dto";
import { SaveAttemptProgressDto } from "./dto/save-attempt-progress.dto";
import { SubmitAttemptDto } from "./dto/submit-attempt.dto";
import {
  buildAttemptTiming,
  buildReadingPartBCSectionExpiry,
  getReadingPartBCDeadline,
  isReadingPartAExpired,
  scoreAttempt
} from "./test-engine.utils";
import { UpsertQuestionDto } from "./dto/upsert-question.dto";
import { UpsertTestDto } from "./dto/upsert-test.dto";
import { isPastPaperTestTitle, parsePastPaperDayNumber } from "../past-papers/past-paper-title.utils";
import { reconcileReadingPartBStructure, hasPartBExtractBookletContent } from "./reading-part-b.utils";
import { reconcileReadingPartCStructure, hasPartCExtractBookletContent } from "./reading-part-c.utils";
import { validateListeningPartAQuestionHeadingGroups } from "./listening-part-a-question-heading-groups.utils";

const testWithQuestionsInclude = {
  questions: {
    orderBy: {
      sequence: "asc" as const
    }
  },
  listeningTracks: {
    orderBy: {
      sortOrder: "asc" as const
    }
  }
} satisfies Prisma.TestInclude;

const testAttemptInclude = {
  test: {
    include: testWithQuestionsInclude
  },
  answers: true
} satisfies Prisma.TestAttemptInclude;

type TestWithQuestions = Prisma.TestGetPayload<{
  include: typeof testWithQuestionsInclude;
}>;

type AttemptWithContext = Prisma.TestAttemptGetPayload<{
  include: typeof testAttemptInclude;
}>;

export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradingService: GradingService,
    private readonly storageService: StorageService
  ) {}

  async listPublished() {
    const tests = await this.prisma.test.findMany({
      where: { isPublished: true },
      include: {
        questions: {
          select: {
            id: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return tests.map((test) => ({
      id: test.id,
      type: test.type,
      title: test.title,
      description: test.description,
      instructions: test.instructions,
      totalQuestions: test.totalQuestions,
      timerDuration: test.timerDuration,
      partATimer: test.partATimer,
      partBCTimer: test.partBCTimer,
      isPublished: test.isPublished,
      questionCount: test.questions.length
    }));
  }

  async listAllForAdmin() {
    const pastPaperTests = await this.prisma.pastPaper.findMany({
      select: { listeningTestId: true, readingTestId: true }
    });
    const pastPaperTestIds = new Set(
      pastPaperTests.flatMap((paper) => [paper.listeningTestId, paper.readingTestId])
    );

    const tests = await this.prisma.test.findMany({
      where: pastPaperTestIds.size > 0 ? { id: { notIn: [...pastPaperTestIds] } } : undefined,
      include: {
        questions: {
          select: {
            id: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return tests
      .filter((test) => !pastPaperTestIds.has(test.id) && !isPastPaperTestTitle(test.title))
      .map((test) => ({
        id: test.id,
        type: test.type,
        title: test.title,
        description: test.description,
        instructions: test.instructions,
        totalQuestions: test.totalQuestions,
        timerDuration: test.timerDuration,
        partATimer: test.partATimer,
        partBCTimer: test.partBCTimer,
        isPublished: test.isPublished,
        questionCount: test.questions.length,
        isImported: test.contentJson != null
      }));
  }

  async stats() {
    const [totalTests, publishedTests, attemptsInProgress, completedToday] = await Promise.all([
      this.prisma.test.count(),
      this.prisma.test.count({ where: { isPublished: true } }),
      this.prisma.testAttempt.count({ where: { status: AttemptStatus.IN_PROGRESS } }),
      this.prisma.testAttempt.count({
        where: {
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] },
          submittedAt: {
            gte: this.startOfDay()
          }
        }
      })
    ]);

    return {
      totalTests,
      publishedTests,
      attemptsInProgress,
      completedToday
    };
  }

  async getAdminDetail(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: testWithQuestionsInclude
    });
    if (!test) {
      throw new NotFoundException("Test not found");
    }

    const linkedPastPaper = await this.getLinkedPastPaperSummary(id);

    if (test.type === TestType.READING) {
      await reconcileReadingPartBStructure(this.prisma, id);
      await reconcileReadingPartCStructure(this.prisma, id);
      const refreshed = await this.prisma.test.findUniqueOrThrow({
        where: { id },
        include: testWithQuestionsInclude
      });
      return {
        ...(await this.serializeTest(refreshed, true)),
        linkedPastPaper
      };
    }

    return {
      ...(await this.serializeTest(test, true)),
      linkedPastPaper
    };
  }

  async getCandidateDetail(id: string, userId: string) {
    let test = await this.prisma.test.findUnique({
      where: { id },
      include: testWithQuestionsInclude
    });
    if (!test || !test.isPublished) {
      throw new NotFoundException("Published test not found");
    }

    if (test.type === TestType.READING) {
      await reconcileReadingPartBStructure(this.prisma, id);
      await reconcileReadingPartCStructure(this.prisma, id);
      test = await this.prisma.test.findUniqueOrThrow({
        where: { id },
        include: testWithQuestionsInclude
      });
    }

    const latestResult = await this.prisma.testResult.findUnique({
      where: {
        userId_testId: {
          userId,
          testId: id
        }
      }
    });

    return {
      ...(await this.serializeTest(test, false)),
      latestResult
    };
  }

  async create(dto: UpsertTestDto) {
    this.validateQuestions(dto);

    const lm = this.listeningMediaForUpsert(dto);
    const created = await this.prisma.test.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        partASubInstructions: dto.partASubInstructions,
        partBSubInstructions: dto.partBSubInstructions,
        partCSubInstructions: dto.partCSubInstructions,
        partABookletHtml: dto.type === TestType.READING ? (dto.partABookletHtml ?? null) : null,
        partBBookletHtml:
          dto.type === TestType.READING
            ? hasPartBExtractBookletContent(dto.partBExtractBooklets ?? null)
              ? null
              : dto.partBBookletHtml ?? null
            : null,
        partBExtractBooklets:
          dto.type === TestType.READING
            ? ((dto.partBExtractBooklets ?? null) as Prisma.InputJsonValue)
            : undefined,
        partAExtractQuestionHeadings:
          dto.type === TestType.LISTENING
            ? ((dto.partAExtractQuestionHeadings ?? null) as Prisma.InputJsonValue)
            : undefined,
        partAQuestionHeadingGroups:
          dto.type === TestType.LISTENING
            ? ((dto.partAQuestionHeadingGroups ?? null) as Prisma.InputJsonValue)
            : undefined,
        partCExtractQuestionHeadings:
          dto.type === TestType.LISTENING
            ? ((dto.partCExtractQuestionHeadings ?? null) as Prisma.InputJsonValue)
            : undefined,
        partCBookletHtml:
          dto.type === TestType.READING
            ? hasPartCExtractBookletContent(dto.partCExtractBooklets ?? null)
              ? null
              : dto.partCBookletHtml ?? null
            : null,
        partCExtractBooklets:
          dto.type === TestType.READING
            ? ((dto.partCExtractBooklets ?? null) as Prisma.InputJsonValue)
            : undefined,
        totalQuestions: dto.totalQuestions,
        timerDuration: dto.timerDuration,
        partATimer: dto.partATimer,
        partBCTimer: dto.partBCTimer,
        audioAssetId: dto.type === TestType.LISTENING ? lm.audioAssetId : null,
        bookletAssetId: dto.type === TestType.READING ? null : dto.bookletAssetId,
        partBBookletAssetId: dto.type === TestType.READING ? null : dto.partBBookletAssetId,
        partCBookletAssetId: dto.type === TestType.READING ? null : dto.partCBookletAssetId,
        isPublished: dto.isPublished ?? false,
        listeningTracks:
          dto.type === TestType.LISTENING && lm.trackCreates?.length
            ? { create: lm.trackCreates }
            : undefined,
        questions: {
          create: dto.questions.map((question) => ({
            sequence: question.sequence,
            part: question.part,
            extractId: question.extractId,
            type: question.type,
            content: question.content,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            points: question.points ?? 1
          }))
        }
      },
      include: testWithQuestionsInclude
    });

    if (created.type === TestType.READING) {
      await reconcileReadingPartBStructure(this.prisma, created.id);
      await reconcileReadingPartCStructure(this.prisma, created.id);
      const refreshed = await this.prisma.test.findUniqueOrThrow({
        where: { id: created.id },
        include: testWithQuestionsInclude
      });
      return this.serializeTest(refreshed, true);
    }

    return this.serializeTest(created, true);
  }

  async update(id: string, dto: UpsertTestDto) {
    await this.ensureTestExists(id);
    this.validateQuestions(dto);

    const lm = this.listeningMediaForUpsert(dto);
    await this.prisma.test.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        partASubInstructions: dto.partASubInstructions,
        partBSubInstructions: dto.partBSubInstructions,
        partCSubInstructions: dto.partCSubInstructions,
        partABookletHtml: dto.type === TestType.READING ? (dto.partABookletHtml ?? null) : null,
        partBBookletHtml:
          dto.type === TestType.READING
            ? hasPartBExtractBookletContent(dto.partBExtractBooklets ?? null)
              ? null
              : dto.partBBookletHtml ?? null
            : null,
        partBExtractBooklets:
          dto.type === TestType.READING
            ? ((dto.partBExtractBooklets ?? null) as Prisma.InputJsonValue)
            : undefined,
        partAExtractQuestionHeadings:
          dto.type === TestType.LISTENING
            ? ((dto.partAExtractQuestionHeadings ?? null) as Prisma.InputJsonValue)
            : undefined,
        partAQuestionHeadingGroups:
          dto.type === TestType.LISTENING
            ? ((dto.partAQuestionHeadingGroups ?? null) as Prisma.InputJsonValue)
            : undefined,
        partCExtractQuestionHeadings:
          dto.type === TestType.LISTENING
            ? ((dto.partCExtractQuestionHeadings ?? null) as Prisma.InputJsonValue)
            : undefined,
        partCBookletHtml:
          dto.type === TestType.READING
            ? hasPartCExtractBookletContent(dto.partCExtractBooklets ?? null)
              ? null
              : dto.partCBookletHtml ?? null
            : null,
        partCExtractBooklets:
          dto.type === TestType.READING
            ? ((dto.partCExtractBooklets ?? null) as Prisma.InputJsonValue)
            : undefined,
        totalQuestions: dto.totalQuestions,
        timerDuration: dto.timerDuration,
        partATimer: dto.partATimer,
        partBCTimer: dto.partBCTimer,
        audioAssetId: dto.type === TestType.LISTENING ? lm.audioAssetId : null,
        bookletAssetId: dto.type === TestType.READING ? null : dto.bookletAssetId,
        partBBookletAssetId: dto.type === TestType.READING ? null : dto.partBBookletAssetId,
        partCBookletAssetId: dto.type === TestType.READING ? null : dto.partCBookletAssetId,
        isPublished: dto.isPublished ?? false
      }
    });

    await this.syncListeningTracks(id, dto, lm);
    await this.syncTestQuestions(id, dto.questions);

    if (dto.type === TestType.READING) {
      await reconcileReadingPartBStructure(this.prisma, id);
      await reconcileReadingPartCStructure(this.prisma, id);
    }

    const updated = await this.prisma.test.findUniqueOrThrow({
      where: { id },
      include: testWithQuestionsInclude
    });

    return this.serializeTest(updated, true);
  }

  async delete(id: string) {
    await this.ensureTestExists(id);

    const linkedPastPaper = await this.prisma.pastPaper.findFirst({
      where: { OR: [{ listeningTestId: id }, { readingTestId: id }] },
      select: { title: true }
    });
    if (linkedPastPaper) {
      throw new BadRequestException(
        `Cannot delete test linked to past paper "${linkedPastPaper.title}". Remove or update the past paper first.`
      );
    }

    const test = await this.prisma.test.findUnique({
      where: { id },
      select: { title: true }
    });
    if (test && isPastPaperTestTitle(test.title)) {
      throw new BadRequestException(
        "Cannot delete a past paper test from Test Builder. Open Past Paper and remove the bundle instead."
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dailyTask.updateMany({
        where: { assignedReadingTestId: id },
        data: { assignedReadingTestId: null }
      });
      await tx.dailyTask.updateMany({
        where: { assignedListeningTestId: id },
        data: { assignedListeningTestId: null }
      });
      await tx.dailyTask.updateMany({
        where: { assignedPastPaperTestId: id },
        data: { assignedPastPaperTestId: null }
      });

      const attempts = await tx.testAttempt.findMany({
        where: { testId: id },
        select: { id: true }
      });
      const attemptIds = attempts.map((attempt) => attempt.id);

      if (attemptIds.length > 0) {
        await tx.attemptAnswer.deleteMany({
          where: { attemptId: { in: attemptIds } }
        });
        await tx.testAttempt.deleteMany({
          where: { id: { in: attemptIds } }
        });
      }

      await tx.testResult.deleteMany({ where: { testId: id } });
      await tx.listeningAudioTrack.deleteMany({ where: { testId: id } });
      await tx.question.deleteMany({ where: { testId: id } });
      await tx.test.delete({ where: { id } });
    });

    return { deleted: true };
  }

  async publish(id: string, dto: PublishTestDto) {
    const linkedPastPaper = await this.prisma.pastPaper.findFirst({
      where: { OR: [{ listeningTestId: id }, { readingTestId: id }] },
      select: { title: true }
    });
    if (linkedPastPaper) {
      throw new BadRequestException(
        `Publish "${linkedPastPaper.title}" from the Past Paper page instead of individual tests.`
      );
    }

    if (dto.isPublished) {
      const existing = await this.prisma.test.findUnique({
        where: { id },
        include: {
          listeningTracks: true,
          questions: { select: { id: true } }
        }
      });
      if (!existing) {
        throw new NotFoundException("Test not found");
      }
      // Imported OET tests carry their questions inside contentJson (no Question
      // rows), so only enforce the row check for legacy builder tests.
      if (existing.contentJson == null && existing.questions.length === 0) {
        throw new BadRequestException("Cannot publish a test with no questions");
      }
    }

    const test = await this.prisma.test.update({
      where: { id },
      data: {
        isPublished: dto.isPublished
      },
      include: testWithQuestionsInclude
    });

    return this.serializeTest(test, true);
  }

  async startAttempt(testId: string, userId: string) {
    let test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: testWithQuestionsInclude
    });
    if (!test || !test.isPublished) {
      throw new NotFoundException("Published test not found");
    }

    await this.ensurePastPaperTestAccess(testId, userId);

    if (test.type === TestType.READING && (await this.isPastPaperOwnedReadingTest(testId))) {
      await reconcileReadingPartBStructure(this.prisma, testId);
      await reconcileReadingPartCStructure(this.prisma, testId);
      test = await this.prisma.test.findUniqueOrThrow({
        where: { id: testId },
        include: testWithQuestionsInclude
      });
    }

    const existingAttempt = await this.prisma.testAttempt.findFirst({
      where: {
        testId,
        userId,
        status: AttemptStatus.IN_PROGRESS
      },
      include: testAttemptInclude,
      orderBy: {
        createdAt: "desc"
      }
    });

    if (existingAttempt) {
      return this.serializeAttempt(existingAttempt, Role.CANDIDATE);
    }

    const timing = buildAttemptTiming(test.type, test.timerDuration, test.partATimer ?? undefined);
    const createdAttempt = await this.prisma.testAttempt.create({
      data: {
        userId,
        testId,
        section: timing.section,
        expiresAt: timing.expiresAt,
        sectionExpiresAt: timing.sectionExpiresAt,
        timeRemainingSeconds: timing.timeRemainingSeconds,
        audioUnlockedAt: test.type === TestType.LISTENING ? new Date() : null,
        answersJson: {}
      },
      include: testAttemptInclude
    });

    return this.serializeAttempt(createdAttempt, Role.CANDIDATE);
  }

  async getCurrentAttempt(testId: string, userId: string) {
    const attempt = await this.prisma.testAttempt.findFirst({
      where: {
        testId,
        userId,
        status: AttemptStatus.IN_PROGRESS
      },
      include: testAttemptInclude,
      orderBy: {
        createdAt: "desc"
      }
    });

    return attempt ? this.serializeAttempt(attempt, Role.CANDIDATE) : null;
  }

  async getAttempt(attemptId: string, userId: string, role: Role) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: testAttemptInclude
    });
    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }
    if (role !== Role.ADMIN && attempt.userId !== userId) {
      throw new ForbiddenException("Attempt access denied");
    }

    return this.serializeAttempt(attempt, role);
  }

  async saveProgress(attemptId: string, userId: string, dto: SaveAttemptProgressDto) {
    const owned = await this.getOwnedInProgressAttempt(attemptId, userId);

    const requestingPartBC =
      owned.test.type === TestType.READING &&
      owned.section === AttemptSection.READING_PART_A &&
      (dto.finishPartAEarly === true || dto.section === AttemptSection.READING_PART_BC);
    const partATimedOut = this.shouldCaptureFinalPartASnapshot(owned);

    // Leave Part A (timer expired or candidate finished early): freeze answers, start B & C.
    if (requestingPartBC || partATimedOut) {
      await this.persistAnswers(owned.id, dto.answers, owned.test.questions);
      const firstNonPartAIndex = owned.test.questions.findIndex((question) => question.part !== "A");
      // Any leave before the Part A wall-clock ends starts a fresh 45-minute B & C window.
      const early = !partATimedOut;
      const now = new Date();
      const sectionExpiresAt = early
        ? buildReadingPartBCSectionExpiry(owned.test.partBCTimer, now)
        : getReadingPartBCDeadline(owned.startedAt, owned.test.partATimer, owned.test.partBCTimer);
      const updated = await this.prisma.testAttempt.update({
        where: { id: owned.id },
        data: {
          section: AttemptSection.READING_PART_BC,
          sectionExpiresAt,
          // Early finish: overall attempt ends when the fresh 45-minute B & C window ends.
          ...(early ? { expiresAt: sectionExpiresAt } : {}),
          currentQuestionIndex: (() => {
            const dtoQuestion = owned.test.questions[dto.currentQuestionIndex];
            if (dtoQuestion && dtoQuestion.part !== "A") return dto.currentQuestionIndex;
            return firstNonPartAIndex >= 0 ? firstNonPartAIndex : dto.currentQuestionIndex;
          })(),
          questionCountAnswered: dto.questionCountAnswered ?? dto.answers.length,
          timeRemainingSeconds: early
            ? Math.max(0, Math.ceil((sectionExpiresAt.getTime() - now.getTime()) / 1000))
            : dto.timeRemainingSeconds,
          audioPositionSeconds: dto.audioPositionSeconds ?? owned.audioPositionSeconds,
          audioCompleted: dto.audioCompleted ?? owned.audioCompleted,
          countdownStartedAt:
            dto.timeRemainingSeconds !== undefined && dto.timeRemainingSeconds <= 10
              ? owned.countdownStartedAt ?? new Date()
              : owned.countdownStartedAt,
          answersJson: this.asAnswerJson(dto.answers),
          ...(dto.currentListeningTrackIndex !== undefined
            ? { currentListeningTrackIndex: dto.currentListeningTrackIndex }
            : {}),
          listeningFinalCountdownEndsAt:
            dto.listeningFinalCountdownEndsAt === undefined
              ? owned.listeningFinalCountdownEndsAt
              : dto.listeningFinalCountdownEndsAt
                ? new Date(dto.listeningFinalCountdownEndsAt)
                : null
        },
        include: testAttemptInclude
      });
      return this.serializeAttempt(updated, Role.CANDIDATE);
    }

    const attempt = await this.ensureReadingPartAClosed(owned);
    const { answers, answersJson, section, currentQuestionIndex, sectionExpiresAt } =
      this.applyReadingPartALockToProgress(attempt, dto);

    await this.persistAnswers(attempt.id, answers, attempt.test.questions);

    const updated = await this.prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        section,
        sectionExpiresAt,
        currentQuestionIndex,
        questionCountAnswered: dto.questionCountAnswered ?? answers.length,
        timeRemainingSeconds: dto.timeRemainingSeconds,
        audioPositionSeconds: dto.audioPositionSeconds ?? attempt.audioPositionSeconds,
        audioCompleted: dto.audioCompleted ?? attempt.audioCompleted,
        countdownStartedAt:
          dto.timeRemainingSeconds !== undefined && dto.timeRemainingSeconds <= 10
            ? attempt.countdownStartedAt ?? new Date()
            : attempt.countdownStartedAt,
        answersJson,
        ...(dto.currentListeningTrackIndex !== undefined
          ? { currentListeningTrackIndex: dto.currentListeningTrackIndex }
          : {}),
        listeningFinalCountdownEndsAt:
          dto.listeningFinalCountdownEndsAt === undefined
            ? attempt.listeningFinalCountdownEndsAt
            : dto.listeningFinalCountdownEndsAt
              ? new Date(dto.listeningFinalCountdownEndsAt)
              : null
      },
      include: testAttemptInclude
    });

    return this.serializeAttempt(updated, Role.CANDIDATE);
  }

  async submitAttempt(attemptId: string, userId: string, dto: SubmitAttemptDto) {
    const owned = await this.getOwnedInProgressAttempt(attemptId, userId);
    const attempt = this.shouldCaptureFinalPartASnapshot(owned)
      ? owned
      : await this.ensureReadingPartAClosed(owned);
    const { answers, answersJson, currentQuestionIndex } = this.shouldCaptureFinalPartASnapshot(owned)
      ? {
          answers: dto.answers,
          answersJson: this.asAnswerJson(dto.answers),
          currentQuestionIndex: dto.currentQuestionIndex
        }
      : this.applyReadingPartALockToProgress(attempt, dto);

    await this.persistAnswers(attempt.id, answers, attempt.test.questions);

    const scoring = scoreAttempt(
      attempt.test.questions.map((question) => ({
        id: question.id,
        part: question.part,
        sequence: question.sequence,
        type: question.type,
        correctAnswer: question.correctAnswer,
        points: question.points
      })),
      answersJson,
      attempt.test.type
    );
    const score = scoring.score;
    const partAScore = scoring.partAScore;
    const partBScore = scoring.partBScore;
    const partCScore = scoring.partCScore;
    const band = this.gradingService.getBandForScore(score);
    const submittedAt = new Date();

    const updatedAttempt = await this.prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: dto.autoSubmit ? AttemptStatus.AUTO_SUBMITTED : AttemptStatus.SUBMITTED,
        section: AttemptSection.COMPLETE,
        submittedAt,
        autoSubmittedAt: dto.autoSubmit ? submittedAt : null,
        currentQuestionIndex,
        questionCountAnswered: dto.questionCountAnswered ?? scoring.answeredCount,
        timeRemainingSeconds: dto.timeRemainingSeconds ?? 0,
        audioPositionSeconds: dto.audioPositionSeconds ?? attempt.audioPositionSeconds,
        audioCompleted: dto.audioCompleted ?? attempt.audioCompleted,
        currentListeningTrackIndex: dto.currentListeningTrackIndex ?? attempt.currentListeningTrackIndex,
        listeningFinalCountdownEndsAt: null,
        answersJson,
        score,
        partAScore,
        partBScore,
        partCScore,
        bandLabel: band.label,
        passProbability: band.passProbability
      },
      include: testAttemptInclude
    });

    const existingRetained = await this.prisma.testResult.findUnique({
      where: {
        userId_testId: {
          userId,
          testId: attempt.testId
        }
      }
    });

    const retainedResult = await this.prisma.testResult.upsert({
      where: {
        userId_testId: {
          userId,
          testId: attempt.testId
        }
      },
      create: {
        userId,
        testId: attempt.testId,
        latestAttemptId: attempt.id,
        score,
        partAScore,
        partBScore,
        partCScore,
        bandLabel: band.label,
        passProbability: band.passProbability,
        completedAt: submittedAt,
        attemptsCount: 1
      },
      update: {
        latestAttemptId: attempt.id,
        score,
        partAScore,
        partBScore,
        partCScore,
        bandLabel: band.label,
        passProbability: band.passProbability,
        completedAt: submittedAt,
        attemptsCount: (existingRetained?.attemptsCount || 0) + 1
      }
    });

    return {
      retainedResult,
      attempt: await this.serializeAttempt(updatedAttempt, Role.CANDIDATE)
    };
  }

  async listResultsForUser(userId: string) {
    const [retainedResults, attempts] = await Promise.all([
      this.prisma.testResult.findMany({
        where: { userId },
        include: {
          test: true
        },
        orderBy: {
          completedAt: "desc"
        }
      }),
      this.prisma.testAttempt.findMany({
        where: {
          userId,
          status: {
            in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED]
          }
        },
        include: {
          test: true
        },
        orderBy: {
          submittedAt: "desc"
        },
        take: 20
      })
    ]);

    return {
      retainedResults,
      attempts
    };
  }

  private questionDataFromDto(question: UpsertQuestionDto) {
    return {
      part: question.part,
      extractId: question.extractId,
      type: question.type,
      content: question.content,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      points: question.points ?? 1
    };
  }

  private async syncListeningTracks(
    testId: string,
    dto: UpsertTestDto,
    lm: ReturnType<TestsService["listeningMediaForUpsert"]>
  ) {
    await this.prisma.listeningAudioTrack.deleteMany({ where: { testId } });
    if (dto.type !== TestType.LISTENING || !lm.trackCreates?.length) {
      return;
    }
    await this.prisma.listeningAudioTrack.createMany({
      data: lm.trackCreates.map((track) => ({
        testId,
        sortOrder: track.sortOrder,
        label: track.label,
        assetId: track.assetId
      }))
    });
  }

  /** Upsert questions by stable id (preferred) or sequence; remove orphans safely. */
  private async syncTestQuestions(testId: string, questions: UpsertQuestionDto[]) {
    const existing = await this.prisma.question.findMany({
      where: { testId },
      select: { id: true, sequence: true }
    });

    const existingById = new Map(existing.map((row) => [row.id, row]));
    const existingBySequence = new Map(existing.map((row) => [row.sequence, row]));
    const keptIds = new Set<string>();

    for (const question of questions) {
      const data = this.questionDataFromDto(question);
      const questionId = question.id?.trim();
      const matchedById = questionId ? existingById.get(questionId) : undefined;
      const matchedBySequence = existingBySequence.get(question.sequence);
      const target = matchedById ?? matchedBySequence;

      if (target) {
        keptIds.add(target.id);
        await this.prisma.question.update({
          where: { id: target.id },
          data: {
            ...data,
            sequence: question.sequence
          }
        });
        continue;
      }

      const created = await this.prisma.question.create({
        data: {
          testId,
          sequence: question.sequence,
          ...data
        }
      });
      keptIds.add(created.id);
    }

    const removeIds = existing.filter((row) => !keptIds.has(row.id)).map((row) => row.id);
    if (removeIds.length === 0) {
      return;
    }

    await this.prisma.attemptAnswer.deleteMany({
      where: { questionId: { in: removeIds } }
    });
    await this.prisma.question.deleteMany({
      where: { id: { in: removeIds } }
    });
  }

  private async getLinkedPastPaperSummary(testId: string) {
    const row = await this.prisma.pastPaper.findFirst({
      where: { OR: [{ listeningTestId: testId }, { readingTestId: testId }] },
      include: {
        listeningTest: { select: { id: true, title: true, type: true, isPublished: true } },
        readingTest: { select: { id: true, title: true, type: true, isPublished: true } }
      }
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      isPublished: row.isPublished,
      listeningTest: row.listeningTest,
      readingTest: row.readingTest
    };
  }

  private async ensureTestExists(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!test) {
      throw new NotFoundException("Test not found");
    }
  }

  /**
   * Skills the user is entitled to via standalone products (+ an active Complete
   * Course subscription = all skills). Additive to the plan-based gating.
   */
  private async getOwnedSkills(userId: string): Promise<Set<string>> {
    const now = new Date();
    const skills = new Set<string>();
    const entitlements = await this.prisma.entitlement.findMany({
      where: { userId, status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: now } }] },
      include: { product: { select: { includedSkills: true } } }
    });
    for (const e of entitlements) for (const s of e.product?.includedSkills ?? []) skills.add(s);
    const completeSub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }, plan: { tier: { not: PlanTier.STARTER } } }
    });
    if (completeSub?.otpVerifiedAt && completeSub.endDate && completeSub.endDate > now) {
      for (const s of ["READING", "LISTENING", "WRITING", "SPEAKING"]) skills.add(s);
    }
    return skills;
  }

  /**
   * The user's effective past-paper COUNT allowance for one skill = the largest
   * of every owned single-skill tier's `pastPaperLimit` for that skill and the
   * active Complete-Course plan's `pastPaperLimit`. Mirrors the per-skill limit
   * the portal renders, so the count cap is enforced consistently. (Tiers:
   * Foundation 1 · Momentum 3 · Precision 5 · Mega 10; Complete plans 2/4/10/10.)
   */
  private async getSkillPastPaperLimit(userId: string, skill: string): Promise<number> {
    const now = new Date();
    let limit = 0;
    const entitlements = await this.prisma.entitlement.findMany({
      where: { userId, status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: now } }] },
      include: { product: { select: { includedSkills: true, pastPaperLimit: true } } }
    });
    for (const e of entitlements) {
      if ((e.product?.includedSkills ?? []).includes(skill)) {
        limit = Math.max(limit, e.product?.pastPaperLimit ?? 0);
      }
    }
    const completeSub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }, plan: { tier: { not: PlanTier.STARTER } } },
      include: { plan: { select: { pastPaperLimit: true } } }
    });
    if (completeSub?.otpVerifiedAt && completeSub.endDate && completeSub.endDate > now) {
      limit = Math.max(limit, completeSub.plan?.pastPaperLimit ?? 0);
    }
    return limit;
  }

  private async ensurePastPaperTestAccess(testId: string, userId: string) {
    const linkedPastPaper = await this.prisma.pastPaper.findFirst({
      where: {
        isPublished: true,
        OR: [{ listeningTestId: testId }, { readingTestId: testId }]
      },
      select: { title: true, readingTestId: true, listeningTestId: true }
    });

    if (!linkedPastPaper) {
      return;
    }

    // Entitlement path: a standalone-course owner may access that skill's past
    // paper (the course includes "OET HQ past papers" for its skill) — but only
    // up to the COUNT their tier includes (Foundation 1 … Mega 10).
    const paperSkill = linkedPastPaper.readingTestId === testId ? "READING" : "LISTENING";
    const slotNumber = parsePastPaperDayNumber(linkedPastPaper.title);
    const ownedSkills = await this.getOwnedSkills(userId);
    if (ownedSkills.has(paperSkill)) {
      const skillLimit = await this.getSkillPastPaperLimit(userId, paperSkill);
      if (slotNumber <= skillLimit) {
        return;
      }
      throw new ForbiddenException("This past paper is not included in your current plan");
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED] }
      },
      include: { plan: true }
    });
    const subscription = pickEffectiveSubscriptionForAccess(subscriptions);

    if (!subscription?.plan || subscription.plan.tier === PlanTier.STARTER) {
      throw new ForbiddenException("Past papers are not included in your current plan");
    }

    if (slotNumber > subscription.plan.pastPaperLimit) {
      throw new ForbiddenException("This past paper is not included in your current plan");
    }
  }

  private async isPastPaperOwnedReadingTest(testId: string) {
    const linked = await this.prisma.pastPaper.findFirst({
      where: { readingTestId: testId },
      select: { id: true }
    });
    if (linked) {
      return true;
    }

    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { type: true, title: true }
    });

    return Boolean(test?.type === TestType.READING && test.title && isPastPaperTestTitle(test.title));
  }

  private validateQuestions(dto: UpsertTestDto) {
    if (dto.questions.length !== dto.totalQuestions) {
      throw new BadRequestException("Question count must match totalQuestions");
    }
    if (dto.type === TestType.READING && (!dto.partATimer || !dto.partBCTimer)) {
      throw new BadRequestException("Reading tests require partATimer and partBCTimer");
    }
    if (dto.type === TestType.LISTENING && dto.partAQuestionHeadingGroups) {
      validateListeningPartAQuestionHeadingGroups(dto.partAQuestionHeadingGroups);
    }
  }

  private listeningMediaForUpsert(dto: UpsertTestDto): {
    audioAssetId: string | null;
    trackCreates?: Array<{ sortOrder: number; label: string | null; assetId: string }>;
  } {
    if (dto.type !== TestType.LISTENING) {
      return { audioAssetId: null };
    }

    if (dto.audioAssetId?.trim()) {
      return { audioAssetId: dto.audioAssetId.trim() };
    }

    const raw = dto.listeningTracks?.filter((t) => t.assetId?.trim()) ?? [];
    if (raw.length > 0) {
      const sorted = [...raw].sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        audioAssetId: null,
        trackCreates: sorted.map((t) => ({
          sortOrder: t.sortOrder,
          label: t.label ?? null,
          assetId: t.assetId
        }))
      };
    }

    return { audioAssetId: null };
  }

  private async getOwnedInProgressAttempt(attemptId: string, userId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: testAttemptInclude
    });
    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }
    if (attempt.userId !== userId) {
      throw new ForbiddenException("Attempt access denied");
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException("Attempt is already completed");
    }
    return attempt;
  }

  /** Part A timer ended but section not yet moved — last chance to persist Part A answers. */
  private shouldCaptureFinalPartASnapshot(attempt: AttemptWithContext) {
    return (
      attempt.test.type === TestType.READING &&
      attempt.section === AttemptSection.READING_PART_A &&
      isReadingPartAExpired(attempt.startedAt, attempt.test.partATimer)
    );
  }

  /**
   * When Reading Part A's wall-clock window ends, persist the BC section transition
   * so clients cannot keep working in Part A after a refresh.
   */
  private async ensureReadingPartAClosed(attempt: AttemptWithContext): Promise<AttemptWithContext> {
    if (!this.shouldCaptureFinalPartASnapshot(attempt)) return attempt;

    const firstNonPartAIndex = attempt.test.questions.findIndex((question) => question.part !== "A");
    const sectionExpiresAt = getReadingPartBCDeadline(
      attempt.startedAt,
      attempt.test.partATimer,
      attempt.test.partBCTimer
    );
    const currentQuestionIndex =
      firstNonPartAIndex >= 0 ? firstNonPartAIndex : attempt.currentQuestionIndex;

    return this.prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        section: AttemptSection.READING_PART_BC,
        sectionExpiresAt,
        currentQuestionIndex
      },
      include: testAttemptInclude
    });
  }

  /** Strip Part A answer mutations and force BC section once Part A time has expired. */
  private applyReadingPartALockToProgress(
    attempt: AttemptWithContext,
    dto: Pick<SaveAttemptProgressDto, "answers" | "section" | "currentQuestionIndex">
  ) {
    const partALocked =
      attempt.test.type === TestType.READING &&
      (attempt.section === AttemptSection.READING_PART_BC ||
        isReadingPartAExpired(attempt.startedAt, attempt.test.partATimer));

    if (!partALocked) {
      return {
        answers: dto.answers,
        answersJson: this.asAnswerJson(dto.answers),
        section: dto.section,
        currentQuestionIndex: dto.currentQuestionIndex,
        sectionExpiresAt: attempt.sectionExpiresAt
      };
    }

    const partAQuestionIds = new Set(
      attempt.test.questions.filter((question) => question.part === "A").map((question) => question.id)
    );
    const existingAnswers =
      attempt.answersJson && typeof attempt.answersJson === "object" && !Array.isArray(attempt.answersJson)
        ? (attempt.answersJson as Record<string, string>)
        : {};

    const writableAnswers = dto.answers.filter((answer) => !partAQuestionIds.has(answer.questionId));
    const answersJson: Record<string, string> = { ...existingAnswers };
    for (const answer of writableAnswers) {
      answersJson[answer.questionId] = answer.response;
    }
    // Freeze Part A — restore whatever was already saved, never accept late changes.
    for (const questionId of partAQuestionIds) {
      if (existingAnswers[questionId] !== undefined) {
        answersJson[questionId] = existingAnswers[questionId];
      } else {
        delete answersJson[questionId];
      }
    }

    const firstNonPartAIndex = attempt.test.questions.findIndex((question) => question.part !== "A");
    const currentPart = attempt.test.questions[dto.currentQuestionIndex]?.part;
    const currentQuestionIndex =
      currentPart === "A" && firstNonPartAIndex >= 0 ? firstNonPartAIndex : dto.currentQuestionIndex;

    return {
      answers: writableAnswers,
      answersJson,
      section: AttemptSection.READING_PART_BC,
      currentQuestionIndex,
      // Preserve an early-finish B & C deadline; only fall back to the absolute schedule.
      sectionExpiresAt:
        attempt.sectionExpiresAt ??
        getReadingPartBCDeadline(attempt.startedAt, attempt.test.partATimer, attempt.test.partBCTimer)
    };
  }

  private async persistAnswers(
    attemptId: string,
    answers: { questionId: string; response: string }[],
    questions: TestWithQuestions["questions"]
  ) {
    const validQuestionIds = new Set(questions.map((question) => question.id));
    const operations = answers.map((answer) => {
      if (!validQuestionIds.has(answer.questionId)) {
        throw new BadRequestException(`Question ${answer.questionId} does not belong to this test`);
      }

      const question = questions.find((item) => item.id === answer.questionId);
      const normalizedResponse = answer.response.trim();
      const isCorrect =
        question?.correctAnswer.trim().toLowerCase() === normalizedResponse.toLowerCase();

      return this.prisma.attemptAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: answer.questionId
          }
        },
        create: {
          attemptId,
          questionId: answer.questionId,
          response: normalizedResponse,
          isCorrect
        },
        update: {
          response: normalizedResponse,
          isCorrect
        }
      });
    });

    await this.prisma.$transaction(operations);
  }

  private asAnswerJson(answers: { questionId: string; response: string }[]) {
    return answers.reduce<Record<string, string>>((accumulator, answer) => {
      accumulator[answer.questionId] = answer.response;
      return accumulator;
    }, {});
  }

  private async serializeAttempt(attempt: AttemptWithContext, role: Role) {
    const test = await this.serializeTest(attempt.test, role === Role.ADMIN);

    return {
      id: attempt.id,
      userId: attempt.userId,
      testId: attempt.testId,
      status: attempt.status,
      section: attempt.section,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      sectionExpiresAt: attempt.sectionExpiresAt,
      submittedAt: attempt.submittedAt,
      autoSubmittedAt: attempt.autoSubmittedAt,
      currentQuestionIndex: attempt.currentQuestionIndex,
      questionCountAnswered: attempt.questionCountAnswered,
      timeRemainingSeconds: attempt.timeRemainingSeconds,
      audioPositionSeconds: attempt.audioPositionSeconds,
      audioCompleted: attempt.audioCompleted,
      currentListeningTrackIndex: attempt.currentListeningTrackIndex,
      listeningFinalCountdownEndsAt: attempt.listeningFinalCountdownEndsAt?.toISOString() ?? null,
      countdownStartedAt: attempt.countdownStartedAt,
      answersJson: attempt.answersJson,
      score: attempt.score,
      partAScore: attempt.partAScore,
      partBScore: attempt.partBScore,
      partCScore: attempt.partCScore,
      bandLabel: attempt.bandLabel,
      passProbability: attempt.passProbability,
      updatedAt: attempt.updatedAt,
      test
    };
  }

  private async serializeTest(test: TestWithQuestions, includeAnswers: boolean) {
    const [audioAsset, bookletAsset, partBBookletAsset, partCBookletAsset] = await Promise.all([
      test.audioAssetId ? this.storageService.getSignedAsset(test.audioAssetId) : Promise.resolve(null),
      test.bookletAssetId ? this.storageService.getSignedAsset(test.bookletAssetId) : Promise.resolve(null),
      test.partBBookletAssetId ? this.storageService.getSignedAsset(test.partBBookletAssetId) : Promise.resolve(null),
      test.partCBookletAssetId ? this.storageService.getSignedAsset(test.partCBookletAssetId) : Promise.resolve(null)
    ]);

    const trackSources =
      test.listeningTracks && test.listeningTracks.length > 0
        ? test.listeningTracks.map((t) => ({
            id: t.id,
            sortOrder: t.sortOrder,
            label: t.label,
            assetId: t.assetId
          }))
        : test.type === TestType.LISTENING && test.audioAssetId
          ? [
              {
                id: "legacy",
                sortOrder: 0,
                label: "Listening session",
                assetId: test.audioAssetId
              }
            ]
          : [];

    const listeningTracks = await Promise.all(
      trackSources.map(async (t) => {
        const asset = await this.storageService.getSignedAsset(t.assetId);
        return {
          id: t.id,
          sortOrder: t.sortOrder,
          label: t.label,
          asset
        };
      })
    );

    return {
      id: test.id,
      type: test.type,
      title: test.title,
      description: test.description,
      instructions: test.instructions,
      partASubInstructions: test.partASubInstructions,
      partBSubInstructions: test.partBSubInstructions,
      partCSubInstructions: test.partCSubInstructions,
      partABookletHtml: test.partABookletHtml,
      partBBookletHtml: test.partBBookletHtml,
      partBExtractBooklets: test.partBExtractBooklets as Record<string, string> | null,
      partAExtractQuestionHeadings: test.partAExtractQuestionHeadings as Record<string, string> | null,
      partAQuestionHeadingGroups: test.partAQuestionHeadingGroups as Record<
        string,
        Array<{ id: string; heading: string; questionSequences: number[] }>
      > | null,
      partCExtractQuestionHeadings: test.partCExtractQuestionHeadings as Record<string, string> | null,
      partCBookletHtml: test.partCBookletHtml,
      partCExtractBooklets: test.partCExtractBooklets as Record<string, string> | null,
      totalQuestions: test.totalQuestions,
      timerDuration: test.timerDuration,
      partATimer: test.partATimer,
      partBCTimer: test.partBCTimer,
      isPublished: test.isPublished,
      audioAsset,
      bookletAsset,
      partBBookletAsset,
      partCBookletAsset,
      listeningTracks,
      questions: test.questions.map((question) => ({
        id: question.id,
        sequence: question.sequence,
        part: question.part,
        extractId: question.extractId,
        type: question.type,
        content: question.content,
        options: question.options,
        explanation: question.explanation,
        points: question.points,
        ...(includeAnswers
          ? {
              correctAnswer: question.correctAnswer
            }
          : {})
      }))
    };
  }

  private startOfDay() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
