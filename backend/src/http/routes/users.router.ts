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
      // Stamp the account so the acquisition report never credits a channel for
      // a student who was created by hand. Left unstamped they land in "Other"
      // and quietly inflate whichever bucket the dashboard sorts them into.
      if (out?.user?.id) await c.attributionService.markAdminCreated(out.user.id);
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

  // Admin: change a student's profession. Takes effect on their next request —
  // their case-note library and Speaking sheet are both read from this value.
  r.patch(
    "/admin/users/:userId/profession",
    requireAuth(c.jwtHelper),
    requireAdmin(),
    asyncHandler(async (req, res) => {
      res.json(
        await c.authService.adminSetProfession(
          String(req.params.userId),
          String(req.body?.profession ?? ""),
          auditContextFromRequest(req)
        )
      );
    })
  );


  return r;
}
