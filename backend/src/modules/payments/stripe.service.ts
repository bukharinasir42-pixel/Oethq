import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import type { AppConfig } from "../../common/app-config";
import { BadRequestException } from "../../common/http-exception";

export const STRIPE_API_VERSION = "2024-09-30.acacia";
type StripeClientConfig = NonNullable<ConstructorParameters<typeof Stripe>[1]>;

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF"
]);

export class StripeNotConfiguredError extends BadRequestException {
  constructor() {
    super("Stripe is not configured");
    this.name = "StripeNotConfiguredError";
  }
}

export type CreateCheckoutSessionParams = {
  purchaseId: string;
  planName: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
};

type StripeClient = InstanceType<typeof Stripe>;
export type StripeEvent = ReturnType<StripeClient["webhooks"]["constructEvent"]>;
export type StripeCheckoutSession = Awaited<ReturnType<StripeClient["checkout"]["sessions"]["retrieve"]>>;

export class StripeService {
  private stripeClient?: StripeClient;

  constructor(private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return Boolean(this.getSecretKey());
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.config.get<string>("STRIPE_WEBHOOK_SECRET"));
  }

  toMinorUnits(amount: Prisma.Decimal | string | number, currency: string): number {
    const factor = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
    return new Prisma.Decimal(amount)
      .mul(factor)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ id: string; url: string }> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: params.planName
            },
            unit_amount: params.amountMinor
          },
          quantity: 1
        }
      ],
      customer_email: params.customerEmail,
      client_reference_id: params.purchaseId,
      metadata: {
        purchaseId: params.purchaseId,
        userId: params.userId,
        planId: params.planId
      },
      payment_intent_data: {
        metadata: {
          purchaseId: params.purchaseId,
          userId: params.userId,
          planId: params.planId
        }
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl
    });

    if (!session.url) {
      throw new BadRequestException("Stripe Checkout Session did not include a URL");
    }

    return { id: session.id, url: session.url };
  }

  async retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  constructWebhookEvent(payload: Buffer | string, signature: string): StripeEvent {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET")?.trim();
    if (!secret) {
      throw new StripeNotConfiguredError();
    }

    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  private get stripe(): StripeClient {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new StripeNotConfiguredError();
    }

    this.stripeClient ??= new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION as StripeClientConfig["apiVersion"]
    });

    return this.stripeClient;
  }

  private getSecretKey(): string | undefined {
    return this.config.get<string>("STRIPE_SECRET_KEY")?.trim() || undefined;
  }
}
