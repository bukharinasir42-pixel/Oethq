/**
 * attribution.router.ts — where visitors come from.
 *
 *   Public: POST /attribution/visit          (one ping per page view, no auth)
 *   Admin:  GET  /admin/traffic/summary
 *           GET  /admin/traffic/visitors
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, rateLimitMiddleware, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";

/** Parse an ISO date from a query string, ignoring anything unparseable. */
function dateParam(v: unknown): Date | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function createAttributionRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.attributionService;

  /**
   * The visit ping. Open by design — this fires on the public marketing pages
   * where there is no session — so it is rate limited per IP, and it returns no
   * data at all. There is nothing here worth calling twice.
   *
   * 200 is returned even when the ping is rejected: this runs on every page
   * view, and a visitor's console must never fill with red because analytics
   * hiccuped.
   */
  r.post(
    "/attribution/visit",
    rateLimitMiddleware(c.rateLimit, "attr-visit", 240, 3600),
    asyncHandler(async (req, res) => {
      const b = (req.body ?? {}) as Record<string, unknown>;
      // A signed-in browser sends its token like any other call; when it does,
      // the visitor row is linked to the account without waiting for a sign-up.
      let userId: string | null = null;
      const authz = req.headers.authorization;
      if (typeof authz === "string" && authz.startsWith("Bearer ")) {
        try {
          const payload = await c.jwtHelper.verifyAsync<{ sub: string }>(authz.slice(7).trim());
          userId = payload.sub;
        } catch {
          /* an expired token on an analytics ping is not an error */
        }
      }

      await svc.recordVisit({
        visitorKey: String(b.visitorKey ?? ""),
        utmSource: str(b.utmSource),
        utmMedium: str(b.utmMedium),
        utmCampaign: str(b.utmCampaign),
        utmTerm: str(b.utmTerm),
        utmContent: str(b.utmContent),
        referrer: str(b.referrer),
        clickId: str(b.clickId),
        clickIdKind: str(b.clickIdKind),
        landingPath: str(b.landingPath),
        country:
          str(req.headers["cf-ipcountry"]) ??
          str(req.headers["x-vercel-ip-country"]) ??
          str(b.country),
        userAgent: str(req.headers["user-agent"]),
        userId
      });

      res.status(200).json({ ok: true });
    })
  );

  // ---- Admin ----

  r.get(
    "/admin/traffic/summary",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await svc.summary({ from: dateParam(req.query.from), to: dateParam(req.query.to) }));
    })
  );

  r.get(
    "/admin/traffic/visitors",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const converted =
        req.query.converted === "true" ? true : req.query.converted === "false" ? false : undefined;
      res.json(
        await svc.listVisitors({
          channel: typeof req.query.channel === "string" ? req.query.channel : undefined,
          converted,
          search: typeof req.query.search === "string" ? req.query.search : undefined,
          take: req.query.take ? Number(req.query.take) : undefined,
          skip: req.query.skip ? Number(req.query.skip) : undefined
        })
      );
    })
  );

  // A convenience for the admin overview: which channel is this one student from.
  r.get(
    "/admin/traffic/users/:userId",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      void (req as AuthedRequest).user;
      const user = await c.prisma.user.findUnique({
        where: { id: req.params.userId },
        select: { signupChannel: true, signupSource: true, signupCampaign: true, signupLandingPath: true, heardFrom: true }
      });
      res.json(user ?? {});
    })
  );

  return r;
}
