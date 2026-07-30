/**
 * cohort.router.ts — mirrors existing router conventions:
 * Router factory over the AppContainer, requireAuth(jwt), asyncHandler,
 * class-validator DTOs via validateDto. Mounted at root (paths /cohort/...).
 */
import { Router } from "express";
import { CohortSessionSlot } from "@prisma/client";
import type { AppContainer } from "../container";
import { asyncHandler, requireAuth, type AuthedRequest } from "../middleware";
import { validateDto } from "../validation";
import {
  ChatMessageDto, OnboardingScheduleDto, OnboardingTimezoneDto, SessionProgressDto
} from "../../modules/cohort/dto/cohort.dto";

function parseSlot(raw: string): CohortSessionSlot {
  if (raw === "LECTURE" || raw === "CORE_SKILLS") return raw;
  throw Object.assign(new Error("slot must be LECTURE or CORE_SKILLS"), { statusCode: 400 });
}

function parseDay(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 366) {
    throw Object.assign(new Error("Invalid day number"), { statusCode: 400 });
  }
  return n;
}

export function createCohortRouter(c: AppContainer): Router {
  const router = Router();
  const auth = requireAuth(c.jwtHelper);
  const svc = c.cohortService;

  router.get("/cohort/me", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getMe((req as AuthedRequest).user.id));
  }));

  router.post("/cohort/onboarding/timezone", auth, asyncHandler(async (req, res) => {
    const dto = await validateDto(OnboardingTimezoneDto, req.body);
    await svc.saveTimezone((req as AuthedRequest).user.id, dto.country, dto.timezone);
    res.json(await svc.getMe((req as AuthedRequest).user.id));
  }));

  router.post("/cohort/onboarding/schedule", auth, asyncHandler(async (req, res) => {
    const dto = await validateDto(OnboardingScheduleDto, req.body);
    await svc.saveScheduleTimes((req as AuthedRequest).user.id, dto.class1Time, dto.class2Time);
    res.json(await svc.getMe((req as AuthedRequest).user.id));
  }));

  router.get("/cohort/today", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getToday((req as AuthedRequest).user.id));
  }));

  router.get("/cohort/days", auth, asyncHandler(async (req, res) => {
    res.json({ days: await svc.getTimeline((req as AuthedRequest).user.id) });
  }));

  router.get("/cohort/days/:dayNumber", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getDay((req as AuthedRequest).user.id, parseDay(req.params.dayNumber)));
  }));

  router.post("/cohort/sessions/:dayNumber/:slot/join", auth, asyncHandler(async (req, res) => {
    res.json(await svc.joinSession(
      (req as AuthedRequest).user.id, parseDay(req.params.dayNumber), parseSlot(req.params.slot)
    ));
  }));

  router.post("/cohort/sessions/:dayNumber/:slot/progress", auth, asyncHandler(async (req, res) => {
    const dto = await validateDto(SessionProgressDto, req.body);
    res.json(await svc.recordProgress(
      (req as AuthedRequest).user.id, parseDay(req.params.dayNumber), parseSlot(req.params.slot),
      dto.positionSec, dto.activeDeltaSec, dto.mode
    ));
  }));

  router.get("/cohort/sessions/:dayNumber/:slot/chat", auth, asyncHandler(async (req, res) => {
    const after = typeof req.query.after === "string" ? req.query.after : undefined;
    res.json({
      messages: await svc.listChat(
        (req as AuthedRequest).user.id, parseDay(req.params.dayNumber), parseSlot(req.params.slot), after
      )
    });
  }));

  router.post("/cohort/sessions/:dayNumber/:slot/chat", auth, asyncHandler(async (req, res) => {
    const dto = await validateDto(ChatMessageDto, req.body);
    res.json(await svc.postChat(
      (req as AuthedRequest).user.id, parseDay(req.params.dayNumber), parseSlot(req.params.slot), dto.text
    ));
  }));

  router.get("/cohort/pending", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getPending((req as AuthedRequest).user.id));
  }));

  router.get("/cohort/attendance", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getAttendanceDashboard((req as AuthedRequest).user.id));
  }));

  router.get("/cohort/reports", auth, asyncHandler(async (req, res) => {
    res.json({ reports: await svc.listReports((req as AuthedRequest).user.id) });
  }));

  router.get("/cohort/reports/:id", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getReport((req as AuthedRequest).user.id, String(req.params.id)));
  }));

  return router;
}
