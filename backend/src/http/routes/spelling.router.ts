/**
 * spelling.router.ts — OET Listening spelling bank.
 *   Candidate: GET /spelling/bank            (live bank for the assessment engine)
 *   Admin:     CRUD + bulk import under /admin/spelling-terms
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";

export function createSpellingRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.spellingService;

  // ---- Candidate: the live bank ----
  r.get("/spelling/bank", auth, asyncHandler(async (_req, res) => {
    res.json(await svc.getBank());
  }));

  // ---- Candidate: today's 30-term set (rotates every 24h, same for everyone) ----
  r.get("/spelling/daily", auth, asyncHandler(async (_req, res) => {
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
