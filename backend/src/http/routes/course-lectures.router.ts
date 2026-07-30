/**
 * course-lectures.router.ts — per-skill lecture library.
 * Candidate: list (with lock flags) + enforced playback. Admin: CRUD.
 */
import { Router } from "express";
import { Skill } from "@prisma/client";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";

const SKILLS = new Set<string>(Object.values(Skill));

function parseSkill(raw: unknown): Skill {
  if (typeof raw === "string" && SKILLS.has(raw)) return raw as Skill;
  throw Object.assign(new Error("skill must be READING, LISTENING, WRITING or SPEAKING"), { statusCode: 400 });
}

function optionalStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return String(v);
}

export function createCourseLecturesRouter(c: AppContainer): Router {
  const router = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.courseLecturesService;

  // ---- candidate ----
  router.get("/course-lectures", auth, asyncHandler(async (req, res) => {
    res.json(await svc.listForUser((req as AuthedRequest).user.id));
  }));

  router.get("/course-lectures/:id/playback", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getPlayback((req as AuthedRequest).user.id, String(req.params.id)));
  }));

  // Course tests for a skill (READING | LISTENING).
  router.get("/course-tests", auth, asyncHandler(async (req, res) => {
    const raw = String(req.query.skill ?? "").toUpperCase();
    if (raw !== "READING" && raw !== "LISTENING") {
      throw Object.assign(new Error("skill must be READING or LISTENING"), { statusCode: 400 });
    }
    res.json(await svc.listCourseTests((req as AuthedRequest).user.id, raw));
  }));

  // ---- admin ----
  router.get("/course-lectures/admin", auth, admin, asyncHandler(async (_req, res) => {
    res.json({ lectures: await svc.listAll() });
  }));

  router.post("/course-lectures", auth, admin, asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    if (!b.title || String(b.title).trim() === "") {
      throw Object.assign(new Error("title is required"), { statusCode: 400 });
    }
    res.json(await svc.create({
      skill: parseSkill(b.skill),
      title: String(b.title).trim(),
      description: optionalStr(b.description) ?? null,
      displayOrder: Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 0,
      bunnyVideoId: optionalStr(b.bunnyVideoId) ?? null,
      videoUrl: optionalStr(b.videoUrl) ?? null,
      durationMin: b.durationMin != null && b.durationMin !== "" ? Number(b.durationMin) : null,
      isPublished: Boolean(b.isPublished)
    }));
  }));

  router.patch("/course-lectures/:id", auth, admin, asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (b.skill !== undefined) data.skill = parseSkill(b.skill);
    if (b.title !== undefined) data.title = String(b.title).trim();
    if (b.description !== undefined) data.description = optionalStr(b.description);
    if (b.displayOrder !== undefined) data.displayOrder = Number(b.displayOrder) || 0;
    if (b.bunnyVideoId !== undefined) data.bunnyVideoId = optionalStr(b.bunnyVideoId);
    if (b.videoUrl !== undefined) data.videoUrl = optionalStr(b.videoUrl);
    if (b.durationMin !== undefined) data.durationMin = b.durationMin === "" || b.durationMin == null ? null : Number(b.durationMin);
    if (b.isPublished !== undefined) data.isPublished = Boolean(b.isPublished);
    res.json(await svc.update(String(req.params.id), data));
  }));

  router.delete("/course-lectures/:id", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.remove(String(req.params.id)));
  }));

  return router;
}
