/**
 * skill-drills.router.ts — core-skill drill library.
 *   Candidate: GET /skill-drills/of-day?module=…   (the global drill of the day)
 *   Admin:     CRUD + bulk upload under /admin/skill-drills
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import { isDrillModule } from "../../modules/skill-drills/skill-drills.service";
import { dailyContentUnlocked, type ModuleKey } from "../../modules/products/portal-tier-access";
import { resolveTrialAccess } from "../../modules/subscriptions/trial-access";

export function createSkillDrillsRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.skillDrillsService;

  // ---- Candidate: drill of the day ----
  // Gated per module, since each drill belongs to a different skill and tier
  // (Part A core → Reading, any tier; Part B/C, spellings and podcasts →
  // Precision). Day 1 of the free trial also passes: the Tier 0 card includes one
  // Reading Part A skill drill. This route was previously open to any signed-in
  // user regardless of what they had bought.
  r.get("/skill-drills/of-day", auth, asyncHandler(async (req, res) => {
    const module = String(req.query.module ?? "");
    if (!isDrillModule(module)) { res.status(400).json({ message: "Unknown drill module" }); return; }
    const u = (req as AuthedRequest).user;
    const [{ skillAccess }, trial] = await Promise.all([
      c.productsService.getOwnership(u.id),
      resolveTrialAccess(c.prisma, u.id)
    ]);
    if (!dailyContentUnlocked(skillAccess, module as ModuleKey, trial)) {
      res.status(403).json({ message: "This drill is not included in your current plan." });
      return;
    }
    const drill = await svc.drillOfDay(module);
    res.json({ drill: drill ?? null });
  }));

  // ---- Admin: library management ----
  r.get("/admin/skill-drills/counts", auth, admin, asyncHandler(async (_req, res) => {
    res.json(await svc.counts());
  }));

  r.get("/admin/skill-drills", auth, admin, asyncHandler(async (req, res) => {
    const module = String(req.query.module ?? "");
    if (!isDrillModule(module)) { res.status(400).json({ message: "Unknown drill module" }); return; }
    res.json({ drills: await svc.listByModule(module) });
  }));

  r.get("/admin/skill-drills/:id", auth, admin, asyncHandler(async (req, res) => {
    const drill = await svc.getOne(String(req.params.id));
    if (!drill) { res.status(404).json({ message: "Drill not found" }); return; }
    res.json(drill);
  }));

  r.post("/admin/skill-drills", auth, admin, asyncHandler(async (req, res) => {
    const module = String(req.body?.module ?? "");
    if (!isDrillModule(module)) { res.status(400).json({ message: "Unknown drill module" }); return; }
    const drills = Array.isArray(req.body?.drills) ? req.body.drills : [];
    res.json(await svc.createMany(module, drills));
  }));

  r.patch("/admin/skill-drills/:id", auth, admin, asyncHandler(async (req, res) => {
    const { title, isActive, displayOrder } = req.body ?? {};
    res.json(await svc.update(String(req.params.id), {
      ...(typeof title === "string" ? { title } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(typeof displayOrder === "number" ? { displayOrder } : {})
    }));
  }));

  r.delete("/admin/skill-drills/:id", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.remove(String(req.params.id)));
  }));

  return r;
}
