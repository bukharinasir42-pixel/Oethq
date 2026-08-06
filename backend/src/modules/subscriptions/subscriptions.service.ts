import type { AppConfig } from "../../common/app-config";
import { resolveAppUrl } from "../../common/app-url";
import { BadRequestException, NotFoundException } from "../../common/http-exception";
import { createLogger } from "../../common/logger";
import {
  AttemptStatus,
  OTPPurpose,
  PlanTier,
  Prisma,
  PurchaseStatus,
  SubscriptionStatus,
  TestType
} from "@prisma/client";
import { randomUUID } from "crypto";
import type { RequestAuditContext } from "../../common/http/request-context";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { StripeService, type StripeEvent, type StripeCheckoutSession } from "../payments/stripe.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { CreatePurchaseIntentDto } from "./dto/create-purchase-intent.dto";
import { HandlePurchaseWebhookDto } from "./dto/handle-purchase-webhook.dto";
import { ResolvePurchaseDto } from "./dto/resolve-purchase.dto";
import { SendPurchaseEmailDto } from "./dto/send-purchase-email.dto";
import { SelectPlanDto } from "./dto/select-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { pickEffectiveSubscriptionForAccess, pickPendingActivationSubscription, calendarDaysRemaining } from "./subscription-access.utils";

type PurchaseTrialUpgradeFields = {
  upgradedFromTrial: boolean;
};

function asPurchaseTrialUpgradeFields(purchase: object): PurchaseTrialUpgradeFields {
  const row = purchase as { upgradedFromTrial?: boolean | null };
  return { upgradedFromTrial: Boolean(row.upgradedFromTrial) };
}

export class SubscriptionsService {
  private readonly logger = createLogger("SubscriptionsService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly configService: AppConfig,
    private readonly auditService: AuditService,
    private readonly stripeService: StripeService
  ) {}

  listActivePlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" }
    });
  }

  listPlansForAdmin() {
    return this.prisma.plan.findMany({
      orderBy: [{ tier: "asc" }, { price: "asc" }]
    });
  }

  async listPurchasesForAdmin() {
    const purchases = await this.prisma.purchase.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, tier: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 500
    });

    // Backfill kind for older rows completed before upgradedFromTrial existed.
    const missingKindIds = purchases
      .filter((row) => !asPurchaseTrialUpgradeFields(row).upgradedFromTrial)
      .map((row) => row.id);
    const upgradeAuditIds = new Set<string>();
    if (missingKindIds.length > 0) {
      const audits = await this.prisma.auditLog.findMany({
        where: {
          action: "purchase.completed_trial_upgrade",
          entityType: "Purchase",
          entityId: { in: missingKindIds }
        },
        select: { entityId: true }
      });
      for (const audit of audits) {
        if (audit.entityId) upgradeAuditIds.add(audit.entityId);
      }
    }

    return purchases.map((purchase) => {
      const upgradedFromTrial =
        asPurchaseTrialUpgradeFields(purchase).upgradedFromTrial || upgradeAuditIds.has(purchase.id);
      return {
        ...purchase,
        upgradedFromTrial,
        purchaseKind: upgradedFromTrial ? ("TRIAL_UPGRADE" as const) : ("DIRECT_PAID" as const)
      };
    });
  }

  async getPurchaseForActor(
    purchaseId: string,
    actor: {
      userId: string;
      role: string;
    }
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, tier: true } }
      }
    });

    if (!purchase) {
      throw new NotFoundException("Purchase not found");
    }

    if (actor.role !== "ADMIN" && purchase.userId !== actor.userId) {
      throw new BadRequestException("Purchase access denied");
    }

    return purchase;
  }

  async createPlan(dto: CreatePlanDto, context?: RequestAuditContext) {
    if (dto.tier !== PlanTier.CUSTOM) {
      const existing = await this.prisma.plan.findFirst({ where: { tier: dto.tier } });
      if (existing) {
        throw new BadRequestException(`Plan for tier ${dto.tier} already exists`);
      }
    }

    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        tier: dto.tier,
        description: dto.description,
        price: dto.price,
        currency: dto.currency ?? "USD",
        readingLimit: dto.readingLimit,
        listeningLimit: dto.listeningLimit,
        pastPaperLimit: dto.pastPaperLimit,
        writingLimit: dto.writingLimit ?? 0,
        durationDays: dto.durationDays ?? 60,
        isCustom: dto.tier === PlanTier.CUSTOM
      }
    });

    await this.auditService.record({
      ...context,
      action: "plan.created",
      entityType: "Plan",
      entityId: plan.id,
      metadata: {
        name: plan.name,
        tier: plan.tier,
        price: plan.price.toString(),
        currency: plan.currency
      }
    });

    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto, context?: RequestAuditContext) {
    const data: Prisma.PlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.readingLimit !== undefined) data.readingLimit = dto.readingLimit;
    if (dto.listeningLimit !== undefined) data.listeningLimit = dto.listeningLimit;
    if (dto.pastPaperLimit !== undefined) data.pastPaperLimit = dto.pastPaperLimit;
    if (dto.writingLimit !== undefined) data.writingLimit = dto.writingLimit;
    if (dto.durationDays !== undefined) data.durationDays = dto.durationDays;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const plan = await this.prisma.plan.update({
      where: { id },
      data
    });

    await this.auditService.record({
      ...context,
      action: "plan.updated",
      entityType: "Plan",
      entityId: plan.id,
      metadata: {
        fields: Object.keys(data)
      }
    });

    return plan;
  }

  async startFreeTrial(userId: string, context?: RequestAuditContext) {
    const starterPlan = await this.prisma.plan.findFirst({ where: { tier: PlanTier.STARTER } });
    if (!starterPlan) throw new NotFoundException("Starter plan not configured");

    const existing = await this.prisma.subscription.findFirst({
      where: { userId, planId: starterPlan.id }
    });

    if (existing?.trialUsed) {
      throw new BadRequestException("Free trial already used");
    }

    const subscription = existing
      ? await this.prisma.subscription.update({
          where: { id: existing.id },
          data: {
            status: SubscriptionStatus.TRIAL,
            startDate: null,
            endDate: null,
            otpVerifiedAt: null,
            trialUsed: false
          }
        })
      : await this.prisma.subscription.create({
          data: {
            userId,
            planId: starterPlan.id,
            status: SubscriptionStatus.TRIAL,
            trialUsed: false
          }
        });

    const otp = await this.authService.issueOtpForUser(userId, OTPPurpose.FREE_TRIAL);
    await this.auditService.record({
      ...context,
      actorUserId: context?.actorUserId || userId,
      action: "subscription.free_trial_started",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        planTier: starterPlan.tier
      }
    });

    return {
      subscription,
      otp: this.configService.get("NODE_ENV") === "development" ? otp : undefined
    };
  }

  async getSubscriptionStatus(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED] }
      },
      include: { plan: true }
    });

    const now = new Date();
    const expiredIds = subscriptions
      .filter(
        (row) =>
          row.endDate &&
          row.endDate.getTime() <= now.getTime() &&
          row.status !== SubscriptionStatus.EXPIRED
      )
      .map((row) => row.id);

    if (expiredIds.length > 0) {
      await this.prisma.subscription.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: SubscriptionStatus.EXPIRED }
      });
      for (const row of subscriptions) {
        if (expiredIds.includes(row.id)) {
          row.status = SubscriptionStatus.EXPIRED;
        }
      }
    }

    const subscription = pickEffectiveSubscriptionForAccess(subscriptions, now);
    if (!subscription) {
      const pending = pickPendingActivationSubscription(
        subscriptions.filter((row) => row.plan.tier !== PlanTier.STARTER)
      );
      if (pending) {
        return {
          status: "PENDING_ACTIVATION",
          requiresPlanActivation: true,
          activationUrl: pending.customAccessUrl || null,
          plan: pending.plan,
          accessGranted: false,
          accessExpired: false
        };
      }

      const expired = [...subscriptions]
        .filter(
          (row) =>
            row.status === SubscriptionStatus.EXPIRED ||
            (row.endDate != null && row.endDate.getTime() <= now.getTime())
        )
        .sort((a, b) => (b.endDate?.getTime() || 0) - (a.endDate?.getTime() || 0))[0];

      if (expired) {
        return {
          status: "EXPIRED",
          plan: expired.plan,
          startDate: expired.startDate,
          endDate: expired.endDate,
          expiresInDays: 0,
          customAccessUrl: expired.customAccessUrl,
          requiresPlanActivation: false,
          accessGranted: false,
          accessExpired: true
        };
      }

      return {
        status: "NONE",
        requiresPlanActivation: false,
        activationUrl: null,
        plan: null,
        accessGranted: false,
        accessExpired: false
      };
    }

    const expiresInDays =
      subscription.endDate && subscription.endDate > now
        ? calendarDaysRemaining(subscription.endDate, now)
        : 0;

    return {
      status: subscription.status,
      plan: subscription.plan,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      expiresInDays,
      customAccessUrl: subscription.customAccessUrl,
      requiresPlanActivation: false,
      accessGranted: true,
      accessExpired: false
    };
  }

  async getDashboard(userId: string) {
    const [subscriptions, retainedResults, recentAttempts, activeAttempt] = await Promise.all([
      this.prisma.subscription.findMany({
        where: {
          userId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED] }
        },
        include: { plan: true }
      }),
      this.prisma.testResult.findMany({
        where: { userId },
        include: { test: true },
        orderBy: { completedAt: "desc" }
      }),
      this.prisma.testAttempt.findMany({
        where: {
          userId,
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] }
        },
        include: { test: true },
        orderBy: { updatedAt: "desc" },
        take: 10
      }),
      this.prisma.testAttempt.findFirst({
        where: { userId, status: AttemptStatus.IN_PROGRESS },
        include: { test: true },
        orderBy: { updatedAt: "desc" }
      })
    ]);
    const subscription = pickEffectiveSubscriptionForAccess(subscriptions);

    const totalAttempts = await this.prisma.testAttempt.count({
      where: {
        userId,
        status: {
          in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED]
        }
      }
    });

    const averageScore =
      retainedResults.length > 0
        ? Math.round(retainedResults.reduce((sum, result) => sum + result.score, 0) / retainedResults.length)
        : 0;

    const latestResult = retainedResults[0] ?? null;
    const readingResults = retainedResults.filter((result) => result.test.type === TestType.READING);
    const listeningResults = retainedResults.filter((result) => result.test.type === TestType.LISTENING);

    return {
      subscription,
      summary: {
        totalAttempts,
        retainedResults: retainedResults.length,
        averageScore,
        nasirBand: latestResult?.bandLabel || null,
        passProbability: latestResult?.passProbability || 0
      },
      breakdown: {
        readingAverage: this.average(readingResults.map((result) => result.score)),
        listeningAverage: this.average(listeningResults.map((result) => result.score))
      },
      retainedResults,
      recentAttempts,
      activeAttempt
    };
  }

  async selectPlan(userId: string, dto: SelectPlanDto, context?: RequestAuditContext) {
    const plan = dto.planId
      ? await this.prisma.plan.findUnique({ where: { id: dto.planId } })
      : dto.tier
        ? await this.prisma.plan.findFirst({ where: { tier: dto.tier, isActive: true } })
        : null;
    if (!plan || !plan.isActive) {
      throw new NotFoundException("Plan not found");
    }

    const subscription = await this.assignPlanToUser(userId, plan.id);

    // Paid / custom plans: assign only. The 60-day window starts after activation-link OTP.
    if (plan.tier !== PlanTier.STARTER) {
      await this.auditService.record({
        ...context,
        actorUserId: context?.actorUserId || userId,
        action: "subscription.plan_assigned_pending_activation",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          planId: plan.id,
          planTier: plan.tier
        }
      });

      return {
        redirectTo: "/portal",
        subscription,
        plan,
        requiresPlanActivation: true
      };
    }

    const activated = await this.activateSubscriptionById(subscription.id);
    await this.expireOtherSubscriptions(userId, activated.id);

    await this.auditService.record({
      ...context,
      actorUserId: context?.actorUserId || userId,
      action: "subscription.plan_selected",
      entityType: "Subscription",
      entityId: activated.id,
      metadata: {
        planId: plan.id,
        planTier: plan.tier
      }
    });

    return {
      redirectTo: "/portal",
      subscription: activated,
      plan: activated.plan
    };
  }

  /**
   * Admin: move a candidate onto a different Complete Course plan — the upgrade
   * / downgrade control on the Subscribed Candidates table.
   *
   * Distinct from assignPlanToUser, which is the CHECKOUT path and deliberately
   * parks the subscription pending an OTP. An admin changing someone's plan is
   * an explicit grant, so it takes effect immediately: an already-activated
   * student is never bounced back to "activate your account", and one who had
   * not activated yet is activated by this action.
   *
   * The access window restarts from now for `days` (default: the new plan's own
   * durationDays), so a downgrade genuinely shortens access instead of leaving
   * the longer plan's end date in place.
   */
  async adminChangePlan(userId: string, planId: string, daysOverride?: number | null) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found");

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");

    const now = new Date();
    const days = daysOverride != null && daysOverride > 0
      ? Math.round(daysOverride)
      : plan.durationDays || 60;
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const existing = await this.prisma.subscription.findMany({
      where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED] } },
      include: { plan: { select: { tier: true } } },
      orderBy: { createdAt: "desc" }
    });
    // Prefer the row that already carries their paid access; fall back to the
    // STARTER row from signup so an upgrade reuses it rather than leaving a live
    // trial alongside the new plan.
    const current =
      existing.find((s) => s.plan.tier !== PlanTier.STARTER) ??
      existing.find((s) => s.plan.tier === PlanTier.STARTER) ??
      null;

    const subscription = await this.prisma.$transaction(async (tx) => {
      // (userId, planId) is unique — clear any other row already on the target
      // plan before moving this one onto it.
      const collision = await tx.subscription.findUnique({
        where: { userId_planId: { userId, planId } }
      });
      if (collision && collision.id !== current?.id) {
        await tx.subscription.delete({ where: { id: collision.id } });
      }

      const data = {
        planId,
        status: SubscriptionStatus.ACTIVE,
        startDate: current?.startDate ?? now,
        endDate,
        otpVerifiedAt: current?.otpVerifiedAt ?? now,
        trialUsed: plan.tier !== PlanTier.STARTER ? true : current?.trialUsed ?? false
      };

      return current
        ? tx.subscription.update({ where: { id: current.id }, data })
        : tx.subscription.create({ data: { userId, ...data } });
    });

    this.logger.log(`admin changed plan for user=${userId} -> plan=${plan.name} (${days}d)`);
    return {
      subscriptionId: subscription.id,
      plan: { id: plan.id, name: plan.name, tier: plan.tier },
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate
    };
  }

  /**
   * Admin: end a candidate's Complete Course plan. Any single-skill course
   * entitlements they hold are untouched — this is the "downgrade to their
   * individual courses" action, not a full revoke.
   */
  async adminCancelPlan(userId: string) {
    const result = await this.prisma.subscription.updateMany({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
        plan: { tier: { not: PlanTier.STARTER } }
      },
      // The enum has no CANCELLED member; EXPIRED with an endDate of now is how
      // the rest of the codebase represents "access has ended".
      data: { status: SubscriptionStatus.EXPIRED, endDate: new Date() }
    });
    this.logger.log(`admin ended plan for user=${userId} (${result.count} subscription(s))`);
    return { cancelled: result.count };
  }

  /**
   * Admin: cancel EVERYTHING this candidate has, in one action — the Complete
   * Course plan, the free-trial row, and every single-skill course.
   *
   * adminCancelPlan deliberately spares the individual courses; this does not.
   * It is the "cut this student off now" control.
   *
   * It takes effect immediately: access is never baked into the login token,
   * every gate re-reads `endDate > now` from the database on each request, so
   * the student loses the portal on their next action without being logged out.
   *
   * Reversible from the same dialog by re-applying a plan or re-granting a
   * course. Remaining days are NOT banked — reinstating starts a fresh window.
   */
  async adminEndAllAccess(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");

    const now = new Date();
    const [subscriptions, entitlements] = await this.prisma.$transaction([
      this.prisma.subscription.updateMany({
        where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
        // No CANCELLED member on the enum; EXPIRED with endDate=now is how the
        // rest of the codebase represents "access has ended".
        data: { status: SubscriptionStatus.EXPIRED, endDate: now }
      }),
      this.prisma.entitlement.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { status: "REVOKED", endDate: now }
      })
    ]);

    this.logger.log(
      `admin ended ALL access for user=${userId} (${subscriptions.count} subscription(s), ${entitlements.count} course(s))`
    );
    return { subscriptions: subscriptions.count, courses: entitlements.count };
  }

  async assignPlanToUser(
    userId: string,
    planId: string,
    options?: {
      customAccessUrl?: string;
    }
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    const data: Prisma.SubscriptionUncheckedCreateInput = {
      userId,
      planId,
      status: SubscriptionStatus.TRIAL,
      customAccessUrl: options?.customAccessUrl,
      trialUsed: plan.tier !== PlanTier.STARTER
    };

    return this.prisma.subscription.upsert({
      where: {
        userId_planId: {
          userId,
          planId
        }
      },
      update: {
        status: data.status,
        startDate: null,
        endDate: null,
        otpVerifiedAt: null,
        customAccessUrl: options?.customAccessUrl,
        trialUsed: data.trialUsed
      },
      create: data
    });
  }

  /**
   * After paid checkout: if the user is on free trial (STARTER), rewrite that same
   * subscription row onto the purchased plan (pending activation). Access starts only
   * after they open the email link and enter the OTP.
   */
  private async assignPurchasedPlanToUser(
    userId: string,
    planId: string,
    options?: {
      customAccessUrl?: string;
    }
  ): Promise<{ subscription: { id: string }; upgradedFromTrial: boolean }> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    if (plan.tier === PlanTier.STARTER) {
      const subscription = await this.assignPlanToUser(userId, planId, options);
      return { subscription, upgradedFromTrial: false };
    }

    const starterPlan = await this.prisma.plan.findFirst({ where: { tier: PlanTier.STARTER } });
    const starterSubscription = starterPlan
      ? await this.prisma.subscription.findFirst({
          where: {
            userId,
            planId: starterPlan.id,
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
          }
        })
      : null;

    if (!starterSubscription) {
      const subscription = await this.assignPlanToUser(userId, planId, options);
      return { subscription, upgradedFromTrial: false };
    }

    const subscription = await this.prisma.$transaction(async (tx) => {
      const existingTarget = await tx.subscription.findUnique({
        where: {
          userId_planId: {
            userId,
            planId
          }
        }
      });

      // Free unique (userId, planId) before rewriting the STARTER row onto this plan.
      if (existingTarget && existingTarget.id !== starterSubscription.id) {
        await tx.subscription.delete({ where: { id: existingTarget.id } });
      }

      return tx.subscription.update({
        where: { id: starterSubscription.id },
        data: {
          planId,
          status: SubscriptionStatus.TRIAL,
          startDate: null,
          endDate: null,
          otpVerifiedAt: null,
          trialUsed: true,
          customAccessUrl: options?.customAccessUrl
        }
      });
    });

    await this.expireOtherSubscriptions(userId, subscription.id);

    return { subscription, upgradedFromTrial: true };
  }

  async createPurchaseIntent(dto: CreatePurchaseIntentDto, context?: RequestAuditContext) {
    const { user, plan } = await this.getUserAndPlanOrThrow(dto.userId, dto.planId);
    const upgradedFromTrial = plan.tier !== PlanTier.STARTER && (await this.userHasActiveStarterTrial(user.id));
    const purchase = await this.prisma.purchase.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: plan.price,
        currency: plan.currency,
        status: PurchaseStatus.PENDING,
        provider: dto.provider || "STAGING_MANUAL",
        reference: dto.reference || `staging-${Date.now()}`,
        checkoutSessionId: randomUUID(),
        upgradedFromTrial
      }
    });

    await this.auditService.record({
      ...context,
      action: "purchase.intent_created",
      entityType: "Purchase",
      entityId: purchase.id,
      metadata: {
        userId: user.id,
        planId: plan.id,
        provider: purchase.provider,
        reference: purchase.reference,
        upgradedFromTrial
      }
    });

    const appUrl = resolveAppUrl((k) => this.configService.get<string>(k));

    if (dto.provider === "STRIPE") {
      if (!this.stripeService.isConfigured()) {
        throw new BadRequestException("Stripe is not configured");
      }

      const session = await this.stripeService.createCheckoutSession({
        purchaseId: purchase.id,
        planName: plan.name,
        amountMinor: this.stripeService.toMinorUnits(plan.price, plan.currency),
        currency: plan.currency,
        customerEmail: user.email,
        userId: user.id,
        planId: plan.id,
        successUrl: `${appUrl}/checkout/success?purchase=${purchase.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/checkout/cancel?purchase=${purchase.id}`
      });

      const updated = await this.prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          provider: "STRIPE",
          reference: session.id,
          checkoutSessionId: session.id
        }
      });

      return {
        purchase: updated,
        checkoutUrl: session.url
      };
    }

    return {
      purchase,
      checkoutUrl: `${appUrl}/checkout?purchase=${purchase.id}`
    };
  }

  async retryPurchase(purchaseId: string, context?: RequestAuditContext) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId }
    });

    if (!purchase) {
      throw new NotFoundException("Purchase not found");
    }

    if (purchase.status === PurchaseStatus.COMPLETED) {
      throw new BadRequestException("Completed purchases cannot be retried");
    }

    const updated = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: PurchaseStatus.PENDING,
        retryCount: { increment: 1 },
        failureReason: null,
        receiptUrl: null,
        receiptData: Prisma.JsonNull,
        webhookEventId: null,
        webhookPayload: Prisma.JsonNull,
        webhookReceivedAt: null,
        checkoutSessionId: randomUUID()
      }
    });

    await this.auditService.record({
      ...context,
      action: "purchase.retry_requested",
      entityType: "Purchase",
      entityId: purchase.id,
      metadata: {
        retryCount: updated.retryCount,
        status: updated.status
      }
    });

    return updated;
  }

  async retryPurchaseForActor(
    purchaseId: string,
    actor: {
      userId: string;
      role: string;
    },
    context?: RequestAuditContext
  ) {
    await this.getPurchaseForActor(purchaseId, actor);
    return this.retryPurchase(purchaseId, context);
  }

  async resolvePurchaseForActor(
    purchaseId: string,
    dto: ResolvePurchaseDto,
    actor: {
      userId: string;
      role: string;
    },
    context?: RequestAuditContext
  ) {
    await this.getPurchaseForActor(purchaseId, actor);
    return this.handleMockPurchaseWebhook(
      {
        purchaseId,
        ...dto
      },
      context
    );
  }

  /**
   * Completes a Stripe purchase when the candidate returns from Checkout.
   * Used when local webhooks cannot reach the API (common in local/dev).
   * If the webhook already completed the purchase and emailed OTP, do not send again.
   */
  async confirmStripeCheckout(dto: { purchaseId?: string; sessionId: string }, context?: RequestAuditContext) {
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException("Stripe is not configured");
    }

    const session = await this.stripeService.retrieveCheckoutSession(dto.sessionId);
    const purchaseId =
      dto.purchaseId ||
      session.metadata?.purchaseId ||
      (typeof session.client_reference_id === "string" ? session.client_reference_id : undefined);

    if (!purchaseId) {
      throw new BadRequestException("Stripe session is missing purchase reference");
    }

    if (dto.purchaseId && dto.purchaseId !== purchaseId) {
      throw new BadRequestException("Stripe session does not match this purchase");
    }

    const paymentStatus = session.payment_status;
    if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
      throw new BadRequestException(`Stripe payment is not complete yet (status: ${paymentStatus})`);
    }

    const receiptData = {
      sessionId: session.id,
      paymentIntent: session.payment_intent ?? null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      confirmedFrom: "checkout_success_page"
    };

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { plan: true, user: true }
    });
    if (!purchase) {
      throw new NotFoundException("Purchase not found");
    }

    if (purchase.status === PurchaseStatus.COMPLETED) {
      // Webhook usually finishes first and already sent the activation email.
      // Only resend if that first send never happened.
      if (purchase.emailSentAt) {
        return {
          purchase,
          activationUrl: purchase.activationUrl,
          alreadyCompleted: true as const,
          emailDelivered: true as const,
          activationEmail: {
            toName: purchase.user.name,
            toEmail: purchase.user.email,
            planName: purchase.plan.name,
            activationUrl: purchase.activationUrl || "",
            purchaseId: purchase.id
          }
        };
      }

      const emailed = await this.sendPurchaseActivationEmail(purchaseId, context);
      return {
        purchase: emailed.purchase,
        activationUrl: emailed.activationUrl,
        otp: emailed.otp,
        activationEmail: emailed.activationEmail,
        alreadyCompleted: true as const,
        emailDelivered: true as const
      };
    }

    return this.handleMockPurchaseWebhook(
      {
        purchaseId,
        status: "COMPLETED",
        provider: "STRIPE",
        reference: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
        eventId: `checkout-return-${session.id}`,
        receiptData
      },
      context
    );
  }

  async handleStripeEvent(event: StripeEvent, context?: RequestAuditContext): Promise<{ handled: boolean }> {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as unknown as StripeCheckoutSession;
        const purchaseId = session.metadata?.purchaseId ?? session.client_reference_id ?? undefined;
        if (!purchaseId) {
          this.logger.warn(`Stripe event ${event.id} (${event.type}) missing purchaseId`);
          return { handled: false };
        }

        await this.handleMockPurchaseWebhook(
          {
            purchaseId,
            status: "COMPLETED",
            provider: "STRIPE",
            reference: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
            eventId: event.id,
            receiptData: {
              sessionId: session.id,
              paymentIntent: session.payment_intent ?? null,
              amountTotal: session.amount_total ?? null,
              currency: session.currency ?? null
            }
          },
          context
        );

        return { handled: true };
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as unknown as StripeCheckoutSession;
        const purchaseId = session.metadata?.purchaseId ?? session.client_reference_id ?? undefined;
        if (!purchaseId) {
          this.logger.warn(`Stripe event ${event.id} (${event.type}) missing purchaseId`);
          return { handled: false };
        }

        await this.handleMockPurchaseWebhook(
          {
            purchaseId,
            status: "FAILED",
            provider: "STRIPE",
            eventId: event.id,
            failureReason: event.type
          },
          context
        );

        return { handled: true };
      }
      default:
        this.logger.log(`Ignoring unhandled Stripe event type ${event.type}`);
        return { handled: false };
    }
  }

  async handleMockPurchaseWebhook(dto: HandlePurchaseWebhookDto, context?: RequestAuditContext) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: dto.purchaseId },
      include: {
        user: true,
        plan: true
      }
    });

    if (!purchase) {
      throw new NotFoundException("Purchase not found");
    }

    if (dto.status === "FAILED") {
      const failed = await this.prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          status: PurchaseStatus.FAILED,
          provider: dto.provider || purchase.provider || "STAGING_MANUAL",
          reference: dto.reference || purchase.reference,
          failureReason: dto.failureReason || "Payment failed",
          webhookEventId: dto.eventId,
          webhookPayload: dto as unknown as Prisma.InputJsonValue,
          webhookReceivedAt: new Date()
        }
      });

      await this.auditService.record({
        ...context,
        action: "purchase.failed",
        entityType: "Purchase",
        entityId: failed.id,
        metadata: {
          failureReason: failed.failureReason,
          provider: failed.provider
        }
      });

      return { purchase: failed };
    }

    if (purchase.status === PurchaseStatus.COMPLETED) {
      const updated = await this.prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          webhookEventId: dto.eventId || purchase.webhookEventId,
          webhookPayload: dto as unknown as Prisma.InputJsonValue,
          webhookReceivedAt: new Date(),
          receiptUrl: dto.receiptUrl || purchase.receiptUrl,
          receiptData:
            (dto.receiptData as Prisma.InputJsonValue | undefined) ||
            (purchase.receiptData as Prisma.InputJsonValue | undefined)
        }
      });

      return {
        purchase: updated,
        activationUrl: updated.activationUrl,
        otp: undefined,
        alreadyCompleted: true as const
      };
    }

    return this.completePurchaseInternal(
      purchase.id,
      {
        provider: dto.provider,
        reference: dto.reference,
        receiptUrl: dto.receiptUrl,
        receiptData: dto.receiptData as Prisma.InputJsonValue | undefined,
        webhookEventId: dto.eventId,
        webhookPayload: dto as unknown as Prisma.InputJsonValue
      },
      context
    );
  }

  async sendPurchaseSuccessEmail(dto: SendPurchaseEmailDto, context?: RequestAuditContext) {
    const intent = await this.createPurchaseIntent(
      {
        userId: dto.userId,
        planId: dto.planId,
        provider: dto.provider || "MANUAL_OVERRIDE",
        reference: dto.reference
      },
      context
    );

    return this.completePurchaseInternal(
      intent.purchase.id,
      {
        provider: dto.provider || "MANUAL_OVERRIDE",
        reference: dto.reference,
        webhookEventId: `manual-${randomUUID()}`
      },
      context
    );
  }

  private async completePurchaseInternal(
    purchaseId: string,
    data: {
      provider?: string;
      reference?: string;
      receiptUrl?: string;
      receiptData?: Prisma.InputJsonValue;
      webhookEventId?: string;
      webhookPayload?: Prisma.InputJsonValue;
    },
    context?: RequestAuditContext
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: true,
        plan: true
      }
    });

    if (!purchase) {
      throw new NotFoundException("Purchase not found");
    }

    // Always rebuild from current NEXT_PUBLIC_APP_URL (avoids stale production links in local/dev).
    const activationToken = purchase.activationToken || randomUUID();
    const activationUrl = this.buildActivationUrl(activationToken, purchase.user.email, purchase.plan.tier);

    const assignment = await this.assignPurchasedPlanToUser(purchase.userId, purchase.planId, {
      customAccessUrl: activationUrl
    });

    const otp = await this.authService.issueOtpForUser(purchase.user.id, OTPPurpose.SUBSCRIPTION_ACTIVATION, {
      activationUrl,
      planName: purchase.plan.name
    });

    const updated = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: PurchaseStatus.COMPLETED,
        provider: data.provider || purchase.provider || "STAGING_MANUAL",
        reference: data.reference || purchase.reference,
        activationToken,
        activationUrl,
        failureReason: null,
        receiptUrl: data.receiptUrl || purchase.receiptUrl,
        receiptData: data.receiptData || undefined,
        webhookEventId: data.webhookEventId || purchase.webhookEventId,
        webhookPayload: data.webhookPayload || undefined,
        webhookReceivedAt: new Date(),
        completedAt: purchase.completedAt || new Date(),
        emailSentAt: new Date(),
        upgradedFromTrial:
          assignment.upgradedFromTrial || asPurchaseTrialUpgradeFields(purchase).upgradedFromTrial
      }
    });

    const upgradedFromTrial =
      assignment.upgradedFromTrial || asPurchaseTrialUpgradeFields(updated).upgradedFromTrial;

    await this.auditService.record({
      ...context,
      actorUserId: context?.actorUserId || purchase.user.id,
      action: upgradedFromTrial ? "purchase.completed_trial_upgrade" : "purchase.completed",
      entityType: "Purchase",
      entityId: purchase.id,
      metadata: {
        planId: purchase.plan.id,
        userId: purchase.user.id,
        provider: updated.provider,
        activationUrl,
        subscriptionId: assignment.subscription.id,
        upgradedFromTrial,
        emailDelivered: true
      }
    });

    return {
      purchase: {
        ...updated,
        upgradedFromTrial,
        purchaseKind: upgradedFromTrial ? ("TRIAL_UPGRADE" as const) : ("DIRECT_PAID" as const)
      },
      activationUrl,
      otp,
      upgradedFromTrial,
      activationEmail: {
        toName: purchase.user.name,
        toEmail: purchase.user.email,
        planName: purchase.plan.name,
        otp,
        activationUrl,
        purchaseId: purchase.id
      }
    };
  }

  private async userHasActiveStarterTrial(userId: string) {
    const starterPlan = await this.prisma.plan.findFirst({ where: { tier: PlanTier.STARTER } });
    if (!starterPlan) return false;

    const starterSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        planId: starterPlan.id,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
      },
      select: { id: true }
    });

    return Boolean(starterSubscription);
  }

  /** Send / resend activation OTP email for an existing purchase (SES). */
  async sendPurchaseActivationEmail(purchaseId: string, context?: RequestAuditContext) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { user: true, plan: true }
    });
    if (!purchase) {
      throw new NotFoundException("Purchase not found");
    }

    const activationToken = purchase.activationToken || randomUUID();
    const activationUrl = this.buildActivationUrl(activationToken, purchase.user.email, purchase.plan.tier);

    await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { activationToken, activationUrl }
    });
    await this.prisma.subscription.updateMany({
      where: { userId: purchase.userId, planId: purchase.planId },
      data: { customAccessUrl: activationUrl }
    });

    const otp = await this.authService.issueOtpForUser(purchase.user.id, OTPPurpose.SUBSCRIPTION_ACTIVATION, {
      activationUrl,
      planName: purchase.plan.name
    });

    const updated = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { emailSentAt: new Date() }
    });

    await this.auditService.record({
      ...context,
      actorUserId: context?.actorUserId || purchase.user.id,
      action: "purchase.activation_email_sent",
      entityType: "Purchase",
      entityId: purchase.id,
      metadata: { activationUrl, toEmail: purchase.user.email }
    });

    return {
      purchase: updated,
      activationUrl,
      otp,
      activationEmail: {
        toName: purchase.user.name,
        toEmail: purchase.user.email,
        planName: purchase.plan.name,
        otp,
        activationUrl,
        purchaseId: purchase.id
      }
    };
  }

  private async getUserAndPlanOrThrow(userId: string, planId: string) {
    const [user, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.plan.findUnique({ where: { id: planId } })
    ]);

    if (!user || !plan) {
      throw new NotFoundException("User or plan not found");
    }

    return { user, plan };
  }

  private buildActivationUrl(token: string, email?: string, planTier?: PlanTier) {
    const appUrl = resolveAppUrl((k) => this.configService.get<string>(k));
    const returnTo = planTier ? `/portal?activated=${planTier.toLowerCase()}` : "/portal?purchase=activated";
    const params = new URLSearchParams({
      activation: token,
      returnTo
    });

    if (email) {
      params.set("email", email);
    }

    return `${appUrl}/auth/activate?${params.toString()}`;
  }

  private async expireOtherSubscriptions(userId: string, keepSubscriptionId: string) {
    const now = new Date();
    await this.prisma.subscription.updateMany({
      where: {
        userId,
        id: { not: keepSubscriptionId },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
        endDate: now
      }
    });
  }

  private async activateSubscriptionById(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true }
    });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    if (subscription.otpVerifiedAt && subscription.startDate && subscription.endDate) {
      return subscription;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (subscription.plan.durationDays || 60));

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status:
          subscription.plan.tier === PlanTier.STARTER ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        otpVerifiedAt: startDate,
        trialUsed: subscription.plan.tier === PlanTier.STARTER ? true : subscription.trialUsed
      },
      include: { plan: true }
    });
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return 0;
    }
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
}
