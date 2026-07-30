"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { apiFetch, clearToken, getPostAuthRedirect, persistAuthSession } from "@/lib/api";
import { InlineLoader } from "@/components/loaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { WorkspaceLoadingState } from "@/components/layout/workspace-states";

type ActivationInfo = {
  email: string;
  name: string;
  planName: string;
  planTier: string;
  durationDays: number;
  alreadyActivated: boolean;
  accessExpired?: boolean;
  activationToken: string | null;
};

type ActivationResponse = {
  message: string;
  accessToken?: string;
  role?: string;
  email?: string;
  name?: string;
  alreadyActivated?: boolean;
};

function ActivationFlowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activationToken = searchParams.get("activation")?.trim() || "";
  const returnTo = searchParams.get("returnTo") || "/portal";

  const [info, setInfo] = useState<ActivationInfo | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    clearToken();
  }, []);

  useEffect(() => {
    if (!activationToken) {
      setLoading(false);
      setError("This activation link is missing a token. Open the link from your purchase email.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void apiFetch<ActivationInfo>(`/auth/activation/${encodeURIComponent(activationToken)}`)
      .then((response) => {
        if (cancelled) return;
        setInfo(response);
        if (response.accessExpired) {
          setError("This plan’s access window has expired. Purchase or renew a plan to continue.");
          return;
        }
        if (response.alreadyActivated) {
          setSuccess("This plan is already activated. Redirecting you to sign in…");
          window.setTimeout(() => {
            router.replace(`/auth/login?email=${encodeURIComponent(response.email)}`);
          }, 1500);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Unable to load activation details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activationToken, router]);

  const submitOtp = async () => {
    if (!activationToken || otp.trim().length !== 6) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<ActivationResponse>("/auth/activation/verify", {
        method: "POST",
        body: {
          activationToken,
          code: otp.trim()
        }
      });

      setSuccess(res.message || "OTP verified. Your access window has started.");

      if (res.accessToken) {
        await persistAuthSession(
          {
            accessToken: res.accessToken,
            email: res.email,
            name: res.name,
            role: res.role
          },
          {
            email: res.email || info?.email || "",
            name: res.name || info?.name || ""
          }
        );
        window.setTimeout(() => {
          router.push(getPostAuthRedirect(res.role, returnTo, { accessGranted: true }));
        }, 1600);
        return;
      }

      window.setTimeout(() => {
        router.push(`/auth/login?email=${encodeURIComponent(info?.email || "")}`);
      }, 1600);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (!activationToken) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ message: string }>("/auth/activation/resend", {
        method: "POST",
        body: { activationToken }
      });
      setSuccess(res.message || "A new activation code has been sent.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to resend code");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <WorkspaceLoadingState title="Loading activation…" layout="split" />;
  }

  return (
    <Card className="w-full max-w-xl overflow-hidden border-border shadow-[var(--shadow-card)]">
      <CardHeader className="space-y-5 border-b border-border pb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Plan activation</p>
          <CardTitle className="mt-3 font-display text-3xl text-[hsl(var(--primary-deep))] md:text-4xl">
            Enter your OTP
          </CardTitle>
        </div>
        <CardDescription className="max-w-[48ch] text-sm leading-7">
          {info
            ? `We emailed a code for ${info.planName} to ${info.email}. Enter it once to start your ${info.durationDays}-day access window.`
            : "Enter the verification code from your purchase email to unlock your candidate dashboard."}
        </CardDescription>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-primary/30 text-primary">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
            First-time activation
          </Badge>
          <Badge variant="outline" className="border-border/60">
            Candidates only
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-6">
        {info && !info.alreadyActivated && !info.accessExpired ? (
          <>
            <div className="space-y-3">
              <label htmlFor="activation-otp" className="text-sm font-semibold text-foreground">
                Verification code
              </label>
              <InputOTP
                id="activation-otp"
                maxLength={6}
                value={otp}
                onChange={setOtp}
                containerClassName="justify-center gap-2"
                disabled={submitting}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              className="h-12 w-full rounded-[11px]"
              onClick={() => void submitOtp()}
              disabled={submitting || otp.trim().length !== 6}
            >
              <span className="inline-flex w-full items-center justify-center gap-2">
                {submitting ? <InlineLoader label="Verifying code" size="sm" /> : "Activate plan"}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </span>
            </Button>

            <div className="flex justify-end">
              <Button type="button" variant="link" className="h-auto p-0" disabled={submitting} onClick={() => void resendOtp()}>
                Resend code
              </Button>
            </div>
          </>
        ) : null}

        {error ? (
          <p className="rounded-[11px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-[11px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            {success}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ActivationFlow() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Loading activation…" layout="split" />}>
      <ActivationFlowContent />
    </Suspense>
  );
}
