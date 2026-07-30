import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { PlanCard } from "@/components/plan-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pricingPlans } from "@/lib/site-data";

export default function PublicPage() {
  return (
    <PublicShell
      eyebrow="Public Access"
      title="See access rules, pricing tiers, and secure OTP entry before you create an account."
      description="This route summarizes candidate onboarding, plan limits, and the purchase-to-activation sequence."
      highlights={[
        "One-time purchases only. There is no auto-renewal.",
        "The 60-day timer begins only after OTP verification.",
        "Paid plans unlock the full lecture and article track.",
        "Reading, Listening, and past papers scale by plan tier."
      ]}
      className="items-start"
    >
      <div className="w-full space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/15 p-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Before you begin</CardTitle>
                <CardDescription>
                  Create an account, verify the OTP, then continue into the candidate portal with the correct plan
                  access.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {pricingPlans.slice(0, 2).map((plan) => (
                <div key={plan.id} className="surface-panel-subtle px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/auth/register">Create account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/#plans">
                  Review all plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {pricingPlans.slice(2, 4).map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
