/**
 * listening-podcasts.router.ts — the daily listening-podcast library.
 *   Candidate: GET  /listening-podcasts/of-day        (podcast of the day + stats)
 *              POST /listening-podcasts/mark-listened  (record today's completion)
 *   Admin:     CRUD + bulk create under /admin/listening-podcasts
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import type { PodcastInput } from "../../modules/listening-podcasts/listening-podcasts.service";
import { dailyContentUnlocked } from "../../modules/products/portal-tier-access";
import { resolveTrialAccess } from "../../modules/subscriptions/trial-access";

export function createListeningPodcastsRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.listeningPodcastsService;

  // Listening Part C podcast of the day — Precision tier / Complete Course, plus
  // Day 1 of the free trial ("1 podcast episode" on the Tier 0 card). A trial
  // user holds no entitlements, so the tier check alone would 403 every trial.
  const podcastGate = async (userId: string): Promise<boolean> => {
    const [{ skillAccess }, trial] = await Promise.all([
      c.productsService.getOwnership(userId),
      resolveTrialAccess(c.prisma, userId)
    ]);
    return dailyContentUnlocked(skillAccess, "part-c-podcasts", trial);
  };

  // ---- Candidate ----
  r.get("/listening-podcasts/of-day", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    if (!(await podcastGate(u.id))) {
      res.status(403).json({ message: "Daily listening podcasts are included with the Precision tier or the Complete Course." });
      return;
    }
    const podcast = await svc.podcastOfDay(u.id);
    res.json({ podcast: podcast ?? null });
  }));

  r.post("/listening-podcasts/mark-listened", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    if (!(await podcastGate(u.id))) {
      res.status(403).json({ message: "Daily listening podcasts are included with the Precision tier or the Complete Course." });
      return;
    }
    res.json(await svc.markListened(u.id));
  }));

  // ---- Admin ----
  r.get("/admin/listening-podcasts/counts", auth, admin, asyncHandler(async (_req, res) => {
    res.json(await svc.counts());
  }));

  r.get("/admin/listening-podcasts", auth, admin, asyncHandler(async (_req, res) => {
    res.json({ podcasts: await svc.list() });
  }));

  r.get("/admin/listening-podcasts/:id", auth, admin, asyncHandler(async (req, res) => {
    const podcast = await svc.getOne(String(req.params.id));
    if (!podcast) { res.status(404).json({ message: "Podcast not found" }); return; }
    res.json(podcast);
  }));

  r.post("/admin/listening-podcasts", auth, admin, asyncHandler(async (req, res) => {
    const podcasts = Array.isArray(req.body?.podcasts) ? (req.body.podcasts as PodcastInput[]) : [];
    res.json(await svc.createMany(podcasts));
  }));

  r.patch("/admin/listening-podcasts/:id", auth, admin, asyncHandler(async (req, res) => {
    const { kicker, title, description, audioAssetId, audioUrl, durationSec, isActive, displayOrder } = req.body ?? {};
    res.json(await svc.update(String(req.params.id), {
      ...(kicker !== undefined ? { kicker } : {}),
      ...(typeof title === "string" ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(audioAssetId !== undefined ? { audioAssetId } : {}),
      ...(audioUrl !== undefined ? { audioUrl } : {}),
      ...(durationSec !== undefined ? { durationSec } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(typeof displayOrder === "number" ? { displayOrder } : {})
    }));
  }));

  r.delete("/admin/listening-podcasts/:id", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.remove(String(req.params.id)));
  }));

  return r;
}
