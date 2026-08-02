/**
 * devices.router.ts — device sessions and the shared-account audit.
 *
 * Mounted at the ROOT, deliberately. These routes first lived in auth.router,
 * which express mounts under /auth — so they answered on
 * /auth/admin/device-audit while the admin screen called /admin/device-audit.
 * Every one of them 404'd, and only running the server showed it.
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";

export function createDevicesRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();

  // Admin: accounts that look shared, worst first.
  r.get(
    "/admin/device-audit",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const raw = Number(req.query.minScore);
      const minScore = Number.isFinite(raw) && raw >= 0 ? raw : undefined;
      res.json(await c.deviceSessions.sharingReport({ minScore }));
    })
  );

  // Admin: end one device.
  r.delete(
    "/admin/devices/:sessionId",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      await c.deviceSessions.revoke(String(req.params.sessionId), "admin_revoked");
      res.json({ ok: true });
    })
  );

  // Admin: the student's devices, with the eviction count that flags sharing.
  r.get(
    "/admin/users/:userId/devices",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.deviceSessions.listForUser(String(req.params.userId)));
    })
  );

  // Admin: sign a student out of every device.
  r.delete(
    "/admin/users/:userId/devices",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.deviceSessions.revokeAllForUser(String(req.params.userId), "admin_revoked"));
    })
  );


  return r;
}
