import { Router, type Request, type Response } from "express";
import { SubscriptionStatus } from "@prisma/client";
import { UpsertDailyTaskDto } from "../../modules/tasks/dto/upsert-daily-task.dto";
import { buildTaskLocks } from "../../modules/tasks/task-access.utils";
import { pickEffectiveSubscriptionForAccess } from "../../modules/subscriptions/subscription-access.utils";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import { validateDto } from "../validation";

export function createTasksRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();

  r.get(
    "/tasks",
    auth,
    asyncHandler(async (_req, res) => {
      res.json(await c.tasksService.listAll());
    })
  );

  r.get(
    "/tasks/for-user",
    auth,
    asyncHandler(async (req, res) => {
      const userId = String(req.query.userId || "");
      if (!userId) {
        res.status(400).json({ message: "userId query required" });
        return;
      }
      res.json(await c.tasksService.listForUser(userId));
    })
  );

  r.post(
    "/tasks/ensure-template",
    auth,
    asyncHandler(async (_req, res) => {
      res.json(await c.tasksService.ensureFortyDayTemplate());
    })
  );

  r.get(
    "/tasks/:dayNumber/embed",
    auth,
    asyncHandler((req, res) => getTaskEmbed(c, req, res))
  );

  r.put(
    "/tasks/:dayNumber",
    auth,
    asyncHandler(async (req, res) => {
      const dayNumber = Number(req.params.dayNumber);
      if (Number.isNaN(dayNumber)) {
        res.status(400).json({ message: "Invalid dayNumber" });
        return;
      }
      const dto = await validateDto(UpsertDailyTaskDto, req.body);
      res.json(await c.tasksService.upsert(dayNumber, dto));
    })
  );

  // Add a new day at the end (draft — hidden until published).
  r.post(
    "/tasks/add",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.status(201).json(await c.tasksService.addDay());
    })
  );

  // Remove a day entirely.
  r.delete(
    "/tasks/:dayNumber",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dayNumber = Number(req.params.dayNumber);
      if (Number.isNaN(dayNumber)) {
        res.status(400).json({ message: "Invalid dayNumber" });
        return;
      }
      res.json(await c.tasksService.remove(dayNumber));
    })
  );

  return r;
}

export async function getTaskEmbed(c: AppContainer, req: Request, res: Response) {
  const slot = req.query.slot;
  if (slot !== "lecture" && slot !== "coreskill") {
    res.status(400).json({ error: "slot must be lecture or coreskill" });
    return;
  }

  const dayNumber = Number(req.params.dayNumber);
  if (!Number.isInteger(dayNumber)) {
    res.status(400).json({ error: "Invalid dayNumber" });
    return;
  }

  const userId = (req as AuthedRequest).user.id;
  const subscriptions = await c.prisma.subscription.findMany({
    where: {
      userId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED] }
    },
    include: { plan: true }
  });
  const subscription = pickEffectiveSubscriptionForAccess(subscriptions);
  if (!subscription || (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.TRIAL)) {
    res.status(403).json({ error: "No active subscription" });
    return;
  }

  const locks = buildTaskLocks({
    planTier: subscription.plan.tier,
    dayIndex: dayNumber,
    readingLimit: subscription.plan.readingLimit,
    listeningLimit: subscription.plan.listeningLimit,
    pastPaperLimit: subscription.plan.pastPaperLimit,
    hasReadingTest: false,
    hasListeningTest: false,
    hasPastPaper: false
  });

  if (slot === "coreskill" && locks.coreSkillsLocked) {
    res.status(403).json({ error: "Core skills video not included in your plan" });
    return;
  }

  if (slot === "lecture" && locks.lectureLocked) {
    res.status(403).json({ error: "Lecture video not included in your plan" });
    return;
  }

  const task = await c.prisma.dailyTask.findUnique({
    where: { dayNumber },
    select: { lectureBunnyVideoId: true, articleBunnyVideoId: true }
  });
  const videoId = slot === "lecture" ? task?.lectureBunnyVideoId : task?.articleBunnyVideoId;
  if (!videoId?.trim()) {
    res.status(404).json({ error: "No video for this lesson" });
    return;
  }

  if (!c.bunnyPlaybackService.isConfigured()) {
    res.status(503).json({ error: "Video provider not configured" });
    return;
  }

  const { url: embedUrl, expiresAt } = c.bunnyPlaybackService.buildEmbedUrl(videoId);
  res.set("Cache-Control", "private, no-store").json({ provider: "bunny", embedUrl, expiresAt });
}
