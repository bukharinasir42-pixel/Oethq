require("dotenv").config({ path: ".env" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

void (async () => {
  const email = "osama13@endtest-mail.io";
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, emailVerifiedAt: true }
  });

  if (!user) {
    console.log(JSON.stringify({ email, userExists: false, purchases: [] }, null, 2));
    await prisma.$disconnect();
    return;
  }

  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { name: true, tier: true } } }
  });

  console.log(
    JSON.stringify(
      {
        userExists: true,
        user,
        purchaseCount: purchases.length,
        purchases: purchases.map((r) => ({
          id: r.id,
          status: r.status,
          provider: r.provider,
          plan: r.plan.name,
          tier: r.plan.tier,
          amount: String(r.amount),
          currency: r.currency,
          emailSentAt: r.emailSentAt,
          completedAt: r.completedAt,
          activationUrl: r.activationUrl,
          createdAt: r.createdAt
        }))
      },
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
