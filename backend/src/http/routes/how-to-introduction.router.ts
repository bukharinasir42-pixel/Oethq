import { Router } from "express";
import { UpsertHowToIntroductionDto } from "../../modules/how-to-introduction/dto/upsert-how-to-introduction.dto";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";
import { validateDto } from "../validation";

export function createHowToIntroductionRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();

  r.get(
    "/how-to-introduction",
    auth,
    asyncHandler(async (_req, res) => {
      res.json(await c.howToIntroductionService.getForPortal());
    })
  );

  r.get(
    "/how-to-introduction/admin",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await c.howToIntroductionService.getForAdmin());
    })
  );

  r.put(
    "/how-to-introduction",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpsertHowToIntroductionDto, req.body);
      res.json(await c.howToIntroductionService.upsert(dto));
    })
  );

  return r;
}
