/**
 * Resend purchase activation email (SES) for the latest COMPLETED purchase,
 * or a given purchase id: node scripts/resend-activation-email.cjs [purchaseId]
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const path = require("path");
const nodemailer = require("nodemailer");
const { PrismaClient } = require("@prisma/client");

const purchaseId = (process.argv[2] || "").trim();
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const prisma = new PrismaClient();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

void (async () => {
  const purchase = purchaseId
    ? await prisma.purchase.findUnique({
        where: { id: purchaseId },
        include: { user: true, plan: true }
      })
    : await prisma.purchase.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        include: { user: true, plan: true }
      });

  if (!purchase) {
    console.error("No completed purchase found");
    process.exit(1);
  }

  const activationToken = purchase.activationToken || require("crypto").randomUUID();
  const params = new URLSearchParams({
    activation: activationToken,
    email: purchase.user.email,
    returnTo: `/portal?activated=${purchase.plan.tier.toLowerCase()}`
  });
  const activationUrl = `${appUrl}/auth/activate?${params.toString()}`;
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.oTPCode.create({
    data: {
      userId: purchase.user.id,
      code: otp,
      purpose: "SUBSCRIPTION_ACTIVATION",
      expiresAt
    }
  });

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      activationToken,
      activationUrl,
      emailSentAt: new Date()
    }
  });

  await prisma.subscription.updateMany({
    where: { userId: purchase.userId, planId: purchase.planId },
    data: { customAccessUrl: activationUrl }
  });

  const host = process.env.SES_SMTP_HOST;
  const port = Number(process.env.SES_SMTP_PORT || 587);
  const user = process.env.SES_SMTP_USERNAME;
  const pass = process.env.SES_SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || "OET HQ <no-reply@oethq.com>";

  if (!host || !user || !pass) {
    console.error("Missing SES SMTP credentials in .env");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000
  });

  const subject = `Your ${purchase.plan.name} access is ready — OET LMS`;
  const text = [
    `${purchase.plan.name} access is ready`,
    "",
    `Your code: ${otp}`,
    "Expires in 10 minutes.",
    "",
    "Open this link and enter the OTP to start your access window:",
    activationUrl,
    ""
  ].join("\n");

  console.log(`Sending activation email via SES → ${purchase.user.email}`);
  const info = await transporter.sendMail({
    from,
    to: purchase.user.email,
    subject,
    text,
    html: `<p>Your <strong>${purchase.plan.name}</strong> access is ready.</p>
           <p>OTP: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p>
           <p><a href="${activationUrl}">Activate your plan</a></p>
           <p>Your access window starts only after OTP verification.</p>`
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        purchaseId: purchase.id,
        to: purchase.user.email,
        otp,
        activationUrl,
        messageId: info.messageId,
        response: info.response
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
})().catch(async (err) => {
  console.error("Resend failed:", err.message || err);
  await prisma.$disconnect();
  process.exit(1);
});
