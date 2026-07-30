import emailjs from "@emailjs/browser";

const EMAILJS_PUBLIC_KEY = "JLDPVn1tf0edbHnod";
const EMAILJS_SERVICE_ID = "service_z5nx2fh";
const EMAILJS_TEMPLATE_ID = "template_qyr3y0o";

let initialized = false;

function ensureEmailJsInit() {
  if (initialized || typeof window === "undefined") return;
  emailjs.init(EMAILJS_PUBLIC_KEY);
  initialized = true;
}

export type ActivationEmailPayload = {
  toName: string;
  toEmail: string;
  planName: string;
  otp: string;
  activationUrl: string;
  orderId: string;
};

function formatActivationOrderDetails(payload: ActivationEmailPayload) {
  return [
    `Plan: ${payload.planName}`,
    "",
    `Your verification code: ${payload.otp}`,
    "",
    "Your 60-day access period starts when you successfully verify your OTP, not when you receive this email.",
    "",
    `Open your activation link: ${payload.activationUrl}`,
    "",
    "For security reasons, please do not share your OTP with anyone."
  ].join("\n");
}

async function dispatchEmail(templateParams: Record<string, string>) {
  ensureEmailJsInit();
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
}

export async function sendActivationEmail(payload: ActivationEmailPayload) {
  try {
    const orderDetails = formatActivationOrderDetails(payload);
    await dispatchEmail({
      to_name: payload.toName,
      to_email: payload.toEmail,
      order_details: orderDetails,
      order_id: payload.orderId,
      otp: payload.otp,
      activation_url: payload.activationUrl,
      plan_name: payload.planName,
      link: payload.activationUrl
    });
    return { success: true as const };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "text" in error &&
            typeof (error as { text?: string }).text === "string"
          ? (error as { text: string }).text
          : "Unknown error";
    console.error("Failed to send activation email:", error);
    return { success: false as const, error: message };
  }
}

export async function sendEmail(
  toName: string,
  toEmail: string,
  orderDetails: string,
  orderId: string
) {
  try {
    await dispatchEmail({
      to_name: toName,
      to_email: toEmail,
      order_details: orderDetails,
      order_id: orderId
    });
    return { success: true as const };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "text" in error &&
            typeof (error as { text?: string }).text === "string"
          ? (error as { text: string }).text
          : "Unknown error";
    console.error("Failed to send email:", error);
    return { success: false as const, error: message };
  }
}
