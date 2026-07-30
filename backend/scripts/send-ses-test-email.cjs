/**
 * One-off Amazon SES SMTP test (no TypeScript / ts-node).
 *
 * Usage:
 *   node scripts/send-ses-test-email.cjs osama@endtest-mail.io
 *
 * Reads SES_SMTP_* + SMTP_FROM from backend/.env
 */
const path = require("path");
const nodemailer = require("nodemailer");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const to = (process.argv[2] || "").trim();
if (!to) {
  console.error("Usage: node scripts/send-ses-test-email.cjs <email>");
  process.exit(1);
}

const host = process.env.SES_SMTP_HOST;
const port = Number(process.env.SES_SMTP_PORT || 587);
const user = process.env.SES_SMTP_USERNAME;
const pass = process.env.SES_SMTP_PASSWORD;
const from = process.env.SMTP_FROM || "OET LMS <no-reply@oet.com>";

if (!host || !user || !pass) {
  console.error("Missing SES_SMTP_HOST / SES_SMTP_USERNAME / SES_SMTP_PASSWORD in .env");
  process.exit(1);
}

const otp = "123456";

void (async () => {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000
  });

  console.log(`Sending via SES SMTP ${host}:${port} → ${to}`);

  const info = await transporter.sendMail({
    from,
    to,
    subject: "OET LMS SES test — verification code",
    text: `Your test OTP is ${otp}. If you received this, Amazon SES delivery is working.`,
    html: `<p>Your test OTP is <strong>${otp}</strong>.</p><p>If you received this, Amazon SES delivery is working.</p>`
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        to,
        provider: "ses",
        messageId: info.messageId,
        response: info.response
      },
      null,
      2
    )
  );
})().catch((err) => {
  console.error("SES send failed:", err.message || err);
  process.exit(1);
});
