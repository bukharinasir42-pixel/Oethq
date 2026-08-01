import { Router } from "express";
import { Role } from "@prisma/client";
import { ForbiddenException, UnauthorizedException } from "../../common/http-exception";
import { CreatePlanDto } from "../../modules/subscriptions/dto/create-plan.dto";
import { CreatePurchaseIntentDto } from "../../modules/subscriptions/dto/create-purchase-intent.dto";
import { HandlePurchaseWebhookDto } from "../../modules/subscriptions/dto/handle-purchase-webhook.dto";
import { ResolvePurchaseDto } from "../../modules/subscriptions/dto/resolve-purchase.dto";
import { ConfirmStripeCheckoutDto } from "../../modules/subscriptions/dto/confirm-stripe-checkout.dto";
import { SelectPlanDto } from "../../modules/subscriptions/dto/select-plan.dto";
import { SendPurchaseEmailDto } from "../../modules/subscriptions/dto/send-purchase-email.dto";
import { UpdatePlanDto } from "../../modules/subscriptions/dto/update-plan.dto";
import type { AppContainer } from "../container";
import { asyncHandler, rateLimitMiddleware, requireAdmin, requireAuth } from "../middleware";
import type { AuthedRequest } from "../middleware";
import { auditContextFromRequest } from "../request-audit";
import { validateDto } from "../validation";

export function createSubscriptionsRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const ctx = auditContextFromRequest;

  r.get(
    "/plans/admin",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await c.subscriptionsService.listPlansForAdmin());
    })
  );

  r.get(
    "/plans",
    asyncHandler(async (_req, res) => {
      res.json(await c.subscriptionsService.listActivePlans());
    })
  );

  r.post(
    "/plans",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreatePlanDto, req.body);
      const plan = await c.subscriptionsService.createPlan(dto, ctx(req));
      res.status(201).json(plan);
    })
  );

  r.put(
    "/plans/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpdatePlanDto, req.body);
      res.json(await c.subscriptionsService.updatePlan(req.params.id, dto, ctx(req)));
    })
  );

  r.get(
    "/subscriptions/status",
    auth,
    asyncHandler(async (req, res) => {
      const userId = targetUserId(req as AuthedRequest);
      res.json(await c.subscriptionsService.getSubscriptionStatus(userId));
    })
  );

  r.get(
    "/subscriptions/dashboard",
    auth,
    asyncHandler(async (req, res) => {
      const userId = targetUserId(req as AuthedRequest);
      res.json(await c.subscriptionsService.getDashboard(userId));
    })
  );

  r.post(
    "/subscriptions/free-trial",
    auth,
    rateLimitMiddleware(c.rateLimit, "subscriptions-free-trial", 10, 3600),
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const out = await c.subscriptionsService.startFreeTrial(u.id, ctx(req));
      res.json(out);
    })
  );

  r.post(
    "/subscriptions/select-plan",
    auth,
    rateLimitMiddleware(c.rateLimit, "subscriptions-select-plan", 30, 300),
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const dto = await validateDto(SelectPlanDto, req.body);
      res.json(await c.subscriptionsService.selectPlan(u.id, dto, ctx(req)));
    })
  );

  r.get(
    "/subscriptions/purchases",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await c.subscriptionsService.listPurchasesForAdmin());
    })
  );

  r.get(
    "/subscriptions/purchases/:id",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const purchase = await c.subscriptionsService.getPurchaseForActor(req.params.id, {
        userId: u.id,
        role: u.role
      });
      res.json(purchase);
    })
  );

  r.post(
    "/subscriptions/purchases",
    auth,
    rateLimitMiddleware(c.rateLimit, "subscriptions-purchase-intent", 30, 300),
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const dto = await validateDto(CreatePurchaseIntentDto, req.body);
      if (u.role !== Role.ADMIN && dto.userId !== u.id) {
        throw new ForbiddenException("Cannot create purchases for another user");
      }
      res.json(await c.subscriptionsService.createPurchaseIntent(dto, ctx(req)));
    })
  );

  r.post(
    "/subscriptions/purchases/mock-intent",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreatePurchaseIntentDto, req.body);
      res.json(await c.subscriptionsService.createPurchaseIntent(dto, ctx(req)));
    })
  );

  r.post(
    "/subscriptions/purchases/mock-webhook",
    asyncHandler(async (req, res) => {
      const expected = process.env.PAYMENTS_WEBHOOK_SECRET?.trim();
      if (expected) {
        const header = req.headers["x-webhook-secret"];
        const value = Array.isArray(header) ? header[0] : header;
        if (value !== expected) {
          throw new UnauthorizedException("Invalid or missing webhook secret");
        }
      }
      const dto = await validateDto(HandlePurchaseWebhookDto, req.body);
      res.json(await c.subscriptionsService.handleMockPurchaseWebhook(dto, ctx(req)));
    })
  );

  r.post(
    "/subscriptions/purchases/:id/resolve",
    auth,
    rateLimitMiddleware(c.rateLimit, "subscriptions-resolve", 40, 300),
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const dto = await validateDto(ResolvePurchaseDto, req.body);
      res.json(
        await c.subscriptionsService.resolvePurchaseForActor(req.params.id, dto, { userId: u.id, role: u.role }, ctx(req))
      );
    })
  );

  r.post(
    "/subscriptions/purchases/confirm-stripe",
    rateLimitMiddleware(c.rateLimit, "subscriptions-confirm-stripe", 30, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ConfirmStripeCheckoutDto, req.body);
      res.json(
        await c.subscriptionsService.confirmStripeCheckout(
          { purchaseId: dto.purchaseId, sessionId: dto.sessionId },
          ctx(req)
        )
      );
    })
  );

  r.post(
    "/subscriptions/purchases/:id/retry",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const purchase = await c.subscriptionsService.retryPurchaseForActor(req.params.id, { userId: u.id, role: u.role }, ctx(req));
      res.json(purchase);
    })
  );

  r.post(
    "/subscriptions/purchase-email",
    auth,
    admin,
    rateLimitMiddleware(c.rateLimit, "subscriptions-purchase-email", 15, 3600),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(SendPurchaseEmailDto, req.body);
      res.json(await c.subscriptionsService.sendPurchaseSuccessEmail(dto, ctx(req)));
    })
  );

  // ---- admin: upgrade / downgrade a candidate's Complete Course plan ----
  r.post(
    "/admin/users/:userId/plan",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const planId = String(req.body?.planId ?? "").trim();
      if (!planId) {
        res.status(400).json({ message: "planId required" });
        return;
      }
      const rawDays = Number(req.body?.days);
      const days = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : null;
      res.json(await c.subscriptionsService.adminChangePlan(String(req.params.userId), planId, days));
    })
  );

  r.delete(
    "/admin/users/:userId/plan",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.subscriptionsService.adminCancelPlan(String(req.params.userId)));
    })
  );

  // Cut the student off entirely — plan, trial row and every course at once.
  r.delete(
    "/admin/users/:userId/access",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.subscriptionsService.adminEndAllAccess(String(req.params.userId)));
    })
  );

  return r;
}

function targetUserId(req: AuthedRequest): string {
  const raw = req.query.userId;
  const fromQuery = typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  const userId = fromQuery ?? req.user.id;
  if (req.user.role !== Role.ADMIN && userId !== req.user.id) {
    throw new ForbiddenException("Cannot read another user's subscription data");
  }
  return userId;
}
