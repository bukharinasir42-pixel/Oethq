"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  MailCheck,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  XCircle
} from "lucide-react";
import { InlineLoader } from "@/components/loaders";
import { PublicShell } from "@/components/layout/public-shell";
import {
  WorkspaceAccessDeniedState,
  WorkspaceErrorAlert,
  WorkspaceLoadingState
} from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { sendActivationEmail } from "@/lib/emailjs";
import type {
  AdminPurchaseDto,
  PlanDto,
  PurchaseIntentResponseDto,
  PurchaseResolutionResponseDto
} from "@/lib/types";

function formatMoney(value: number | string, currency: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return `${currency} ${value}`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

function isBackendPlanId(planId: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId);
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const { token, profile, status, error, refresh } = useSession();
  const planId = searchParams.get("plan");
  const purchaseId = searchParams.get("purchase");

  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [purchase, setPurchase] = useState<AdminPurchaseDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"create" | "complete" | "fail" | "retry" | "refresh" | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const showStagingControls = process.env.NODE_ENV !== "production";

  useEffect(() => {
    const load = async () => {
      try {
        const nextPlans = await apiFetch<PlanDto[]>("/plans", { token: null });
        setPlans(nextPlans.filter((plan) => plan.tier !== "STARTER"));
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Unable to load plans");
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!token || !profile || profile.role !== "CANDIDATE") {
      setAlreadyActive(false);
      return;
    }

    let cancelled = false;
    void apiFetch<{ accessGranted?: boolean; plan?: { tier?: string } | null }>(
      `/subscriptions/status?userId=${encodeURIComponent(profile.id)}`,
      {
        token
      }
    )
      .then((sub) => {
        // Free-trial users can still purchase an upgrade.
        const paidActive = Boolean(sub.accessGranted && sub.plan?.tier && sub.plan.tier !== "STARTER");
        if (!cancelled) setAlreadyActive(paidActive);
      })
      .catch(() => {
        if (!cancelled) setAlreadyActive(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile, token]);

  useEffect(() => {
    if (!alreadyActive) return;
    window.location.replace("/portal");
  }, [alreadyActive]);

  useEffect(() => {
    const loadPurchase = async () => {
      if (!token || !purchaseId) {
        setPurchase(null);
        return;
      }

      setBusyAction("refresh");
      setLoadError(null);
      try {
        const nextPurchase = await apiFetch<AdminPurchaseDto>(`/subscriptions/purchases/${purchaseId}`, { token });
        setPurchase(nextPurchase);
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Unable to load transaction");
      } finally {
        setBusyAction(null);
      }
    };

    void loadPurchase();
  }, [purchaseId, token]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === (purchase?.plan?.id || planId)) || null,
    [planId, plans, purchase?.plan?.id]
  );

  const authHref = `/auth/login?returnTo=${encodeURIComponent(
    `/checkout${purchaseId ? `?purchase=${purchaseId}${planId ? `&plan=${planId}` : ""}` : planId ? `?plan=${planId}` : ""}`
  )}`;
  const registerHref = `/auth/register?returnTo=${encodeURIComponent(
    `/checkout${planId ? `?plan=${planId}` : purchaseId ? `?purchase=${purchaseId}` : ""}`
  )}`;

  const createPurchase = async () => {
    if (!selectedPlan || !profile || !token) {
      return;
    }

    if (!isBackendPlanId(selectedPlan.id)) {
      setLoadError("Live pricing is still loading. Please return to the plans page and try again.");
      return;
    }

    setBusyAction("create");
    setLoadError(null);
    setDevOtp(null);
    try {
      const response = await apiFetch<PurchaseIntentResponseDto>("/subscriptions/purchases", {
        method: "POST",
        token,
        body: {
          userId: profile.id,
          planId: selectedPlan.id,
          provider: "STRIPE"
        }
      });
      setPurchase(response.purchase);
      if (!response.checkoutUrl) {
        throw new Error("Could not start checkout");
      }
      window.location.href = response.checkoutUrl;
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Unable to create checkout");
    } finally {
      setBusyAction(null);
    }
  };

  const resolvePurchase = async (statusValue: "COMPLETED" | "FAILED") => {
    if (!purchase || !token) {
      return;
    }

    setBusyAction(statusValue === "COMPLETED" ? "complete" : "fail");
    setLoadError(null);
    try {
      const response = await apiFetch<PurchaseResolutionResponseDto>(`/subscriptions/purchases/${purchase.id}/resolve`, {
        method: "POST",
        token,
        body: {
          status: statusValue,
          provider: "STAGING_MANUAL",
          eventId: `${statusValue.toLowerCase()}-${purchase.id}`,
          reference: purchase.reference || `staging-${purchase.id}`,
          receiptUrl: statusValue === "COMPLETED" ? `https://receipts.staging.local/${purchase.id}` : undefined,
          failureReason: statusValue === "FAILED" ? "Card authorization was declined" : undefined,
          receiptData:
            statusValue === "COMPLETED"
              ? { provider: "STAGING_MANUAL", processedBy: "public-checkout" }
              : undefined
        }
      });
      setPurchase(response.purchase);
      setDevOtp(response.otp || null);

      if (statusValue === "COMPLETED" && response.activationEmail?.otp) {
        const emailResult = await sendActivationEmail({
          toName: response.activationEmail.toName,
          toEmail: response.activationEmail.toEmail,
          planName: response.activationEmail.planName,
          otp: response.activationEmail.otp,
          activationUrl: response.activationEmail.activationUrl,
          orderId: response.activationEmail.purchaseId
        });
        if (emailResult.success) {
          toast.success("Activation email sent. Open the link and verify your OTP to start your 60-day access.");
        } else {
          toast.error(emailResult.error || "Purchase completed, but the activation email could not be sent.");
        }
      }
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Unable to update transaction");
    } finally {
      setBusyAction(null);
    }
  };

  const retryPurchase = async () => {
    if (!purchase || !token) {
      return;
    }

    setBusyAction("retry");
    setLoadError(null);
    setDevOtp(null);
    try {
      const nextPurchase = await apiFetch<AdminPurchaseDto>(`/subscriptions/purchases/${purchase.id}/retry`, {
        method: "POST",
        token
      });
      setPurchase(nextPurchase);
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Unable to retry transaction");
    } finally {
      setBusyAction(null);
    }
  };

  if (status === "loading" || status === "idle" || alreadyActive) {
    return (
      <WorkspaceLoadingState
        title={alreadyActive ? "You already have active access. Opening portal..." : "Loading checkout..."}
        layout="split"
      />
    );
  }

  if (status === "unauth") {
    return (
      <PublicShell
        eyebrow="Checkout"
        title="Secure the plan first, then complete the OTP activation cleanly."
        description="This transaction route now mirrors the real candidate journey: authenticate, confirm the one-time purchase, then use the activation email to finish access."
        highlights={[
          "One-time purchases only with no auto-renewal.",
          "Activation emails and OTPs are issued after payment success.",
          "The plan still activates on OTP verification, not on button click.",
          "Secure payment starts after candidate sign-in."
        ]}
      >
        <WorkspaceAccessDeniedState
          title="Sign in to continue to checkout"
          description={error || "Use your candidate account first, then return here to complete the transaction flow."}
          actionHref={authHref}
          actionLabel="Log in"
          onRetry={refresh}
        />
        <Card className="mesh-panel border-white/60">
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-muted-foreground">New candidate?</p>
            <Button asChild className="w-full">
              <Link href={registerHref}>Create account and return to checkout</Link>
            </Button>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      eyebrow="Transaction"
      title="Secure checkout for your selected plan."
      description="Review the plan, start Stripe-hosted Checkout, and return here after payment so your account can activate cleanly."
      highlights={[
        "Candidate-owned checkout sessions with purchase detail reload support.",
        "Secure Stripe-hosted payment for paid plans.",
        "Success refreshes your active subscription before portal entry.",
        "Activation links route back through secure sign-in before portal entry."
      ]}
      className="items-start"
    >
      <div className="space-y-4">
        {loadError ? <WorkspaceErrorAlert title="Checkout needs attention" description={loadError} /> : null}

        <Card className="mesh-panel border-white/60">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-4xl">
                  <CreditCard className="h-5 w-5 text-primary" aria-hidden />
                  Checkout summary
                </CardTitle>
                <CardDescription className="mt-2 leading-7">
                  {selectedPlan
                    ? `You are checking out the ${selectedPlan.name} plan as ${profile?.email}.`
                    : "Select a plan from the landing page first, then return here to complete checkout."}
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-primary/30 bg-card/70 px-3 py-1 text-primary">
                {purchase?.status || "READY"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="surface-panel-subtle px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Plan</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{selectedPlan?.name || "Not selected"}</p>
              {selectedPlan ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {formatMoney(selectedPlan.price, selectedPlan.currency)} · {selectedPlan.durationDays} days · Reading{" "}
                  {selectedPlan.readingLimit} · Listening {selectedPlan.listeningLimit} · Past papers{" "}
                  {selectedPlan.pastPaperLimit}
                </p>
              ) : null}
            </div>
            <div className="surface-panel-subtle px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Candidate</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{profile?.name}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {profile?.email}
                <br />
                {profile?.role === "ADMIN"
                  ? "Admin test mode is enabled for payment verification."
                  : "Candidate checkout keeps the purchase flow inside the public surface."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mesh-panel border-white/60">
          <CardHeader>
            <CardTitle className="font-display text-3xl">Secure payment</CardTitle>
            <CardDescription>
              Start Stripe-hosted Checkout to complete this one-time purchase. You will return here after payment
              for confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedPlan ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                Open checkout from a paid plan card first so the order can be created with a valid plan.
              </div>
            ) : null}

            {!purchase ? (
              <Button className="w-full rounded-2xl" disabled={!selectedPlan || busyAction === "create"} onClick={createPurchase}>
                <span className="inline-flex items-center justify-center gap-2">
                  {busyAction === "create" ? (
                    <InlineLoader label="Starting secure payment" size="sm" />
                  ) : (
                    "Proceed to secure payment"
                  )}
                </span>
              </Button>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="surface-panel-subtle px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reference</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{purchase.reference || "Not issued"}</p>
                  </div>
                  <div className="surface-panel-subtle px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{formatDateTime(purchase.createdAt)}</p>
                  </div>
                </div>

                {showStagingControls && purchase.status === "PENDING" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button className="rounded-2xl" disabled={busyAction === "complete"} onClick={() => void resolvePurchase("COMPLETED")}>
                      <span className="inline-flex items-center justify-center gap-2">
                        {busyAction === "complete" ? (
                          <InlineLoader label="Completing purchase" size="sm" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                            Simulate payment success
                          </>
                        )}
                      </span>
                    </Button>
                    <Button
                      variant="secondary"
                      className="rounded-2xl"
                      disabled={busyAction === "fail"}
                      onClick={() => void resolvePurchase("FAILED")}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {busyAction === "fail" ? (
                          <InlineLoader label="Marking purchase failed" size="sm" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" aria-hidden />
                            Simulate payment failure
                          </>
                        )}
                      </span>
                    </Button>
                  </div>
                ) : null}

                {showStagingControls && purchase.status === "FAILED" ? (
                  <Button variant="outline" className="w-full rounded-2xl" disabled={busyAction === "retry"} onClick={retryPurchase}>
                    <span className="inline-flex items-center justify-center gap-2">
                      {busyAction === "retry" ? (
                        <InlineLoader label="Resetting checkout" size="sm" />
                      ) : (
                        <>
                          <RefreshCcw className="h-4 w-4" aria-hidden />
                          Retry this purchase
                        </>
                      )}
                    </span>
                  </Button>
                ) : null}

                {purchase.failureReason ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                    {purchase.failureReason}
                  </div>
                ) : null}

                {purchase.status === "COMPLETED" ? (
                  <div className="space-y-3 rounded-[26px] border border-primary/20 bg-primary/5 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/12 p-2 text-primary">
                        <BadgeCheck className="h-4 w-4" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Payment completed</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          The activation email path is now live. Use the email link and the OTP from inbox to complete
                          the post-purchase sign-in step.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="surface-panel-subtle px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Activation email</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{formatDateTime(purchase.emailSentAt)}</p>
                      </div>
                      <div className="surface-panel-subtle px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Receipt</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{purchase.receiptUrl || "Generated in staging response"}</p>
                      </div>
                    </div>

                    {showStagingControls && devOtp ? (
                      <div className="rounded-2xl border border-primary/20 bg-background/75 px-4 py-3 text-sm text-primary">
                        Development OTP: <span className="font-mono tracking-[0.36em]">{devOtp}</span>
                      </div>
                    ) : null}

                    {purchase.activationUrl ? (
                      <div className="flex flex-wrap gap-3">
                        <Button asChild className="rounded-2xl">
                          <Link href={purchase.activationUrl}>
                            Continue with activation
                            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" className="rounded-2xl">
                          <Link href="/portal">Open portal</Link>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {showStagingControls ? (
          <Card className="mesh-panel border-dashed border-primary/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-3xl">
                <MailCheck className="h-5 w-5 text-primary" aria-hidden />
                What this validates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <p>
                This page closes the Phase 3 gap where checkout only existed in admin. Candidates can now create a
                purchase intent, see transaction state, trigger success or failure in staging, and continue into the
                activation sign-in route.
              </p>
              <p className="flex items-start gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-foreground">
                <ShieldAlert className="mt-1 h-4 w-4 text-primary" aria-hidden />
                Staging controls remain available outside production so success, failure, retry, email, and OTP paths
                can be tested without deleting the manual harness.
              </p>
              <p className="flex items-start gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-foreground">
                <Sparkles className="mt-1 h-4 w-4 text-primary" aria-hidden />
                The activation link now preserves return-to-portal routing so the email journey no longer lands on a
                generic login page with no context.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PublicShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Loading checkout..." layout="split" />}>
      <CheckoutPageContent />
    </Suspense>
  );
}
