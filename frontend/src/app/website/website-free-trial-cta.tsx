"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type SubSnapshot = {
  status: string;
  expiresInDays?: number;
};

export function WebsiteFreeTrialCta() {
  const { token, profile, status } = useSession();
  const [sub, setSub] = useState<SubSnapshot | null | "loading">("loading");

  useEffect(() => {
    if (status === "loading" || status === "idle") return;
    if (!token || !profile || profile.role !== "CANDIDATE") {
      setSub(null);
      return;
    }
    setSub("loading");
    void (async () => {
      try {
        const s = await apiFetch<SubSnapshot>(
          `/subscriptions/status?userId=${encodeURIComponent(profile.id)}`,
          { token }
        );
        setSub(s);
      } catch {
        setSub(null);
      }
    })();
  }, [token, profile, status]);

  if (status === "loading" || status === "idle") return null;
  if (!profile || profile.role !== "CANDIDATE" || !token) return null;
  if (sub === "loading" || sub === null) return null;

  const hasActiveAccess = sub.status === "ACTIVE" && (sub.expiresInDays ?? 0) > 0;
  if (hasActiveAccess) return null;

  const startTrial = async () => {
    try {
      const res = await apiFetch<{ otp?: string }>("/subscriptions/free-trial", {
        method: "POST",
        token,
        body: {}
      });
      toast.success(
        res.otp
          ? `Trial started. Development OTP: ${res.otp}`
          : "Check your email for your verification code to unlock starter access."
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not start free trial");
    }
  };

  return (
    <section
      className="relative mx-auto w-full max-w-5xl px-4 py-10 motion-safe:transition motion-safe:duration-500"
      aria-labelledby="free-trial-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(120% 80% at 10% 0%, rgba(37, 99, 235, 0.14), transparent 55%), radial-gradient(90% 70% at 90% 20%, rgba(14, 165, 233, 0.12), transparent 50%)"
        }}
      />
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 px-6 py-8 shadow-[0_32px_120px_-56px_rgba(15,23,42,0.55)] backdrop-blur-sm md:px-10 md:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
              <Sparkles className="h-6 w-6" aria-hidden />
            </span>
            <div className="space-y-2">
              <p id="free-trial-heading" className="text-xs font-bold uppercase tracking-[0.2em] text-blue-800">
                Candidate access
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1A2B4A] md:text-3xl">
                Start your free trial window
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">
                You&apos;re signed in without an active paid window. Request the starter lane once — we email a short
                verification code to protect your account, then unlock trial content.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 md:items-end">
            <Button
              type="button"
              size="lg"
              className="h-11 rounded-xl bg-[#1A2B4A] px-8 text-white shadow-sm hover:bg-[#152946]"
              onClick={() => void startTrial()}
            >
              Email me trial access
            </Button>
            <Link
              href="/portal/dashboard"
              className="text-center text-sm font-semibold text-blue-700 underline-offset-4 hover:underline md:text-right"
            >
              Go to candidate dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
