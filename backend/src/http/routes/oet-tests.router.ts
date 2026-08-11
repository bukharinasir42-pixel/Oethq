/**
 * oet-tests.router.ts — the contentJson-driven OET test flow (import + take +
 * grade). Separate from tests.router so the legacy Question-row engine is
 * untouched. Imported tests are still normal Test rows underneath.
 */
import { Router } from "express";
import { Role } from "@prisma/client";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";

export function createOetTestsRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.oetImportService;

  // ---- admin: import / validate ----
  r.post("/oet-tests/validate", auth, admin, asyncHandler(async (req, res) => {
    res.json(svc.validateOnly(req.body?.json ?? req.body));
  }));

  r.post("/oet-tests/import", auth, admin, asyncHandler(async (req, res) => {
    const { json, testId } = req.body ?? {};
    const payload = json ?? req.body;
    const out = await svc.importTest(payload, typeof testId === "string" ? testId : undefined);
    // Explanations authored inside the paper's own JSON are published with it.
    // Reported back so a paper that was expected to carry them and did not is
    // visible at import time, not discovered by a student weeks later.
    let explanations: { saved: number; skipped: number } | undefined;
    if (out?.type === "READING" && out?.id) {
      explanations = await c.explanationsService.saveFromImport(out.id, payload);
    }
    res.status(201).json(explanations ? { ...out, explanations } : out);
  }));

  r.get("/oet-tests/:id/admin", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.getAdmin(req.params.id));
  }));

  // ---- admin: listening session audio (uploaded file OR pasted URL) ----
  r.get("/oet-tests/:id/audio", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.getAudio(req.params.id));
  }));

  r.put("/oet-tests/:id/audio", auth, admin, asyncHandler(async (req, res) => {
    const { audioAssetId, audioUrl } = req.body ?? {};
    res.json(await svc.setAudio(req.params.id, { audioAssetId, audioUrl }));
  }));

  r.post("/oet-tests/import-past-paper", auth, admin, asyncHandler(async (req, res) => {
    const { readingJson, listeningJson, title } = req.body ?? {};
    res.status(201).json(await svc.importPastPaper({ readingJson, listeningJson, title }));
  }));

  // ---- candidate: play / attempt ----
  r.get("/oet-tests/:id/play", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    res.json(await svc.getPlayable(req.params.id, u.id, u.role === Role.ADMIN));
  }));

  r.post("/oet-tests/:id/attempts/start", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    res.json(await svc.startAttempt(req.params.id, u.id, u.role === Role.ADMIN));
  }));

  r.put("/oet-attempts/:attemptId/progress", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    const answers = (req.body?.answers ?? {}) as Record<string, string>;
    res.json(await svc.saveProgress(req.params.attemptId, u.id, answers));
  }));

  r.post("/oet-attempts/:attemptId/submit", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    const answers = (req.body?.answers ?? {}) as Record<string, string>;
    const auto = Boolean(req.body?.auto);
    res.json(await svc.submitAttempt(req.params.attemptId, u.id, answers, auto));
  }));

  r.get("/oet-attempts/:attemptId/result", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    res.json(await svc.getResult(req.params.attemptId, u.id));
  }));

  return r;
}
