/**
 * spelling.router.ts — OET Listening spelling bank.
 *   Candidate: GET /spelling/bank            (live bank for the assessment engine)
 *   Admin:     CRUD + bulk import under /admin/spelling-terms
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import { dailyContentUnlocked } from "../../modules/products/portal-tier-access";
import { resolveTrialAccess } from "../../modules/subscriptions/trial-access";

const SPELLING_LOCKED =
  "Daily spelling is included with the Listening Precision tier or the Complete Course.";

export function createSpellingRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.spellingService;

  // Listening spelling — Precision tier / Complete Course, plus Day 1 of the free
  // trial ("1 day of live spelling" on the Tier 0 card). Both routes below were
  // previously open to any authenticated user, so the whole 1,938-term bank was
  // reachable by a Foundation buyer or an expired trial.
  const spellingGate = async (userId: string): Promise<boolean> => {
    const [{ skillAccess }, trial] = await Promise.all([
      c.productsService.getOwnership(userId),
      resolveTrialAccess(c.prisma, userId)
    ]);
    return dailyContentUnlocked(skillAccess, "spellings", trial);
  };

  // ---- Candidate: the live bank ----
  r.get("/spelling/bank", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    if (!(await spellingGate(u.id))) {
      res.status(403).json({ message: SPELLING_LOCKED });
      return;
    }
    res.json(await svc.getBank());
  }));

  // ---- Candidate: today's 30-term set (rotates every 24h, same for everyone) ----
  r.get("/spelling/daily", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    if (!(await spellingGate(u.id))) {
      res.status(403).json({ message: SPELLING_LOCKED });
      return;
    }
    res.json(await svc.getDailyBank());
  }));

  // ---- Admin ----
  r.get("/admin/spelling-terms/counts", auth, admin, asyncHandler(async (_req, res) => {
    res.json(await svc.counts());
  }));

  r.get("/admin/spelling-terms", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.list({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined
    }));
  }));

  r.post("/admin/spelling-terms", auth, admin, asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const terms = Array.isArray(body.terms) ? body.terms : [body];
    res.json(await svc.createMany(terms));
  }));

  r.patch("/admin/spelling-terms/:id", auth, admin, asyncHandler(async (req, res) => {
    const { term, category, hint, difficulty, isActive } = req.body ?? {};
    res.json(await svc.update(String(req.params.id), {
      ...(typeof term === "string" ? { term } : {}),
      ...(typeof category === "string" ? { category } : {}),
      ...(typeof hint === "string" ? { hint } : {}),
      ...(typeof difficulty === "number" ? { difficulty } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {})
    }));
  }));

  r.delete("/admin/spelling-terms/:id", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.remove(String(req.params.id)));
  }));

  return r;
}
