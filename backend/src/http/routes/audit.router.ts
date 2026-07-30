import { Router } from "express";
import { ListAuditLogsDto } from "../../modules/audit/dto/list-audit-logs.dto";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";
import { validateDto } from "../validation";

export function createAuditRouter(c: AppContainer) {
  const r = Router();

  r.get(
    "/audit-logs",
    requireAuth(c.jwtHelper),
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ListAuditLogsDto, req.query);
      res.json(await c.auditService.list(dto));
    })
  );

  return r;
}
