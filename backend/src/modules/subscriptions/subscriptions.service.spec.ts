import { PlanTier, Prisma, PurchaseStatus } from "@prisma/client";
import type { AppConfig } from "../../common/app-config";
import { BadRequestException } from "../../common/http-exception";
import type { PrismaService } from "../../common/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { AuthService } from "../auth/auth.service";
import type { StripeService, StripeEvent, StripeCheckoutSession } from "../payments/stripe.service";
import { SubscriptionsService } from "./subscriptions.service";

function config(values: Record<string, string | undefined> = {}): AppConfig {
  return {
    get<T = string>(key: string, defaultValue?: T): T | undefined {
      const value = values[key];
      if (value === undefined || value === "") {
        return defaultValue;
      }
      return value as T;
    }
  };
}

function buildService({
  prisma,
  appConfig = config({ NEXT_PUBLIC_APP_URL: "https://app.example.com" }),
  stripeService
}: {
  prisma: PrismaStub;
  appConfig?: AppConfig;
  stripeService: StripeStub;
}) {
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined)
  };

  const service = new SubscriptionsService(
    prisma as unknown as PrismaService,
    {} as unknown as AuthService,
    appConfig,
    auditService as unknown as AuditService,
    stripeService as unknown as StripeService
  );

  return { service, auditService };
}

type PrismaStub = {
  user: {
    findUnique: jest.Mock;
  };
  plan: {
    findUnique: jest.Mock;
    findFirst?: jest.Mock;
  };
  subscription?: {
    findFirst: jest.Mock;
  };
  purchase: {
    create: jest.Mock;
    update: jest.Mock;
  };
};

type StripeStub = {
  isConfigured: jest.Mock;
  toMinorUnits: jest.Mock;
  createCheckoutSession: jest.Mock;
};

function minimalPrismaStub(): PrismaStub {
  return {
    user: {
      findUnique: jest.fn()
    },
    plan: {
      findUnique: jest.fn()
    },
    purchase: {
      create: jest.fn(),
      update: jest.fn()
    }
  };
}

function minimalStripeStub(): StripeStub {
  return {
    isConfigured: jest.fn(),
    toMinorUnits: jest.fn(),
    createCheckoutSession: jest.fn()
  };
}

function checkoutSession(overrides: Partial<StripeCheckoutSession> = {}): StripeCheckoutSession {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    metadata: {},
    client_reference_id: null,
    payment_intent: "pi_test_123",
    amount_total: 8700,
    currency: "usd",
    ...overrides
  } as unknown as StripeCheckoutSession;
}

function stripeEvent(type: string, session: StripeCheckoutSession = checkoutSession()): StripeEvent {
  return {
    id: "evt_123",
    object: "event",
    api_version: "2024-09-30.acacia",
    created: 1710000000,
    data: {
      object: session
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type
  } as unknown as StripeEvent;
}

function mockHandlePurchaseWebhook(service: SubscriptionsService) {
  return jest.spyOn(service, "handleMockPurchaseWebhook").mockResolvedValue({
    purchase: { id: "purchase-123" }
  } as Awaited<ReturnType<SubscriptionsService["handleMockPurchaseWebhook"]>>);
}

describe("SubscriptionsService.handleStripeEvent", () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("completes a purchase for checkout.session.completed events", async () => {
    const { service } = buildService({
      prisma: minimalPrismaStub(),
      stripeService: minimalStripeStub()
    });
    const handleMockPurchaseWebhook = mockHandlePurchaseWebhook(service);

    await expect(
      service.handleStripeEvent(
        stripeEvent(
          "checkout.session.completed",
          checkoutSession({
            metadata: { purchaseId: "purchase-123" },
            client_reference_id: "fallback-purchase-123"
          })
        )
      )
    ).resolves.toEqual({ handled: true });

    expect(handleMockPurchaseWebhook).toHaveBeenCalledTimes(1);
    expect(handleMockPurchaseWebhook).toHaveBeenCalledWith(
      {
        purchaseId: "purchase-123",
        status: "COMPLETED",
        provider: "STRIPE",
        reference: "pi_test_123",
        eventId: "evt_123",
        receiptData: {
          sessionId: "cs_test_123",
          paymentIntent: "pi_test_123",
          amountTotal: 8700,
          currency: "usd"
        }
      },
      undefined
    );
  });

  it("fails a purchase for checkout.session.expired events", async () => {
    const { service } = buildService({
      prisma: minimalPrismaStub(),
      stripeService: minimalStripeStub()
    });
    const handleMockPurchaseWebhook = mockHandlePurchaseWebhook(service);

    await expect(
      service.handleStripeEvent(
        stripeEvent(
          "checkout.session.expired",
          checkoutSession({
            client_reference_id: "purchase-123"
          })
        )
      )
    ).resolves.toEqual({ handled: true });

    expect(handleMockPurchaseWebhook).toHaveBeenCalledTimes(1);
    expect(handleMockPurchaseWebhook).toHaveBeenCalledWith(
      {
        purchaseId: "purchase-123",
        status: "FAILED",
        provider: "STRIPE",
        eventId: "evt_123",
        failureReason: "checkout.session.expired"
      },
      undefined
    );
  });

  it("ignores unknown Stripe event types", async () => {
    const { service } = buildService({
      prisma: minimalPrismaStub(),
      stripeService: minimalStripeStub()
    });
    const handleMockPurchaseWebhook = mockHandlePurchaseWebhook(service);

    await expect(service.handleStripeEvent(stripeEvent("customer.created"))).resolves.toEqual({
      handled: false
    });

    expect(handleMockPurchaseWebhook).not.toHaveBeenCalled();
  });

  it("ignores completed sessions that do not include a purchase id", async () => {
    const { service } = buildService({
      prisma: minimalPrismaStub(),
      stripeService: minimalStripeStub()
    });
    const handleMockPurchaseWebhook = mockHandlePurchaseWebhook(service);

    await expect(service.handleStripeEvent(stripeEvent("checkout.session.completed"))).resolves.toEqual({
      handled: false
    });

    expect(handleMockPurchaseWebhook).not.toHaveBeenCalled();
  });
});

describe("SubscriptionsService.createPurchaseIntent", () => {
  const user = {
    id: "user-123",
    name: "Candidate",
    email: "candidate@example.com"
  };

  const plan = {
    id: "plan-123",
    name: "Foundation",
    tier: PlanTier.FOUNDATION,
    price: new Prisma.Decimal("87.00"),
    currency: "USD"
  };

  function prismaStub(purchase: Record<string, unknown>, updatedPurchase?: Record<string, unknown>): PrismaStub {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue(user)
      },
      plan: {
        findUnique: jest.fn().mockResolvedValue(plan),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      purchase: {
        create: jest.fn().mockResolvedValue(purchase),
        update: jest.fn().mockResolvedValue(updatedPurchase ?? purchase)
      }
    };
  }

  function stripeStub(): StripeStub {
    return {
      isConfigured: jest.fn().mockReturnValue(true),
      toMinorUnits: jest.fn().mockReturnValue(8700),
      createCheckoutSession: jest.fn().mockResolvedValue({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      })
    };
  }

  it("creates a Stripe Checkout Session after the pending Purchase and returns Stripe's URL", async () => {
    const pendingPurchase = {
      id: "purchase-123",
      userId: user.id,
      planId: plan.id,
      amount: plan.price,
      currency: plan.currency,
      status: PurchaseStatus.PENDING,
      provider: "STRIPE",
      reference: "staging-before-stripe",
      checkoutSessionId: "pending-checkout-session-id"
    };
    const updatedPurchase = {
      ...pendingPurchase,
      reference: "cs_test_123",
      checkoutSessionId: "cs_test_123"
    };
    const prisma = prismaStub(pendingPurchase, updatedPurchase);
    const stripeService = stripeStub();
    const { service } = buildService({ prisma, stripeService });

    await expect(
      service.createPurchaseIntent({
        userId: user.id,
        planId: plan.id,
        provider: "STRIPE"
      })
    ).resolves.toEqual({
      purchase: updatedPurchase,
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123"
    });

    expect(stripeService.toMinorUnits).toHaveBeenCalledWith(plan.price, "USD");
    expect(prisma.purchase.create.mock.invocationCallOrder[0]).toBeLessThan(
      stripeService.createCheckoutSession.mock.invocationCallOrder[0]
    );
    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith({
      purchaseId: "purchase-123",
      planName: "Foundation",
      amountMinor: 8700,
      currency: "USD",
      customerEmail: "candidate@example.com",
      userId: "user-123",
      planId: "plan-123",
      successUrl: "https://app.example.com/checkout/success?purchase=purchase-123&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.example.com/checkout/cancel?purchase=purchase-123"
    });
    expect(prisma.purchase.update).toHaveBeenCalledWith({
      where: { id: "purchase-123" },
      data: {
        provider: "STRIPE",
        reference: "cs_test_123",
        checkoutSessionId: "cs_test_123"
      }
    });
  });

  it("keeps non-Stripe providers on the internal checkout URL", async () => {
    const pendingPurchase = {
      id: "purchase-456",
      userId: user.id,
      planId: plan.id,
      amount: plan.price,
      currency: plan.currency,
      status: PurchaseStatus.PENDING,
      provider: "STAGING_MANUAL",
      reference: "staging-reference",
      checkoutSessionId: "pending-checkout-session-id"
    };
    const prisma = prismaStub(pendingPurchase);
    const stripeService = stripeStub();
    const { service } = buildService({ prisma, stripeService });

    await expect(
      service.createPurchaseIntent({
        userId: user.id,
        planId: plan.id,
        provider: "STAGING_MANUAL"
      })
    ).resolves.toEqual({
      purchase: pendingPurchase,
      checkoutUrl: "https://app.example.com/checkout?purchase=purchase-456"
    });

    expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
    expect(prisma.purchase.update).not.toHaveBeenCalled();
  });

  it("rejects Stripe purchases when Stripe is not configured", async () => {
    const pendingPurchase = {
      id: "purchase-789",
      userId: user.id,
      planId: plan.id,
      amount: plan.price,
      currency: plan.currency,
      status: PurchaseStatus.PENDING,
      provider: "STRIPE",
      reference: "staging-reference",
      checkoutSessionId: "pending-checkout-session-id"
    };
    const prisma = prismaStub(pendingPurchase);
    const stripeService = stripeStub();
    stripeService.isConfigured.mockReturnValue(false);
    const { service } = buildService({ prisma, stripeService });

    await expect(
      service.createPurchaseIntent({
        userId: user.id,
        planId: plan.id,
        provider: "STRIPE"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.purchase.create).toHaveBeenCalled();
    expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
    expect(prisma.purchase.update).not.toHaveBeenCalled();
  });
});
