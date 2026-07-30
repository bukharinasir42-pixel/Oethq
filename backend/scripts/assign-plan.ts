import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PlanTier, PrismaClient, SubscriptionStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const envRoot = resolve(__dirname, "../../.env");
const envBackend = resolve(__dirname, "../.env");
if (existsSync(envRoot)) loadEnv({ path: envRoot });
if (existsSync(envBackend)) loadEnv({ path: envBackend, override: true });

const email = process.argv[2] || "taimoor@gmail.com";
const tierArg = (process.argv[3] || "FOUNDATION").toUpperCase() as PlanTier;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const plan = await prisma.plan.findFirst({ where: { tier: tierArg } });
  if (!plan) {
    throw new Error(`Plan not found for tier: ${tierArg}`);
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.durationDays);

  const subscription = await prisma.subscription.upsert({
    where: {
      userId_planId: {
        userId: user.id,
        planId: plan.id
      }
    },
    update: {
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
      otpVerifiedAt: startDate,
      trialUsed: tierArg !== PlanTier.STARTER
    },
    create: {
      userId: user.id,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
      otpVerifiedAt: startDate,
      trialUsed: tierArg !== PlanTier.STARTER
    }
  });

  console.log(
    JSON.stringify(
      {
        email: user.email,
        userId: user.id,
        plan: plan.name,
        tier: plan.tier,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
