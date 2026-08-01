import { ForbiddenException } from "../../common/http-exception";
import { SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { StorageService } from "../storage/storage.service";
import { pickEffectiveSubscriptionForAccess } from "../subscriptions/subscription-access.utils";
import { buildTaskLocks } from "./task-access.utils";
import { UpsertDailyTaskDto } from "./dto/upsert-daily-task.dto";

function formatTaskDayTitle(dayNumber: number) {
  return `Task day ${dayNumber}`;
}

function normalizeAssetId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async listAll() {
    const tasks = await this.prisma.dailyTask.findMany({
      include: {
        assignedReadingTest: true,
        assignedListeningTest: true,
        assignedPastPaper: {
          include: {
            listeningTest: true,
            readingTest: true
          }
        },
        assignedPastPaperTest: true
      },
      orderBy: { dayNumber: "asc" }
    });

    return Promise.all(tasks.map((task) => this.serializeTask(task)));
  }

  async upsert(dayNumber: number, dto: UpsertDailyTaskDto) {
    const existing = await this.prisma.dailyTask.findUnique({
      where: { dayNumber },
      select: {
        lectureAssetId: true,
        lectureThumbnailAssetId: true,
        articleAssetId: true,
        articleThumbnailAssetId: true,
        articlePdfAssetId: true,
        pastPaperAssetId: true,
        cheatSheetAssetId: true
      }
    });

    const lectureAssetId = normalizeAssetId(dto.lectureAssetId);
    const lectureThumbnailAssetId = normalizeAssetId(dto.lectureThumbnailAssetId);
    const articleAssetId = normalizeAssetId(dto.articleAssetId);
    const articleThumbnailAssetId = normalizeAssetId(dto.articleThumbnailAssetId);
    const articlePdfAssetId = normalizeAssetId(dto.articlePdfAssetId);
    const pastPaperAssetId = normalizeAssetId(dto.pastPaperAssetId);
    const cheatSheetAssetId = normalizeAssetId(dto.cheatSheetAssetId);

    const { lectureUrl, articleUrl } = await this.resolveContentUrls({
      ...dto,
      lectureAssetId: lectureAssetId ?? undefined,
      articleAssetId: articleAssetId ?? undefined
    });
    const title = formatTaskDayTitle(dayNumber);

    const task = await this.prisma.dailyTask.upsert({
      where: { dayNumber },
      create: {
        dayNumber,
        title,
        summary: dto.summary,
        lectureTitle: dto.lectureTitle,
        lectureUrl,
        lectureAssetId,
        lectureThumbnailAssetId,
        articleTitle: dto.articleTitle,
        articleUrl,
        articleContent: dto.articleContent,
        articleAssetId,
        articleThumbnailAssetId,
        articlePdfAssetId,
        assignedReadingTestId: dto.assignedReadingTestId,
        assignedListeningTestId: dto.assignedListeningTestId,
        assignedPastPaperId: dto.assignedPastPaperId,
        assignedPastPaperTestId: dto.assignedPastPaperTestId,
        pastPaperTitle: dto.pastPaperTitle,
        pastPaperUrl: dto.pastPaperUrl,
        pastPaperAssetId,
        cheatSheetAssetId,
        isPublished: dto.isPublished ?? true
      },
      update: {
        title,
        summary: dto.summary,
        lectureTitle: dto.lectureTitle,
        lectureUrl,
        lectureAssetId,
        lectureThumbnailAssetId,
        articleTitle: dto.articleTitle,
        articleUrl,
        articleContent: dto.articleContent,
        articleAssetId,
        articleThumbnailAssetId,
        articlePdfAssetId,
        assignedReadingTestId: dto.assignedReadingTestId,
        assignedListeningTestId: dto.assignedListeningTestId,
        assignedPastPaperId: dto.assignedPastPaperId,
        assignedPastPaperTestId: dto.assignedPastPaperTestId,
        pastPaperTitle: dto.pastPaperTitle,
        pastPaperUrl: dto.pastPaperUrl,
        pastPaperAssetId,
        cheatSheetAssetId,
        isPublished: dto.isPublished ?? true
      },
      include: {
        assignedReadingTest: true,
        assignedListeningTest: true,
        assignedPastPaper: {
          include: {
            listeningTest: true,
            readingTest: true
          }
        },
        assignedPastPaperTest: true
      }
    });

    if (existing) {
      const staleAssetIds = [
        existing.lectureAssetId !== lectureAssetId ? existing.lectureAssetId : null,
        existing.lectureThumbnailAssetId !== lectureThumbnailAssetId ? existing.lectureThumbnailAssetId : null,
        existing.articleAssetId !== articleAssetId ? existing.articleAssetId : null,
        existing.articleThumbnailAssetId !== articleThumbnailAssetId ? existing.articleThumbnailAssetId : null,
        existing.articlePdfAssetId !== articlePdfAssetId ? existing.articlePdfAssetId : null,
        existing.pastPaperAssetId !== pastPaperAssetId ? existing.pastPaperAssetId : null,
        existing.cheatSheetAssetId !== cheatSheetAssetId ? existing.cheatSheetAssetId : null
      ].filter((id): id is string => Boolean(id));

      await Promise.all(
        staleAssetIds.map((id) => this.storageService.deleteStorageObjectIfUnused(id))
      );
    }

    return this.serializeTask(task);
  }

  async listForUser(userId: string) {
    const now = new Date();
    const [subscriptions, courseEntitlements] = await Promise.all([
      this.prisma.subscription.findMany({
        where: {
          userId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED] }
        },
        include: { plan: true }
      }),
      // Every single-skill tier advertises the scheduled cohort lectures, and a
      // course is granted as an ENTITLEMENT with no subscription behind it. Without
      // this, those buyers had the whole plan locked and only kept the lectures for
      // as long as the signup free-trial row happened to survive.
      this.prisma.entitlement.count({
        where: { userId, status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: now } }] }
      })
    ]);
    const subscription = pickEffectiveSubscriptionForAccess(subscriptions);
    const ownsACourse = courseEntitlements > 0;

    const tasks = await this.prisma.dailyTask.findMany({
      where: { isPublished: true },
      include: {
        assignedReadingTest: true,
        assignedListeningTest: true,
        assignedPastPaper: {
          include: {
            listeningTest: true,
            readingTest: true
          }
        },
        assignedPastPaperTest: true
      },
      orderBy: { dayNumber: "asc" }
    });

    if (!subscription?.plan) {
      // A course buyer with no Complete plan still gets the cohort LECTURES their
      // tier was sold. Tests, past papers, articles and cheat sheets stay locked
      // here — those are served by their own course pages, gated by tier.
      return Promise.all(
        tasks.map(async (task) => ({
          ...(await this.serializeTask(task)),
          readingLocked: true,
          listeningLocked: true,
          pastPaperLocked: true,
          lectureLocked: !ownsACourse,
          coreSkillsLocked: true,
          articleLocked: true,
          cheatSheetLocked: true
        }))
      );
    }

    return Promise.all(
      tasks.map(async (task) => {
        const dayIndex = task.dayNumber;
        const locks = buildTaskLocks({
          planTier: subscription.plan.tier,
          dayIndex,
          readingLimit: subscription.plan.readingLimit,
          listeningLimit: subscription.plan.listeningLimit,
          pastPaperLimit: subscription.plan.pastPaperLimit,
          hasReadingTest: Boolean(task.assignedReadingTestId),
          hasListeningTest: Boolean(task.assignedListeningTestId),
          hasPastPaper: Boolean(task.assignedPastPaperId || task.assignedPastPaperTestId)
        });

        const serialized = await this.serializeTask(task);

        return {
          ...serialized,
          ...locks,
          ...(locks.coreSkillsLocked
            ? {
                articleUrl: "",
                articleAsset: null,
                articleBunnyVideoId: null
              }
            : {}),
          ...(locks.articleLocked
            ? {
                articlePdfAsset: null,
                articleContent: null
              }
            : {})
        };
      })
    );
  }

  ensureUserCanReadTasks(currentUser: { userId: string; role: string }, requestedUserId: string) {
    if (currentUser.role !== "ADMIN" && currentUser.userId !== requestedUserId) {
      throw new ForbiddenException("Task access denied");
    }
  }

  /**
   * First-run seed only. Once any days exist, this is a no-op so admins can
   * freely add/remove days without deleted days being resurrected.
   */
  async ensureFortyDayTemplate() {
    const existing = await this.prisma.dailyTask.count();
    if (existing > 0) return this.listAll();

    for (let dayNumber = 1; dayNumber <= 40; dayNumber += 1) {
      await this.prisma.dailyTask.create({
        data: {
          dayNumber,
          title: formatTaskDayTitle(dayNumber),
          lectureTitle: `Lecture ${dayNumber}`,
          lectureUrl: "",
          articleTitle: `Core skills ${dayNumber}`,
          articleUrl: "",
          isPublished: true
        }
      });
    }
    return this.listAll();
  }

  /** Add a new day at the end (max dayNumber + 1) as a DRAFT (hidden until published). */
  async addDay() {
    const max = await this.prisma.dailyTask.aggregate({ _max: { dayNumber: true } });
    const dayNumber = (max._max.dayNumber ?? 0) + 1;
    await this.prisma.dailyTask.create({
      data: {
        dayNumber,
        title: formatTaskDayTitle(dayNumber),
        lectureTitle: `Lecture ${dayNumber}`,
        lectureUrl: "",
        articleTitle: `Core skills ${dayNumber}`,
        articleUrl: "",
        isPublished: false
      }
    });
    return this.listAll();
  }

  /** Remove a day entirely (front end shows only existing published days). Cleans
   *  the cohort records that key off this dayNumber so nothing stale lingers. */
  async remove(dayNumber: number) {
    const day = await this.prisma.dailyTask.findUnique({ where: { dayNumber } });
    if (!day) throw Object.assign(new Error("Day not found"), { statusCode: 404 });
    await this.prisma.$transaction([
      this.prisma.cohortChatMessage.deleteMany({ where: { dayNumber } }),
      this.prisma.cohortSessionRecord.deleteMany({ where: { dayNumber } }),
      this.prisma.cohortDayProgress.deleteMany({ where: { dayNumber } }),
      this.prisma.dailyTask.delete({ where: { dayNumber } })
    ]);
    return this.listAll();
  }

  private async resolveContentUrls(dto: UpsertDailyTaskDto) {
    let lectureUrl = dto.lectureUrl?.trim() || "";
    let articleUrl = dto.articleUrl?.trim() || "";

    if (dto.lectureAssetId) {
      const asset = await this.storageService.getSignedAsset(dto.lectureAssetId);
      if (asset) {
        lectureUrl = asset.publicUrl;
      }
    }

    if (dto.articleAssetId) {
      const asset = await this.storageService.getSignedAsset(dto.articleAssetId);
      if (asset) {
        articleUrl = asset.publicUrl;
      }
    }

    return { lectureUrl, articleUrl };
  }

  private async serializeTask(task: {
    id: string;
    dayNumber: number;
    title: string;
    summary: string | null;
    lectureTitle: string;
    lectureUrl: string;
    lectureAssetId: string | null;
    lectureThumbnailAssetId: string | null;
    lectureBunnyVideoId: string | null;
    articleTitle: string;
    articleUrl: string;
    articleContent: string | null;
    articleAssetId: string | null;
    articleThumbnailAssetId: string | null;
    articleBunnyVideoId: string | null;
    articlePdfAssetId: string | null;
    assignedReadingTestId: string | null;
    assignedListeningTestId: string | null;
    assignedPastPaperId: string | null;
    assignedPastPaperTestId: string | null;
    pastPaperTitle: string | null;
    pastPaperUrl: string | null;
    pastPaperAssetId: string | null;
    cheatSheetAssetId: string | null;
    isPublished: boolean;
    assignedReadingTest?: { id: string; title: string; type: string } | null;
    assignedListeningTest?: { id: string; title: string; type: string } | null;
    assignedPastPaper?: {
      id: string;
      title: string;
      listeningTest: { id: string; title: string; type: string };
      readingTest: { id: string; title: string; type: string };
    } | null;
    assignedPastPaperTest?: { id: string; title: string; type: string } | null;
  }) {
    const [
      lectureAsset,
      lectureThumbnailAsset,
      articleAsset,
      articleThumbnailAsset,
      articlePdfAsset,
      pastPaperAsset,
      cheatSheetAsset
    ] = await Promise.all([
      task.lectureAssetId ? this.storageService.getSignedAsset(task.lectureAssetId) : Promise.resolve(null),
      task.lectureThumbnailAssetId
        ? this.storageService.getSignedAsset(task.lectureThumbnailAssetId)
        : Promise.resolve(null),
      task.articleAssetId ? this.storageService.getSignedAsset(task.articleAssetId) : Promise.resolve(null),
      task.articleThumbnailAssetId
        ? this.storageService.getSignedAsset(task.articleThumbnailAssetId)
        : Promise.resolve(null),
      task.articlePdfAssetId ? this.storageService.getSignedAsset(task.articlePdfAssetId) : Promise.resolve(null),
      task.pastPaperAssetId ? this.storageService.getSignedAsset(task.pastPaperAssetId) : Promise.resolve(null),
      task.cheatSheetAssetId ? this.storageService.getSignedAsset(task.cheatSheetAssetId) : Promise.resolve(null)
    ]);

    return {
      id: task.id,
      dayNumber: task.dayNumber,
      title: task.title,
      summary: task.summary,
      lectureTitle: task.lectureTitle,
      lectureUrl: lectureAsset?.publicUrl || lectureAsset?.signedUrl || task.lectureUrl,
      lectureAsset,
      lectureThumbnailAsset,
      lectureBunnyVideoId: task.lectureBunnyVideoId ?? null,
      articleTitle: task.articleTitle,
      articleUrl: articleAsset?.publicUrl || articleAsset?.signedUrl || task.articleUrl,
      articleContent: task.articleContent,
      articleAsset,
      articleThumbnailAsset,
      articleBunnyVideoId: task.articleBunnyVideoId ?? null,
      articlePdfAsset,
      pastPaperTitle:
        task.pastPaperTitle || task.assignedPastPaper?.title || task.assignedPastPaperTest?.title || null,
      pastPaperUrl: pastPaperAsset?.signedUrl || task.pastPaperUrl || null,
      pastPaperAsset,
      cheatSheetAsset,
      pastPaper: task.assignedPastPaper
        ? {
            id: task.assignedPastPaper.id,
            title: task.assignedPastPaper.title,
            listeningTest: {
              id: task.assignedPastPaper.listeningTest.id,
              title: task.assignedPastPaper.listeningTest.title,
              type: task.assignedPastPaper.listeningTest.type
            },
            readingTest: {
              id: task.assignedPastPaper.readingTest.id,
              title: task.assignedPastPaper.readingTest.title,
              type: task.assignedPastPaper.readingTest.type
            }
          }
        : null,
      readingTest: task.assignedReadingTest
        ? {
            id: task.assignedReadingTest.id,
            title: task.assignedReadingTest.title,
            type: task.assignedReadingTest.type
          }
        : null,
      listeningTest: task.assignedListeningTest
        ? {
            id: task.assignedListeningTest.id,
            title: task.assignedListeningTest.title,
            type: task.assignedListeningTest.type
          }
        : null,
      pastPaperTest: task.assignedPastPaperTest
        ? {
            id: task.assignedPastPaperTest.id,
            title: task.assignedPastPaperTest.title,
            type: task.assignedPastPaperTest.type
          }
        : null,
      isPublished: task.isPublished
    };
  }
}
