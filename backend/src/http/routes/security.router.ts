/**
 * security.router.ts — exam-integrity screenshot strikes + admin suspension mgmt.
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";

export function createSecurityRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.securityService;

  // Candidate: report a screenshot attempt during a test.
  r.post("/security/screenshot-strike", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    const context = typeof req.body?.context === "string" ? req.body.context.slice(0, 120) : undefined;
    res.json(await svc.recordScreenshotStrike(u.id, context));
  }));

  // Admin: suspended-account management.
  r.get("/security/suspended", auth, admin, asyncHandler(async (_req, res) => {
    res.json(await svc.listSuspended());
  }));

  r.post("/security/users/:id/reinstate", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.reinstate(String(req.params.id)));
  }));

  r.post("/security/users/:id/suspend", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.suspend(String(req.params.id), typeof req.body?.reason === "string" ? req.body.reason : undefined));
  }));

  return r;
}
