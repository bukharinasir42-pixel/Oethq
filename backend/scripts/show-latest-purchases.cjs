require("dotenv").config({ path: ".env" });
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

void (async () => {
  const rows = await prisma.purchase.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      user: { select: { email: true, name: true } },
      plan: { select: { name: true, tier: true } }
    }
  });

  console.log(
    JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        provider: r.provider,
        email: r.user.email,
        name: r.user.name,
        plan: r.plan.name,
        tier: r.plan.tier,
        amount: String(r.amount),
        currency: r.currency,
        checkoutSessionId: r.checkoutSessionId,
        reference: r.reference,
        activationUrl: r.activationUrl,
        emailSentAt: r.emailSentAt,
        completedAt: r.completedAt,
        webhookEventId: r.webhookEventId,
        webhookReceivedAt: r.webhookReceivedAt,
        webhookPayload: r.webhookPayload,
        receiptData: r.receiptData,
        createdAt: r.createdAt
      })),
      null,
      2
    )
  );

  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
