"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { InlineLoader } from "@/components/loaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "email" | "code" | "password";

type MessageResponse = {
  message: string;
  email?: string;
  verified?: boolean;
};

export function ForgotPasswordFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  const submitEmail = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<MessageResponse>("/auth/password/forgot", {
        method: "POST",
        body: { email: email.trim() }
      });
      setStep("code");
      setCode("");
      setSuccess(res.message || "Check your email for a reset code.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<MessageResponse>("/auth/password/verify-code", {
        method: "POST",
        body: {
          email: email.trim(),
          code: code.trim()
        }
      });
      setStep("password");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(res.message || "Code verified. Choose your new password.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<MessageResponse>("/auth/password/reset", {
        method: "POST",
        body: {
          email: email.trim(),
          code: code.trim(),
          newPassword
        }
      });
      setSuccess(res.message || "Password updated. Redirecting to sign in…");
      const loginQuery = new URLSearchParams({ email: email.trim() });
      window.setTimeout(() => {
        router.push(`/auth/login?${loginQuery.toString()}`);
      }, 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<MessageResponse>("/auth/password/forgot", {
        method: "POST",
        body: { email: email.trim() }
      });
      setCode("");
      setSuccess(res.message || "A new reset code has been sent.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === "email" ? "Forgot password" : step === "code" ? "Verify reset code" : "Set a new password";

  const description =
    step === "email"
      ? "Enter your account email and we’ll send a reset code."
      : step === "code"
        ? `Enter the 6-digit code sent to ${email.trim()}.`
        : "Choose a new password for your account.";

  const isEmailDisabled = loading || !email.trim();
  const isCodeDisabled = loading || code.trim().length !== 6;
  const isPasswordDisabled =
    loading || newPassword.length < 8 || confirmPassword.length < 8;

  return (
    <Card className="w-full overflow-hidden border-border shadow-[var(--shadow-card)]">
      <CardHeader className="space-y-2 border-b border-border pb-5">
        <CardTitle className="font-display text-2xl text-[hsl(var(--primary-deep))] sm:text-3xl">{title}</CardTitle>
        <CardDescription className="text-sm leading-6">{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-5 sm:p-6">
        {step === "email" ? (
          <>
            <div className="space-y-2">
              <label htmlFor="forgot-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="forgot-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11 rounded-[11px] bg-card"
              />
            </div>

            <Button className="h-11 w-full rounded-[11px]" onClick={() => void submitEmail()} disabled={isEmailDisabled}>
              <span className="inline-flex w-full items-center justify-center gap-2">
                {loading ? <InlineLoader label="Sending code" size="sm" /> : "Send reset code"}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </span>
            </Button>
          </>
        ) : null}

        {step === "code" ? (
          <>
            <div className="space-y-3">
              <label htmlFor="forgot-code" className="text-sm font-medium text-foreground">
                Reset code
              </label>
              <InputOTP
                id="forgot-code"
                maxLength={6}
                value={code}
                onChange={setCode}
                containerClassName="justify-center gap-2"
                disabled={loading}
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

            <Button className="h-11 w-full rounded-[11px]" onClick={() => void submitCode()} disabled={isCodeDisabled}>
              <span className="inline-flex w-full items-center justify-center gap-2">
                {loading ? <InlineLoader label="Verifying code" size="sm" /> : "Verify code"}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </span>
            </Button>

            <div className="flex items-center justify-between gap-3 text-sm">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                disabled={loading}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setSuccess(null);
                }}
              >
                Back
              </Button>
              <Button type="button" variant="link" className="h-auto p-0" disabled={loading} onClick={() => void resendCode()}>
                Resend code
              </Button>
            </div>
          </>
        ) : null}

        {step === "password" ? (
          <>
            <div className="space-y-2">
              <label htmlFor="forgot-new-password" className="text-sm font-medium text-foreground">
                New password
              </label>
              <Input
                id="forgot-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="h-11 rounded-[11px] bg-card"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="forgot-confirm-password" className="text-sm font-medium text-foreground">
                Confirm password
              </label>
              <Input
                id="forgot-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
                className="h-11 rounded-[11px] bg-card"
              />
            </div>

            <Button className="h-11 w-full rounded-[11px]" onClick={() => void submitPassword()} disabled={isPasswordDisabled}>
              <span className="inline-flex w-full items-center justify-center gap-2">
                {loading ? <InlineLoader label="Updating password" size="sm" /> : "Update password"}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </span>
            </Button>

            <div className="flex items-center justify-start text-sm">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                disabled={loading}
                onClick={() => {
                  setStep("code");
                  setNewPassword("");
                  setConfirmPassword("");
                  setError(null);
                  setSuccess(null);
                }}
              >
                Back
              </Button>
            </div>
          </>
        ) : null}

        <p className="pt-1 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>

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
