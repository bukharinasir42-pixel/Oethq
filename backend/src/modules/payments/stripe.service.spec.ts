import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import type { AppConfig } from "../../common/app-config";
import { STRIPE_API_VERSION, StripeNotConfiguredError, StripeService, type StripeEvent } from "./stripe.service";

const mockCreateCheckoutSession = jest.fn();
const mockConstructWebhookEvent = jest.fn();

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreateCheckoutSession
      }
    },
    webhooks: {
      constructEvent: mockConstructWebhookEvent
    }
  }))
);

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

describe("StripeService", () => {
  beforeEach(() => {
    mockCreateCheckoutSession.mockReset();
    mockConstructWebhookEvent.mockReset();
    (Stripe as unknown as jest.MockedClass<typeof Stripe>).mockClear();
  });

  it("reflects whether Stripe is configured", () => {
    expect(new StripeService(config()).isConfigured()).toBe(false);
    expect(new StripeService(config({ STRIPE_SECRET_KEY: "sk_test_123" })).isConfigured()).toBe(true);
  });

  it("reflects whether Stripe webhooks are configured", () => {
    expect(new StripeService(config()).isWebhookConfigured()).toBe(false);
    expect(new StripeService(config({ STRIPE_WEBHOOK_SECRET: "whsec_123" })).isWebhookConfigured()).toBe(true);
  });

  describe("toMinorUnits", () => {
    it("converts decimal amounts to integer minor units", () => {
      const service = new StripeService(config());

      expect(service.toMinorUnits(new Prisma.Decimal("87.00"), "USD")).toBe(8700);
      expect(service.toMinorUnits(213.5, "USD")).toBe(21350);
      expect(service.toMinorUnits("10.005", "USD")).toBe(1001);
    });
  });

  describe("createCheckoutSession", () => {
    const params = {
      purchaseId: "purchase-123",
      planName: "Foundation",
      amountMinor: 8700,
      currency: "USD",
      customerEmail: "candidate@example.com",
      userId: "user-123",
      planId: "plan-123",
      successUrl: "https://app.example.com/checkout/success?purchase=purchase-123&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.example.com/checkout/cancel?purchase=purchase-123"
    };

    it("creates a payment-mode Checkout Session and returns its id and url", async () => {
      mockCreateCheckoutSession.mockResolvedValue({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      });

      const service = new StripeService(config({ STRIPE_SECRET_KEY: "sk_test_123" }));

      await expect(service.createCheckoutSession(params)).resolves.toEqual({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      });

      expect(Stripe).toHaveBeenCalledWith("sk_test_123", { apiVersion: STRIPE_API_VERSION });
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Foundation"
              },
              unit_amount: 8700
            },
            quantity: 1
          }
        ],
        customer_email: "candidate@example.com",
        client_reference_id: "purchase-123",
        metadata: {
          purchaseId: "purchase-123",
          userId: "user-123",
          planId: "plan-123"
        },
        payment_intent_data: {
          metadata: {
            purchaseId: "purchase-123",
            userId: "user-123",
            planId: "plan-123"
          }
        },
        success_url:
          "https://app.example.com/checkout/success?purchase=purchase-123&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://app.example.com/checkout/cancel?purchase=purchase-123"
      });
    });

    it("throws a typed error when the secret key is missing", async () => {
      const service = new StripeService(config());

      await expect(service.createCheckoutSession(params)).rejects.toBeInstanceOf(StripeNotConfiguredError);
      expect(Stripe).not.toHaveBeenCalled();
      expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
    });

    it("throws when Stripe does not return a Checkout Session URL", async () => {
      mockCreateCheckoutSession.mockResolvedValue({
        id: "cs_test_123",
        url: null
      });
      const service = new StripeService(config({ STRIPE_SECRET_KEY: "sk_test_123" }));

      await expect(service.createCheckoutSession(params)).rejects.toThrow(
        "Stripe Checkout Session did not include a URL"
      );
    });
  });

  describe("constructWebhookEvent", () => {
    it("constructs a Stripe event from the raw payload, signature, and webhook secret", () => {
      const payload = Buffer.from("{\"id\":\"evt_123\"}");
      const event = { id: "evt_123", type: "checkout.session.completed" } as unknown as StripeEvent;
      mockConstructWebhookEvent.mockReturnValue(event);
      const service = new StripeService(
        config({ STRIPE_SECRET_KEY: "sk_test_123", STRIPE_WEBHOOK_SECRET: " whsec_123 " })
      );

      expect(service.constructWebhookEvent(payload, "sig_123")).toBe(event);

      expect(Stripe).toHaveBeenCalledWith("sk_test_123", { apiVersion: STRIPE_API_VERSION });
      expect(mockConstructWebhookEvent).toHaveBeenCalledWith(payload, "sig_123", "whsec_123");
    });

    it("throws a typed error when the webhook secret is missing", () => {
      const service = new StripeService(config({ STRIPE_SECRET_KEY: "sk_test_123" }));

      expect(() => service.constructWebhookEvent(Buffer.from("{}"), "sig_123")).toThrow(
        StripeNotConfiguredError
      );
      expect(Stripe).not.toHaveBeenCalled();
      expect(mockConstructWebhookEvent).not.toHaveBeenCalled();
    });
  });
});
