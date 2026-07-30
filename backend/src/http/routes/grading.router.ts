import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler } from "../middleware";

export function createGradingRouter(c: AppContainer) {
  const r = Router();

  r.get(
    "/grading/bands",
    asyncHandler(async (_req, res) => {
      res.json(c.gradingService.getBands());
    })
  );

  return r;
}
