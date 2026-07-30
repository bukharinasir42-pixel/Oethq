import type { AppConfig } from "../../common/app-config";
import { createLogger } from "../../common/logger";
import {
  buildActivationEmail,
  buildAuthOtpEmail,
  buildCustomInviteEmail,
  buildFreeTrialEmail,
  otpPurposeLabel
} from "./email-templates";
import * as nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SendMailResult = {
  delivered: boolean;
  preview: boolean;
  /** Ethereal SMTP failed (e.g. firewall blocking outbound 587); body was logged locally. */
  etherealFallback?: boolean;
  /** Which SMTP provider actually delivered the message (e.g. "ses", "elasticemail"). */
  provider?: string;
};

type SmtpProvider = {
  name: string;
  host: string;
  port: number;
  user?: string;
  pass?: string;
};

export class EmailService {
  private readonly logger = createLogger("EmailService");
  /** Lazy Ethereal SMTP (same host for everyone; disposable account from createTestAccount). */
  private etherealTransportPromise: Promise<{ transport: nodemailer.Transporter }> | undefined;

  constructor(private readonly configService: AppConfig) {}

  private otpExpiryMinutes(): number {
    return Number(this.configService.get<string>("OTP_EXPIRY_MINUTES") || 10);
  }

  async sendOtpEmail(email: string, otp: string, purpose: string) {
    const purposeLabel = otpPurposeLabel(purpose);
    const expiryMinutes = this.otpExpiryMinutes();
    const { html, text } = buildAuthOtpEmail({
      purposeLabel,
      otp,
      expiryMinutes
    });
    return this.sendMail({
      to: email,
      subject: `${purposeLabel} — your OET LMS code`,
      text,
      html
    });
  }

  async sendFreeTrialEmail(email: string, otp: string) {
    const { html, text } = buildFreeTrialEmail({
      otp,
      expiryMinutes: this.otpExpiryMinutes()
    });
    return this.sendMail({
      to: email,
      subject: "Your free trial code — OET LMS",
      text,
      html
    });
  }

  async sendPurchaseSuccessEmail(email: string, planName: string, otp: string, activationUrl: string) {
    const { html, text } = buildActivationEmail({
      planName,
      otp,
      activationUrl,
      expiryMinutes: this.otpExpiryMinutes()
    });
    return this.sendMail({
      to: email,
      subject: `Your ${planName} access is ready — OET LMS`,
      text,
      html
    });
  }

  async sendCustomUserInvite(email: string, planName: string, otp: string, activationUrl: string) {
    const { html, text } = buildCustomInviteEmail({
      headline: "Welcome to your new plan",
      planName,
      otp,
      activationUrl,
      expiryMinutes: this.otpExpiryMinutes()
    });
    return this.sendMail({
      to: email,
      subject: `You're enrolled in ${planName} — OET LMS`,
      text,
      html
    });
  }

  private smtpSocketTimeoutsMs(): number {
    const raw = this.configService.get<string>("SMTP_SOCKET_TIMEOUT_MS");
    const n = raw !== undefined ? Number(raw) : 15000;
    return Number.isFinite(n) && n >= 3000 ? n : 15000;
  }

  private async getEtherealTransport(): Promise<nodemailer.Transporter> {
    if (!this.etherealTransportPromise) {
      const socketMs = this.smtpSocketTimeoutsMs();
      this.etherealTransportPromise = (async () => {
        const account = await nodemailer.createTestAccount();
        const transport = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          connectionTimeout: socketMs,
          greetingTimeout: socketMs,
          socketTimeout: socketMs,
          auth: { user: account.user, pass: account.pass }
        });
        this.logger.log(
          "Using Ethereal SMTP (free dev mail — preview URL is logged after each send; no SMTP secrets in .env)."
        );
        return { transport };
      })();
    }
    const { transport } = await this.etherealTransportPromise;
    return transport;
  }

  private logLocalEmailPreview(payload: MailPayload, reason: string) {
    this.logger.log(
      `${reason} Local preview -> to=${payload.to} subject=${payload.subject} text=${payload.text}`
    );
  }

  /** Cohort notifications (reminders, missed sessions, warnings, weekly reports). */
  async sendCohortMail(to: string, mail: { subject: string; text: string; html: string }): Promise<SendMailResult> {
    return this.sendMail({ to, subject: mail.subject, text: mail.text, html: mail.html });
  }

  private async sendMail(payload: MailPayload): Promise<SendMailResult> {
    const from = this.configService.get<string>("SMTP_FROM") || "OET LMS <no-reply@oet.com>";
    const smtpMode = (this.configService.get<string>("SMTP_MODE") ?? "").trim().toLowerCase();

    if (smtpMode === "ethereal") {
      try {
        const transporter = await this.getEtherealTransport();
        const info = await transporter.sendMail({
          from,
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html
        });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.log(`Ethereal preview open in browser → ${previewUrl}`);
        }
        return { delivered: true, preview: Boolean(previewUrl) };
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : String(err);
        this.etherealTransportPromise = undefined;
        this.logger.log(
          `Ethereal SMTP failed (${detail}). Outbound port 587 is often blocked on corporate or guest Wi‑Fi — try Mailpit on localhost, another network, or a real SMTP relay.`
        );
        this.logLocalEmailPreview(
          payload,
          "Ethereal unreachable; OTP is in the text line below — use it to verify, or fix SMTP connectivity."
        );
        return { delivered: false, preview: true, etherealFallback: true };
      }
    }

    const providers = this.smtpProviders();
    if (providers.length === 0) {
      const detail =
        "No SMTP providers configured. Set SES_SMTP_HOST/USERNAME/PASSWORD (and optional SMTP_* fallback) in backend/.env";
      this.logger.error(`${detail}. Refusing to pretend email was sent to ${payload.to}`);
      throw new Error(detail);
    }

    this.logger.log(
      `Sending mail to=${payload.to} via providers=[${providers.map((p) => p.name).join(", ")}] from=${from}`
    );

    const tlsRejectUnauthorized = this.configService.get<string>("SMTP_TLS_REJECT_UNAUTHORIZED");
    const socketMs = this.smtpSocketTimeoutsMs();
    let lastError: unknown;

    for (const provider of providers) {
      try {
        const transporter = nodemailer.createTransport({
          host: provider.host,
          port: provider.port,
          secure: provider.port === 465,
          connectionTimeout: socketMs,
          greetingTimeout: socketMs,
          socketTimeout: socketMs,
          auth: provider.user && provider.pass ? { user: provider.user, pass: provider.pass } : undefined,
          ...(tlsRejectUnauthorized === "false" ? { tls: { rejectUnauthorized: false } } : {})
        });

        await transporter.sendMail({
          from,
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html
        });

        this.logger.log(`Email delivered via ${provider.name} -> ${payload.to}`);
        return { delivered: true, preview: false, provider: provider.name };
      } catch (err: unknown) {
        lastError = err;
        const detail = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Email via ${provider.name} failed (${detail}); trying next provider`);
      }
    }

    // Every provider failed — surface the last error (matches prior throw-on-failure behaviour).
    throw lastError instanceof Error ? lastError : new Error("All SMTP providers failed to send email");
  }

  /**
   * SMTP providers in priority order: Amazon SES first (SES_SMTP_*), then ElasticEmail
   * (SMTP_*) as fallback. A provider is included only when its host + credentials are set;
   * a placeholder host (example.com) is skipped so unconfigured envs fall through to preview.
   */
  private smtpProviders(): SmtpProvider[] {
    const providers: SmtpProvider[] = [];

    const sesHost = this.configService.get<string>("SES_SMTP_HOST");
    const sesUser = this.configService.get<string>("SES_SMTP_USERNAME");
    const sesPass = this.configService.get<string>("SES_SMTP_PASSWORD");
    if (sesHost && !sesHost.includes("example.com") && sesUser && sesPass) {
      providers.push({
        name: "ses",
        host: sesHost,
        port: Number(this.configService.get<string>("SES_SMTP_PORT") || 587),
        user: sesUser,
        pass: sesPass
      });
    }

    const smtpHost = this.configService.get<string>("SMTP_HOST");
    if (smtpHost && !smtpHost.includes("example.com")) {
      providers.push({
        name: "elasticemail",
        host: smtpHost,
        port: Number(this.configService.get<string>("SMTP_PORT") || 587),
        user: this.configService.get<string>("SMTP_USER"),
        pass: this.configService.get<string>("SMTP_PASSWORD")
      });
    }

    return providers;
  }
}
