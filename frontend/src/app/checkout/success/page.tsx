"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Home, Mail, ShieldCheck } from "lucide-react";
import { OetBrandLogo } from "@/components/brand/oet-brand-logo";
import { WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type ConfirmStripeResponse = {
  purchase?: { status?: string; plan?: { name?: string } };
  activationEmail?: {
    toEmail: string;
    activationUrl: string;
  };
  alreadyCompleted?: boolean;
  emailDelivered?: boolean;
  activationUrl?: string | null;
};

function CheckoutSuccessPageContent() {
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase");
  const sessionId = searchParams.get("session_id");
  const [planName, setPlanName] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<"working" | "done" | "error">("working");
  const [statusMessage, setStatusMessage] = useState(
    "Confirming your payment and sending the activation email…"
  );

  useEffect(() => {
    if (!sessionId) {
      setConfirmState("done");
      setStatusMessage(
        "Payment received. If you paid with Stripe, open this page from the Stripe return link so we can send your activation email."
      );
      return;
    }

    const lockKey = `stripe-confirm:${sessionId}`;
    if (typeof window !== "undefined") {
      const existing = sessionStorage.getItem(lockKey);
      if (existing === "done" || existing === "pending") {
        setConfirmState("done");
        setStatusMessage("Payment confirmed. Check your email for the activation link and OTP.");
        return;
      }
      sessionStorage.setItem(lockKey, "pending");
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await apiFetch<ConfirmStripeResponse>("/subscriptions/purchases/confirm-stripe", {
          method: "POST",
          body: {
            sessionId,
            ...(purchaseId ? { purchaseId } : {})
          }
        });

        if (cancelled) return;

        setPlanName(result.purchase?.plan?.name || null);
        setEmailHint(result.activationEmail?.toEmail || null);
        sessionStorage.setItem(lockKey, "done");

        setStatusMessage(
          result.activationEmail?.toEmail
            ? `Activation email sent to ${result.activationEmail.toEmail}. Open the link and enter the OTP to start your access window.`
            : "Check your email for the activation link and OTP (including spam)."
        );
        setConfirmState("done");
      } catch (caught: unknown) {
        if (cancelled) return;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(lockKey);
        }
        setConfirmState("error");
        setStatusMessage(
          caught instanceof Error
            ? caught.message
            : "We could not send the activation email. Contact support with your purchase reference."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [purchaseId, sessionId]);

  return (
    <main className="min-h-screen bg-background font-sans lg:grid lg:min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#0f3a6e_0%,#0c2c55_55%,#091f3d_100%)] text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(520px 280px at 15% 10%, rgba(124,196,255,.28), transparent 55%), radial-gradient(420px 260px at 90% 85%, rgba(63,160,240,.2), transparent 50%)"
          }}
          aria-hidden
        />

        <div className="relative z-[1]">
          <OetBrandLogo priority className="w-[160px] sm:w-[200px]" />
        </div>

        <div className="relative z-[1] max-w-md space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7CC4FF]">Thank you</p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
            Payment received.
            <br />
            You&apos;re almost ready.
          </h1>
          <p className="text-base leading-relaxed text-[#B9CEE8]">
            {planName
              ? `Your ${planName} purchase is confirmed. Activate with the email OTP to start your access window.`
              : "Your purchase is confirmed. Activate with the email OTP to start your access window."}
          </p>
        </div>

        <p className="relative z-[1] text-sm text-[#7A9BC0]">© {new Date().getFullYear()} OET HQ</p>
      </aside>

      <section className="relative flex min-h-screen flex-col px-4 py-6 sm:px-8 lg:min-h-dvh lg:px-12 lg:py-10">
        <div className="mb-6 flex items-center justify-end gap-3 lg:mb-0">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/blogs"
              className="text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              Blogs
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6 lg:py-0">
          <div className="mb-6 flex justify-center lg:hidden">
            <OetBrandLogo className="w-[140px] sm:w-[160px]" />
          </div>
          <Card className="w-full overflow-hidden border-border shadow-[var(--shadow-card)]">
            <CardHeader className="space-y-2 border-b border-border pb-5">
              <CardTitle className="flex items-center gap-2 font-display text-2xl text-[hsl(var(--primary-deep))] sm:text-3xl">
                <BadgeCheck className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                Thank you
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                {planName ? `Payment confirmed for ${planName}.` : "We’ve received your payment."} {statusMessage}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 p-5 sm:p-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">What to do next</p>
                <ol className="mt-3 space-y-3 text-sm leading-6 text-foreground">
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      1
                    </span>
                    <span>
                      Open your email
                      {emailHint ? ` (${emailHint})` : ""} for the activation link and OTP.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      2
                    </span>
                    <span>Open the link and enter the OTP once to start your access window.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      3
                    </span>
                    <span>Then sign in to open your candidate portal.</span>
                  </li>
                </ol>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-11 flex-1 rounded-[11px]">
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" aria-hidden />
                    Back to home
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 flex-1 rounded-[11px]">
                  <Link href="/auth/login">
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
                    Go to login
                  </Link>
                </Button>
              </div>

              <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {confirmState === "working"
                  ? "Finalizing payment confirmation and email delivery…"
                  : confirmState === "error"
                    ? "Email delivery failed — see the message above."
                    : "Didn’t get the email? Check spam, or contact support with your purchase reference."}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Preparing your thank-you page..." layout="split" />}>
      <CheckoutSuccessPageContent />
    </Suspense>
  );
}
