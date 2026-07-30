/**
 * portal-resources.router.ts — premium cheat-sheet pages + the Part C articles
 * "must watch" intro video. Candidate: list cheat sheets for a skill (ownership
 * enforced) + get the article intro. Admin: CRUD over all placements.
 */
import { Router } from "express";
import { PortalResourceKind, PortalResourcePlacement } from "@prisma/client";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";

const PLACEMENTS = new Set<string>(Object.values(PortalResourcePlacement));
const KINDS = new Set<string>(Object.values(PortalResourceKind));

function parsePlacement(raw: unknown): PortalResourcePlacement {
  if (typeof raw === "string" && PLACEMENTS.has(raw)) return raw as PortalResourcePlacement;
  throw Object.assign(new Error("invalid placement"), { statusCode: 400 });
}
function parseKind(raw: unknown): PortalResourceKind {
  if (typeof raw === "string" && KINDS.has(raw)) return raw as PortalResourceKind;
  throw Object.assign(new Error("kind must be PDF or VIDEO"), { statusCode: 400 });
}
function optionalStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return String(v);
}

export function createPortalResourcesRouter(c: AppContainer): Router {
  const router = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.portalResourcesService;

  // ---- candidate ----
  router.get("/cheat-sheets", auth, asyncHandler(async (req, res) => {
    const raw = String(req.query.skill ?? "").toUpperCase();
    if (raw !== "READING" && raw !== "LISTENING") {
      throw Object.assign(new Error("skill must be READING or LISTENING"), { statusCode: 400 });
    }
    res.json(await svc.listCheatSheets((req as AuthedRequest).user.id, raw));
  }));

  router.get("/article-intro", auth, asyncHandler(async (_req, res) => {
    res.json({ intro: await svc.articleIntro() });
  }));

  // Mandatory "how to use the course" intro video (once per account).
  router.get("/onboarding-intro", auth, asyncHandler(async (req, res) => {
    res.json(await svc.onboardingIntro((req as AuthedRequest).user.id));
  }));
  router.post("/onboarding-intro/complete", auth, asyncHandler(async (req, res) => {
    res.json(await svc.markOnboardingWatched((req as AuthedRequest).user.id));
  }));

  // ---- admin ----
  router.get("/admin/portal-resources", auth, admin, asyncHandler(async (req, res) => {
    const placement = req.query.placement ? parsePlacement(String(req.query.placement)) : undefined;
    res.json({ resources: await svc.listAll(placement) });
  }));

  router.post("/admin/portal-resources", auth, admin, asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    if (!b.title || String(b.title).trim() === "") {
      throw Object.assign(new Error("title is required"), { statusCode: 400 });
    }
    res.json(await svc.create({
      placement: parsePlacement(b.placement),
      kind: parseKind(b.kind),
      title: String(b.title).trim(),
      description: optionalStr(b.description) ?? null,
      displayOrder: Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 0,
      pdfUrl: optionalStr(b.pdfUrl) ?? null,
      bunnyVideoId: optionalStr(b.bunnyVideoId) ?? null,
      videoUrl: optionalStr(b.videoUrl) ?? null,
      isPublished: b.isPublished === undefined ? true : Boolean(b.isPublished)
    }));
  }));

  router.patch("/admin/portal-resources/:id", auth, admin, asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (b.placement !== undefined) data.placement = parsePlacement(b.placement);
    if (b.kind !== undefined) data.kind = parseKind(b.kind);
    if (b.title !== undefined) data.title = String(b.title).trim();
    if (b.description !== undefined) data.description = optionalStr(b.description);
    if (b.displayOrder !== undefined) data.displayOrder = Number(b.displayOrder) || 0;
    if (b.pdfUrl !== undefined) data.pdfUrl = optionalStr(b.pdfUrl);
    if (b.bunnyVideoId !== undefined) data.bunnyVideoId = optionalStr(b.bunnyVideoId);
    if (b.videoUrl !== undefined) data.videoUrl = optionalStr(b.videoUrl);
    if (b.isPublished !== undefined) data.isPublished = Boolean(b.isPublished);
    res.json(await svc.update(String(req.params.id), data));
  }));

  router.delete("/admin/portal-resources/:id", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.remove(String(req.params.id)));
  }));

  return router;
}
