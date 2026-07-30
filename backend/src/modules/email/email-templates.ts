/**
 * Inline HTML transactional emails aligned with frontend light-theme tokens (globals.css).
 * Uses hex values for broad client compatibility; table layout for classic email clients.
 */
const brand = {
  canvas: "#f4f3ef",
  card: "#ffffff",
  foreground: "#1f2d42",
  muted: "#4c5f75",
  primary: "#1f7ea1",
  primaryDark: "#186582",
  accent: "#dff0eb",
  border: "#dde4ef",
  warmSecondary: "#f3ead9"
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Human label for OTP email subject lines and hero text. */
export function otpPurposeLabel(purpose: string): string {
  switch (purpose) {
    case "LOGIN":
      return "Sign-in verification";
    case "REGISTER":
      return "Complete your registration";
    case "FREE_TRIAL":
      return "Start your free trial";
    case "SUBSCRIPTION_ACTIVATION":
      return "Activate your access";
    case "PASSWORD_RESET":
      return "Reset your password";
    default:
      return "Verification";
  }
}

function preheaderBlock(text: string): string {
  const t = escapeHtml(text);
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${t}</div>`;
}

function baseLayout(preheader: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OET LMS</title>
</head>
<body style="margin:0;padding:0;background:${brand.canvas};-webkit-text-size-adjust:100%;">
${preheaderBlock(preheader)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.canvas};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" style="max-width:560px;border-collapse:separate;background:${brand.card};border-radius:20px;border:1px solid ${brand.border};overflow:hidden;box-shadow:0 24px 60px rgba(31,45,66,0.12);">
        <tr>
          <td style="background:linear-gradient(135deg,${brand.primary} 0%,${brand.primaryDark} 100%);padding:22px 28px;text-align:center;">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">OET LMS</span>
            <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12px;color:rgba(255,255,255,0.92);margin-top:6px;letter-spacing:0.06em;text-transform:uppercase;">Healthcare English preparation</div>
          </td>
        </tr>
        ${inner}
        <tr>
          <td style="padding:20px 28px 26px;background:linear-gradient(180deg,${brand.warmSecondary}33 0%,transparent 65%);border-top:1px solid ${brand.border};">
            <p style="margin:0;font-family:Georgia,serif;font-size:13px;line-height:1.6;color:${brand.muted};text-align:center;">
              You received this because a sign-in or verification was requested for your account.<br>
              If this was not you, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-family:system-ui,sans-serif;font-size:11px;color:${brand.muted};">© ${new Date().getFullYear()} OET LMS</p>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function otpBoxesHtml(otp: string): string {
  const chars = otp.split("");
  const cells = chars
    .map((d) => {
      const digit = escapeHtml(d);
      return `<td align="center" style="padding:4px;"><div style="display:inline-block;min-width:44px;height:52px;line-height:52px;background:#e8f6f2;border:1px solid ${brand.border};border-radius:14px;font-family:'SF Mono',Consolas,Menlo,monospace;font-size:26px;font-weight:700;color:#0c2c55 !important;mso-color-alt:#0c2c55;">${digit}</div></td>`;
    })
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:8px auto 0;"><tr>${cells}</tr></table>`;
}

/** Email-safe primary CTA — nested span keeps white text in Gmail/Outlook. */
function ctaButtonHtml(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
  <tr>
    <td align="center" bgcolor="#0c2c55" style="background-color:#0c2c55;border-radius:14px;mso-padding-alt:14px 28px;">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;background-color:#0c2c55;color:#ffffff !important;text-decoration:none;border-radius:14px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;line-height:1.2;mso-color-alt:#ffffff;">
        <span style="color:#ffffff !important;mso-color-alt:#ffffff;">${safeLabel}</span>
      </a>
    </td>
  </tr>
</table>`;
}

export type AuthOtpTemplateParams = {
  purposeLabel: string;
  otp: string;
  expiryMinutes: number;
};

export function buildAuthOtpEmail(params: AuthOtpTemplateParams): { html: string; text: string } {
  const { purposeLabel, otp, expiryMinutes } = params;
  const safePurpose = escapeHtml(purposeLabel);
  const inner = `
        <tr>
          <td style="padding:28px 28px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${brand.primary};">${safePurpose}</p>
            <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:${brand.foreground};letter-spacing:-0.03em;">Your one-time code</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:${brand.muted};">Enter this code where prompted. It expires in <strong style="color:${brand.foreground};">${expiryMinutes} minutes</strong> for your security.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 28px;text-align:center;">
            ${otpBoxesHtml(otp)}
          </td>
        </tr>`;

  const preheader = `Your ${purposeLabel.toLowerCase()} code is ${otp}. Expires in ${expiryMinutes} minutes.`;

  const text = `${purposeLabel}\n\nYour one-time code: ${otp}\n\nExpires in ${expiryMinutes} minutes.\n\nIf you did not request this, ignore this email.`;

  return { html: baseLayout(preheader, inner), text };
}

export type FreeTrialTemplateParams = {
  otp: string;
  expiryMinutes: number;
};

export function buildFreeTrialEmail(params: FreeTrialTemplateParams): { html: string; text: string } {
  const { otp, expiryMinutes } = params;
  const inner = `
        <tr>
          <td style="padding:28px 28px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${brand.primary};">Free trial</p>
            <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:${brand.foreground};letter-spacing:-0.03em;">Unlock your starter access</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:${brand.muted};">Verify your email with the code below to activate your trial. This code expires in <strong style="color:${brand.foreground};">${expiryMinutes} minutes</strong>.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 28px;text-align:center;">
            ${otpBoxesHtml(otp)}
          </td>
        </tr>`;

  const preheader = `Your free-trial OTP is ${otp}. Expires in ${expiryMinutes} minutes.`;
  const text = `Unlock your starter access\n\nYour free-trial code: ${otp}\nExpires in ${expiryMinutes} minutes.\n\nIf you did not request this, ignore this email.`;

  return { html: baseLayout(preheader, inner), text };
}

export type ActivationTemplateParams = {
  planName: string;
  otp: string;
  activationUrl: string;
  expiryMinutes: number;
};

export function buildActivationEmail(params: ActivationTemplateParams): { html: string; text: string } {
  const { planName, otp, activationUrl, expiryMinutes } = params;
  const safePlan = escapeHtml(planName);
  const safeUrl = escapeHtml(activationUrl);
  const hrefAttr = escapeHtml(activationUrl);
  const inner = `
        <tr>
          <td style="padding:28px 28px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${brand.primary};">Subscription ready</p>
            <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:${brand.foreground};letter-spacing:-0.03em;">Your <span style="color:${brand.primary};">${safePlan}</span> access is ready</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:${brand.muted};">Enter the verification code below on the activation page. Your <strong style="color:${brand.foreground};">access window starts only after OTP verification</strong>. Code expires in <strong style="color:${brand.foreground};">${expiryMinutes} minutes</strong>.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 8px;text-align:center;">
            <p style="margin:0 0 12px;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${brand.muted};">Your OTP</p>
            ${otpBoxesHtml(otp)}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;text-align:center;font-family:system-ui,sans-serif;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${brand.muted};">Activation link</p>
            ${ctaButtonHtml(activationUrl, "Activate now")}
            <div style="margin:18px 0 0;padding:14px 16px;background:${brand.warmSecondary};border:1px solid ${brand.border};border-radius:12px;text-align:left;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${brand.foreground};">Or copy this link:</p>
              <a href="${hrefAttr}" target="_blank" rel="noopener noreferrer" style="display:block;font-size:13px;line-height:1.5;color:${brand.primary};text-decoration:underline;word-break:break-all;">${safeUrl}</a>
            </div>
          </td>
        </tr>`;

  const preheader = `Your ${planName} access is ready. OTP ${otp}.`;
  const text = `${planName} access is ready\n\nYour OTP: ${otp}\nExpires in ${expiryMinutes} minutes.\n\nActivation link:\n${activationUrl}\n`;

  return { html: baseLayout(preheader, inner), text };
}

export type InviteTemplateParams = ActivationTemplateParams & {
  /** e.g. "You have been added to …" */
  headline: string;
};

export function buildCustomInviteEmail(params: InviteTemplateParams): { html: string; text: string } {
  const { planName, otp, activationUrl, expiryMinutes, headline } = params;
  const safePlan = escapeHtml(planName);
  const safeHeadline = escapeHtml(headline);
  const safeUrl = escapeHtml(activationUrl);
  const hrefAttr = escapeHtml(activationUrl);
  const inner = `
        <tr>
          <td style="padding:28px 28px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${brand.primary};">Personal invite</p>
            <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:${brand.foreground};letter-spacing:-0.03em;">${safeHeadline}</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:${brand.muted};">You have been assigned the <strong style="color:${brand.foreground};">${safePlan}</strong> plan. Enter the OTP below (expires in <strong style="color:${brand.foreground};">${expiryMinutes} minutes</strong>), then open the activation link.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 8px;text-align:center;">
            <p style="margin:0 0 12px;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${brand.muted};">Your OTP</p>
            ${otpBoxesHtml(otp)}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;text-align:center;font-family:system-ui,sans-serif;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${brand.muted};">Activation link</p>
            ${ctaButtonHtml(activationUrl, "Activate now")}
            <div style="margin:18px 0 0;padding:14px 16px;background:${brand.warmSecondary};border:1px solid ${brand.border};border-radius:12px;text-align:left;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${brand.foreground};">Or copy this link:</p>
              <a href="${hrefAttr}" target="_blank" rel="noopener noreferrer" style="display:block;font-size:13px;line-height:1.5;color:${brand.primary};text-decoration:underline;word-break:break-all;">${safeUrl}</a>
            </div>
          </td>
        </tr>`;

  const preheader = `${headline} Code: ${otp}`;
  const text = `${headline}\n\nPlan: ${planName}\nYour OTP: ${otp}\nExpires in ${expiryMinutes} minutes.\n\nActivation link:\n${activationUrl}\n`;

  return { html: baseLayout(preheader, inner), text };
}
