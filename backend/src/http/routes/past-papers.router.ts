import { Router } from "express";
import { PublishPastPaperDto } from "../../modules/past-papers/dto/publish-past-paper.dto";
import { UpsertPastPaperDto } from "../../modules/past-papers/dto/upsert-past-paper.dto";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";
import { validateDto } from "../validation";

export function createPastPapersRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();

  r.get(
    "/past-papers",
    auth,
    asyncHandler(async (_req, res) => {
      res.json(await c.pastPapersService.listPublished());
    })
  );

  r.get(
    "/past-papers/admin",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await c.pastPapersService.listForAdmin());
    })
  );

  r.get(
    "/past-papers/admin/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.pastPapersService.getForAdmin(req.params.id));
    })
  );

  r.post(
    "/past-papers",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpsertPastPaperDto, req.body);
      const created = await c.pastPapersService.create(dto);
      res.status(201).json(created);
    })
  );

  r.put(
    "/past-papers/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpsertPastPaperDto, req.body);
      res.json(await c.pastPapersService.update(req.params.id, dto));
    })
  );

  r.put(
    "/past-papers/:id/publish",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(PublishPastPaperDto, req.body);
      res.json(await c.pastPapersService.publish(req.params.id, dto));
    })
  );

  r.delete(
    "/past-papers/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.pastPapersService.remove(req.params.id));
    })
  );

  return r;
}
