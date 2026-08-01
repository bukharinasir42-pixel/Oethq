/**
 * reading-articles.router.ts — premium reading-article bank (Reading Part B/C).
 *   Candidate: GET /reading-articles/of-day   (the global article of the day)
 *   Admin:     CRUD + bulk create under /admin/reading-articles
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import type { ArticleInput } from "../../modules/reading-articles/reading-articles.service";
import { skillModuleUnlocked } from "../../modules/products/portal-tier-access";

export function createReadingArticlesRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.readingArticlesService;

  // ---- Candidate: article of the day (Reading Part B/C — Precision tier / Complete) ----
  r.get("/reading-articles/of-day", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    const { skillAccess } = await c.productsService.getOwnership(u.id);
    if (!skillModuleUnlocked(skillAccess, "READING", "part-bc-core")) {
      res.status(403).json({ message: "Reading Part B/C articles are included with the Precision tier or the Complete Material." });
      return;
    }
    const article = await svc.articleOfDay();
    res.json({ article: article ?? null });
  }));

  // ---- Admin: library management ----
  r.get("/admin/reading-articles/counts", auth, admin, asyncHandler(async (_req, res) => {
    res.json(await svc.counts());
  }));

  r.get("/admin/reading-articles", auth, admin, asyncHandler(async (_req, res) => {
    res.json({ articles: await svc.list() });
  }));

  r.get("/admin/reading-articles/:id", auth, admin, asyncHandler(async (req, res) => {
    const article = await svc.getOne(String(req.params.id));
    if (!article) { res.status(404).json({ message: "Article not found" }); return; }
    res.json(article);
  }));

  r.post("/admin/reading-articles", auth, admin, asyncHandler(async (req, res) => {
    const articles = Array.isArray(req.body?.articles) ? (req.body.articles as ArticleInput[]) : [];
    res.json(await svc.createMany(articles));
  }));

  r.patch("/admin/reading-articles/:id", auth, admin, asyncHandler(async (req, res) => {
    const { kicker, title, standfirst, bodyText, attribution, isActive, displayOrder } = req.body ?? {};
    res.json(await svc.update(String(req.params.id), {
      ...(kicker !== undefined ? { kicker } : {}),
      ...(typeof title === "string" ? { title } : {}),
      ...(standfirst !== undefined ? { standfirst } : {}),
      ...(typeof bodyText === "string" ? { bodyText } : {}),
      ...(attribution !== undefined ? { attribution } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(typeof displayOrder === "number" ? { displayOrder } : {})
    }));
  }));

  r.delete("/admin/reading-articles/:id", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.remove(String(req.params.id)));
  }));

  return r;
}
