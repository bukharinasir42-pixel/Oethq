/**
 * seed-demo-accounts.ts — ready-made candidate accounts, one per purchase state,
 * for manually testing how each purchase shows in the portal. Idempotent: rerun
 * any time to reset all demo accounts to their target state.
 *
 * Run: npm run db:seed-demo-accounts
 * All accounts use the password: Demo@123
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import * as bcrypt from "bcrypt";
import { PlanTier, PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const envRoot = resolve(__dirname, "../../../.env");
const envBackend = resolve(__dirname, "../../.env");
if (existsSync(envRoot)) loadEnv({ path: envRoot });
if (existsSync(envBackend)) loadEnv({ path: envBackend, override: true });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const PASSWORD = "Demo@123";
const DAY = 24 * 60 * 60 * 1000;

type State = "trial" | "reading" | "listening" | "both" | "complete";

const ACCOUNTS: { email: string; name: string; state: State }[] = [
  { email: "demo.trial@oet.test", name: "Demo — Free Trial", state: "trial" },
  { email: "demo.reading@oet.test", name: "Demo — Reading Only", state: "reading" },
  { email: "demo.listening@oet.test", name: "Demo — Listening Only", state: "listening" },
  { email: "demo.both@oet.test", name: "Demo — Reading & Listening", state: "both" },
  { email: "demo.complete@oet.test", name: "Demo — Complete Material", state: "complete" }
];

const STATE_TO_PRODUCT: Record<Exclude<State, "trial" | "complete">, string> = {
  reading: "reading",
  listening: "listening",
  both: "reading-listening"
};

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const starter = await prisma.plan.findFirst({ where: { tier: PlanTier.STARTER } });
  // Use a clearly-named paid tier for the Complete demo (Foundation is branded
  // "OET Starter" in seed data, which reads like a free trial).
  const complete =
    (await prisma.plan.findFirst({ where: { tier: PlanTier.MASTERY } })) ??
    (await prisma.plan.findFirst({ where: { tier: PlanTier.FOUNDATION } }));
  if (!starter || !complete) throw new Error("Plans not seeded — run `npm run prisma:seed` first.");
  const now = new Date();

  for (const acc of ACCOUNTS) {
    // Upsert the user.
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: { name: acc.name, passwordHash: hash, role: Role.CANDIDATE, emailVerifiedAt: now },
      create: { email: acc.email, name: acc.name, passwordHash: hash, role: Role.CANDIDATE, emailVerifiedAt: now }
    });

    // Wipe prior state so reruns are clean.
    await prisma.entitlement.deleteMany({ where: { userId: user.id } });
    await prisma.productPurchase.deleteMany({ where: { userId: user.id } });
    await prisma.subscription.deleteMany({ where: { userId: user.id } });

    if (acc.state === "trial") {
      // Active, OTP-verified free trial, no purchases (brand-new customer with
      // the Day-1 cohort preview). otpVerifiedAt is what grants trial access.
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: starter.id,
          status: "TRIAL",
          startDate: now,
          endDate: new Date(now.getTime() + starter.durationDays * DAY),
          otpVerifiedAt: now,
          trialUsed: true
        }
      });
    } else if (acc.state === "complete") {
      // Active Complete Course (Foundation), OTP verified → full portal.
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: complete.id,
          status: "ACTIVE",
          startDate: now,
          endDate: new Date(now.getTime() + complete.durationDays * DAY),
          otpVerifiedAt: now,
          trialUsed: true
        }
      });
    } else {
      // Standalone buyer whose free trial has ended → scoped standalone portal.
      const slug = STATE_TO_PRODUCT[acc.state];
      const product = await prisma.product.findUnique({ where: { slug } });
      if (!product) throw new Error(`Product ${slug} missing — run \`npm run prisma:seed-products\`.`);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: starter.id,
          status: "EXPIRED",
          startDate: new Date(now.getTime() - 30 * DAY),
          endDate: new Date(now.getTime() - 25 * DAY),
          trialUsed: true
        }
      });

      const purchase = await prisma.productPurchase.create({
        data: {
          userId: user.id,
          productId: product.id,
          amount: product.price ?? 0,
          currency: product.currency,
          status: "COMPLETED",
          provider: "STAGING_MANUAL",
          reference: `demo-${acc.state}-${now.getTime()}`,
          completedAt: now
        }
      });
      await prisma.entitlement.create({
        data: {
          userId: user.id,
          productId: product.id,
          entitlementKey: product.entitlementKey,
          source: "PRODUCT_PURCHASE",
          status: "ACTIVE",
          startDate: now,
          endDate: product.durationDays ? new Date(now.getTime() + product.durationDays * DAY) : null,
          productPurchaseId: purchase.id
        }
      });
    }

    // eslint-disable-next-line no-console
    console.log(`  ${acc.state.padEnd(10)} ${acc.email} / ${PASSWORD}`);
  }
  // eslint-disable-next-line no-console
  console.log("Demo accounts ready.");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
