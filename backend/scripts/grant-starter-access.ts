import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PlanTier, PrismaClient, SubscriptionStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const envBackend = resolve(__dirname, "../.env");
if (existsSync(envBackend)) loadEnv({ path: envBackend });

const email = process.argv[2] || "taimoor@gmail.com";
const durationDays = Number(process.argv[3] || 5);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true }
  });
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const plan = await prisma.plan.findFirst({ where: { tier: PlanTier.STARTER } });
  if (!plan) {
    throw new Error("STARTER plan not found");
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);

  const subscription = await prisma.subscription.upsert({
    where: {
      userId_planId: {
        userId: user.id,
        planId: plan.id
      }
    },
    update: {
      status: SubscriptionStatus.TRIAL,
      startDate,
      endDate,
      otpVerifiedAt: startDate,
      trialUsed: true
    },
    create: {
      userId: user.id,
      planId: plan.id,
      status: SubscriptionStatus.TRIAL,
      startDate,
      endDate,
      otpVerifiedAt: startDate,
      trialUsed: true
    }
  });

  console.log(
    JSON.stringify(
      {
        email: user.email,
        plan: plan.name,
        tier: plan.tier,
        grantedDays: durationDays,
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
