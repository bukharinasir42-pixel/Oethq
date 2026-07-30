"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, RefreshCcw, XCircle } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { AdminPurchaseDto } from "@/lib/types";

function CheckoutCancelPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase");
  const { token, status } = useSession();
  const [purchase, setPurchase] = useState<AdminPurchaseDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId || !token) {
      return;
    }

    let cancelled = false;

    const loadPurchase = async () => {
      setLoadError(null);
      try {
        const nextPurchase = await apiFetch<AdminPurchaseDto>(`/subscriptions/purchases/${purchaseId}`, { token });
        if (!cancelled) {
          setPurchase(nextPurchase);
        }
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setLoadError(caughtError instanceof Error ? caughtError.message : "Unable to load transaction");
        }
      }
    };

    void loadPurchase();

    return () => {
      cancelled = true;
    };
  }, [purchaseId, token]);

  const retryHref = purchase?.plan?.id ? `/checkout?plan=${encodeURIComponent(purchase.plan.id)}` : "/#packages";

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading checkout..." layout="split" />;
  }

  return (
    <PublicShell
      eyebrow="Checkout"
      title="Payment cancelled."
      description="Your Stripe checkout was not completed. You can retry the same plan or return to the package list."
      highlights={[
        "No payment was completed from this checkout session.",
        "Your account remains available for another purchase attempt.",
        "Retrying creates a fresh secure Stripe checkout.",
        "You can choose a different plan from the package list."
      ]}
      className="items-start"
    >
      <div className="space-y-4">
        {loadError ? <WorkspaceErrorAlert title="Transaction could not be loaded" description={loadError} /> : null}

        <Card className="mesh-panel border-white/60">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-4xl">
                  <CreditCard className="h-5 w-5 text-primary" aria-hidden />
                  Payment cancelled
                </CardTitle>
                <CardDescription className="mt-2 leading-7">
                  The payment was not completed, and no paid plan was activated.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-primary/30 bg-card/70 px-3 py-1 text-primary">
                {purchase?.status || "CANCELLED"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4 rounded-[26px] border border-destructive/20 bg-destructive/10 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-background/75 p-2 text-destructive">
                  <XCircle className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Payment was not completed</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {purchase?.plan?.name
                      ? `You can retry checkout for ${purchase.plan.name}.`
                      : "Return to the package list to choose a plan and start checkout again."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="rounded-2xl" onClick={() => router.push(retryHref)}>
                  <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
                  Try again
                </Button>
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/#packages">Back to plans</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Loading checkout..." layout="split" />}>
      <CheckoutCancelPageContent />
    </Suspense>
  );
}
