/**
 * writing.router.ts — OET Writing course.
 *   Candidate: GET  /writing/library
 *              GET  /writing/case-notes/:id
 *              POST /writing/submit { caseNoteId, letterText, auto? }
 *              GET  /writing/my
 *   Admin:     case-note CRUD, per-profession correction settings, submissions.
 */
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";

export function createWritingRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.writingService;

  // ---- Candidate ----
  r.get("/writing/library", auth, asyncHandler(async (req, res) => {
    res.json(await svc.libraryForUser((req as AuthedRequest).user.id));
  }));

  r.get("/writing/my", auth, asyncHandler(async (req, res) => {
    res.json(await svc.myHistory((req as AuthedRequest).user.id));
  }));

  r.get("/writing/case-notes/:id", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getCaseNoteForUser(String(req.params.id), (req as AuthedRequest).user.id));
  }));

  r.post("/writing/submit", auth, asyncHandler(async (req, res) => {
    const u = (req as AuthedRequest).user;
    const { caseNoteId, letterText, auto } = req.body ?? {};
    res.json(await svc.submit(u.id, String(caseNoteId ?? ""), String(letterText ?? ""), Boolean(auto)));
  }));

  // ---- Admin (specific paths before /:id) ----
  r.get("/admin/writing/counts", auth, admin, asyncHandler(async (_req, res) => {
    res.json(await svc.counts());
  }));

  r.get("/admin/writing/settings", auth, admin, asyncHandler(async (_req, res) => {
    res.json(await svc.listSettings());
  }));
  r.put("/admin/writing/settings", auth, admin, asyncHandler(async (req, res) => {
    const { profession, correctionEmail } = req.body ?? {};
    res.json(await svc.setSetting(String(profession ?? ""), String(correctionEmail ?? "")));
  }));

  r.get("/admin/writing/submissions", auth, admin, asyncHandler(async (req, res) => {
    const profession = req.query.profession ? String(req.query.profession) : undefined;
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    res.json({ submissions: await svc.listSubmissions({ profession, userId }) });
  }));
  r.get("/admin/writing/submissions/:id", auth, admin, asyncHandler(async (req, res) => {
    const sub = await svc.getSubmission(String(req.params.id));
    if (!sub) { res.status(404).json({ message: "Submission not found" }); return; }
    res.json(sub);
  }));

  r.get("/admin/writing", auth, admin, asyncHandler(async (req, res) => {
    const profession = String(req.query.profession ?? "");
    if (!profession) { res.status(400).json({ message: "profession required" }); return; }
    res.json({ caseNotes: await svc.listByProfession(profession) });
  }));
  r.post("/admin/writing", auth, admin, asyncHandler(async (req, res) => {
    const { profession, title, scenario, caseNotesHtml, wordGuidance, timeLimitMin } = req.body ?? {};
    res.status(201).json(await svc.create(String(profession ?? ""), { title, scenario, caseNotesHtml, wordGuidance, timeLimitMin }));
  }));

  r.get("/admin/writing/:id", auth, admin, asyncHandler(async (req, res) => {
    const note = await svc.getOne(String(req.params.id));
    if (!note) { res.status(404).json({ message: "Case note not found" }); return; }
    res.json(note);
  }));
  r.patch("/admin/writing/:id", auth, admin, asyncHandler(async (req, res) => {
    const { title, scenario, caseNotesHtml, wordGuidance, timeLimitMin, isActive, displayOrder } = req.body ?? {};
    res.json(await svc.update(String(req.params.id), {
      ...(typeof title === "string" ? { title } : {}),
      ...(typeof scenario === "string" ? { scenario } : {}),
      ...(typeof caseNotesHtml === "string" ? { caseNotesHtml } : {}),
      ...(wordGuidance !== undefined ? { wordGuidance } : {}),
      ...(typeof timeLimitMin === "number" ? { timeLimitMin } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(typeof displayOrder === "number" ? { displayOrder } : {})
    }));
  }));
  r.delete("/admin/writing/:id", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.remove(String(req.params.id)));
  }));

  return r;
}
