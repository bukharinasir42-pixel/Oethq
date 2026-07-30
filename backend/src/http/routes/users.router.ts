import { Router } from "express";
import { Role } from "@prisma/client";
import { ForbiddenException } from "../../common/http-exception";
import { CreateCustomUserDto } from "../../modules/users/dto/create-custom-user.dto";
import type { AppContainer } from "../container";
import { asyncHandler, rateLimitMiddleware, requireAdmin, requireAuth } from "../middleware";
import type { AuthedRequest } from "../middleware";
import { auditContextFromRequest } from "../request-audit";
import { validateDto } from "../validation";

export function createUsersRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);

  r.get(
    "/users",
    auth,
    requireAdmin(),
    asyncHandler(async (_req, res) => {
      res.json(await c.usersService.listAll());
    })
  );

  r.get(
    "/users/overview",
    auth,
    requireAdmin(),
    asyncHandler(async (_req, res) => {
      res.json(await c.usersService.getOverview());
    })
  );

  r.get(
    "/users/progress",
    auth,
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);
      res.json(await c.usersService.listProgressPaginated(page, limit));
    })
  );

  r.get(
    "/users/subscribed",
    auth,
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const page = req.query.page;
      if (page !== undefined) {
        const limit = Number(req.query.limit ?? 10);
        res.json(await c.usersService.listProgressPaginated(Number(page), limit));
        return;
      }
      res.json(await c.usersService.listSubscribed());
    })
  );

  r.post(
    "/users/custom",
    auth,
    requireAdmin(),
    rateLimitMiddleware(c.rateLimit, "users-custom", 10, 3600),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateCustomUserDto, req.body);
      const out = await c.usersService.createCustomUser(dto, auditContextFromRequest(req));
      res.json(out);
    })
  );

  r.get(
    "/users/:id/progress",
    auth,
    asyncHandler(async (req, res) => {
      const actor = (req as AuthedRequest).user;
      const userId = req.params.id;
      if (actor.role !== Role.ADMIN && actor.id !== userId) {
        throw new ForbiddenException("You can only view your own progress");
      }
      res.json(await c.usersService.getProgress(userId));
    })
  );

  return r;
}
