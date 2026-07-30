/**
 * One-off SMTP check: loads the same .env as the API, sends a minimal OTP-style message.
 * Usage: npm run email:test -- <to@email>
 */
import "../src/load-env";
import { appConfig } from "../src/common/app-config";
import { EmailService } from "../src/modules/email/email.service";

const to = process.argv[2]?.trim();
if (!to) {
  // eslint-disable-next-line no-console
  console.error("Usage: npm run email:test -- <email>");
  process.exit(1);
}

const ethereal = (process.env.SMTP_MODE ?? "").trim().toLowerCase() === "ethereal";
const host = (process.env.SMTP_HOST ?? "").trim();
const hasSmtp = Boolean(host && !host.includes("example.com"));
if (!ethereal && !hasSmtp) {
  // eslint-disable-next-line no-console
  console.error("Set SMTP_MODE=ethereal (dev) or configure SMTP_HOST in .env before running.");
  process.exit(1);
}

void (async () => {
  const svc = new EmailService(appConfig);
  const result = await svc.sendOtpEmail(to, "000000", "LOGIN");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ to, ...result }, null, 2));
})().catch((err: unknown) => {
  const r = err as { message?: string };
  // eslint-disable-next-line no-console
  console.error(r.message ?? err);
  process.exit(1);
});
