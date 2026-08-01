/**
 * accountability.router.ts — daily student accountability.
 *   Candidate: POST /activity/mark { kind }   (self-mark lecture/spelling/article/podcast)
 *   Admin:     GET  /admin/accountability?day=<dayKey>
 *              GET  /admin/accountability/student/:userId   (full history)
 *              POST /admin/accountability/warn        { userId }
 *              POST /admin/accountability/warn-bulk   { userIds: [] }
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import { isMarkable } from "../../modules/accountability/accountability.service";

export function createAccountabilityRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.accountabilityService;

  // ---- Candidate: self-mark an activity done today ----
  r.post("/activity/mark", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    const kind = String(req.body?.kind ?? "");
    if (!isMarkable(kind)) { res.status(400).json({ message: "Unknown activity kind" }); return; }
    res.json(await svc.markActivity(u.id, kind));
  }));

  // ---- Admin: roster + warnings ----
  r.get("/admin/accountability", auth, admin, asyncHandler(async (req, res) => {
    const dayRaw = req.query.day;
    const day = dayRaw !== undefined && String(dayRaw).trim() !== "" ? Number(dayRaw) : svc.todayKey();
    if (!Number.isFinite(day)) { res.status(400).json({ message: "Invalid day" }); return; }
    res.json(await svc.roster(Math.floor(day)));
  }));

  // Full history for one student, regardless of what they bought.
  r.get("/admin/accountability/student/:userId", auth, admin, asyncHandler(async (req, res) => {
    const userId = String(req.params.userId ?? "").trim();
    if (!userId) { res.status(400).json({ message: "userId required" }); return; }
    res.json(await svc.studentHistory(userId));
  }));

  r.post("/admin/accountability/warn", auth, admin, asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId ?? "");
    if (!userId) { res.status(400).json({ message: "userId required" }); return; }
    const day = req.body?.day !== undefined ? Math.floor(Number(req.body.day)) : undefined;
    res.json(await svc.warn(userId, day));
  }));

  r.post("/admin/accountability/warn-bulk", auth, admin, asyncHandler(async (req, res) => {
    const userIds = Array.isArray(req.body?.userIds) ? (req.body.userIds as string[]) : [];
    const day = req.body?.day !== undefined ? Math.floor(Number(req.body.day)) : undefined;
    res.json(await svc.warnBulk(userIds, day));
  }));

  return r;
}
