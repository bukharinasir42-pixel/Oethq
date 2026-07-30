import { Router } from "express";
import { Role } from "@prisma/client";
import { PublishTestDto } from "../../modules/tests/dto/publish-test.dto";
import { SaveAttemptProgressDto } from "../../modules/tests/dto/save-attempt-progress.dto";
import { SubmitAttemptDto } from "../../modules/tests/dto/submit-attempt.dto";
import { UpsertTestDto } from "../../modules/tests/dto/upsert-test.dto";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";
import type { AuthedRequest } from "../middleware";
import { validateDto } from "../validation";

export function createTestsRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();

  r.get(
    "/tests/stats",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await c.testsService.stats());
    })
  );

  r.get(
    "/tests/results/mine",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      res.json(await c.testsService.listResultsForUser(u.id));
    })
  );

  r.get(
    "/tests/admin",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await c.testsService.listAllForAdmin());
    })
  );

  r.get(
    "/tests/admin/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.testsService.getAdminDetail(req.params.id));
    })
  );

  r.post(
    "/tests",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpsertTestDto, req.body);
      const created = await c.testsService.create(dto);
      res.status(201).json(created);
    })
  );

  r.put(
    "/tests/attempts/:attemptId/progress",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const dto = await validateDto(SaveAttemptProgressDto, req.body);
      res.json(await c.testsService.saveProgress(req.params.attemptId, u.id, dto));
    })
  );

  r.post(
    "/tests/attempts/:attemptId/submit",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const dto = await validateDto(SubmitAttemptDto, req.body);
      res.json(await c.testsService.submitAttempt(req.params.attemptId, u.id, dto));
    })
  );

  r.get(
    "/tests/attempts/:attemptId",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      res.json(await c.testsService.getAttempt(req.params.attemptId, u.id, u.role));
    })
  );

  r.get(
    "/tests/:testId/attempts/current",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      res.json(await c.testsService.getCurrentAttempt(req.params.testId, u.id));
    })
  );

  r.post(
    "/tests/:testId/attempts/start",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      res.json(await c.testsService.startAttempt(req.params.testId, u.id));
    })
  );

  r.put(
    "/tests/:id/publish",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(PublishTestDto, req.body);
      res.json(await c.testsService.publish(req.params.id, dto));
    })
  );

  r.put(
    "/tests/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpsertTestDto, req.body);
      res.json(await c.testsService.update(req.params.id, dto));
    })
  );

  r.delete(
    "/tests/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.testsService.delete(req.params.id));
    })
  );

  r.get(
    "/tests/:id",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      if (u.role === Role.ADMIN) {
        res.json(await c.testsService.getAdminDetail(req.params.id));
        return;
      }
      res.json(await c.testsService.getCandidateDetail(req.params.id, u.id));
    })
  );

  r.get(
    "/tests",
    asyncHandler(async (_req, res) => {
      res.json(await c.testsService.listPublished());
    })
  );

  return r;
}
