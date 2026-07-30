import { Router } from "express";
import type { SystemService } from "../../system.service";
import { asyncHandler } from "../middleware";

export function createSystemRouter(system: SystemService) {
  const r = Router();

  r.get(
    "/health",
    asyncHandler(async (_req, res) => {
      res.json(system.getLiveness());
    })
  );

  r.get(
    "/health/live",
    asyncHandler(async (_req, res) => {
      res.json(system.getLiveness());
    })
  );

  r.get(
    "/health/ready",
    asyncHandler(async (_req, res) => {
      const body = await system.getReadiness();
      res.status(body.ok ? 200 : 503).json(body);
    })
  );

  r.get(
    "/metrics",
    asyncHandler(async (_req, res) => {
      const text = await system.getMetricsText();
      res.type("text/plain").send(text);
    })
  );

  return r;
}
