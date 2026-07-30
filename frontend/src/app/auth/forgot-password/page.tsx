import { Suspense } from "react";
import { ForgotPasswordFlow } from "@/components/auth/forgot-password-flow";
import { InlineLoader, LoadingPulseStrip } from "@/components/loaders";

function ForgotPasswordFallback() {
  return (
    <div
      className="w-full space-y-6 rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)]"
      aria-busy="true"
      aria-label="Loading password reset"
    >
      <LoadingPulseStrip />
      <div className="flex min-h-[160px] items-center justify-center py-4">
        <InlineLoader label="Loading password reset" size="md" />
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordFallback />}>
      <ForgotPasswordFlow />
    </Suspense>
  );
}
