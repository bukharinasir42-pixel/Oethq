import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { PricingPlan } from "@/lib/site-data";
import { cn } from "@/lib/utils";

type PlanCardProps = {
  plan: PricingPlan;
};

export function PlanCard({ plan }: PlanCardProps) {
  const isTrial = plan.id === "starter";
  const isFeatured = plan.id === "accelerator";
  const features = plan.features ?? [];
  const ctaHref = isTrial
    ? "/auth/register"
    : plan.id === "custom"
      ? "/public"
      : plan.purchasePlanId
        ? `/checkout?plan=${plan.purchasePlanId}`
        : "/#plans";

  return (
    <Card
      className={cn(
        "mesh-panel flex h-full flex-col overflow-hidden border-white/60 shadow-[0_24px_70px_-42px_hsl(var(--foreground)/0.35)]",
        isFeatured && "border-primary/40 shadow-[0_30px_80px_-36px_hsl(var(--primary)/0.45)]"
      )}
    >
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{plan.name}</p>
            <CardTitle className="mt-3 font-display text-4xl tracking-tight md:text-5xl">{plan.price}</CardTitle>
          </div>
          {plan.badge ? (
            <Badge className="rounded-full border-0 bg-primary px-3 py-1 text-primary-foreground">{plan.badge}</Badge>
          ) : null}
        </div>
        <CardDescription className="text-sm font-medium text-foreground/80">{plan.duration}</CardDescription>
        <CardDescription className="max-w-[34ch] text-sm">{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {plan.tests ? (
          <div className="surface-panel-subtle px-4 py-4 text-sm text-foreground">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Practice inventory</p>
            <p className="mt-2 font-medium text-foreground">
              Reading tests: {plan.tests.reading} · Listening tests: {plan.tests.listening}
            </p>
            {plan.pastPapers ? <p className="mt-1 text-muted-foreground">Past papers: {plan.pastPapers}</p> : null}
          </div>
        ) : (
          <div className="surface-panel-dashed px-4 py-4 text-sm text-muted-foreground">
            Free Trial shows only to logged-in users without an active subscription.
          </div>
        )}
        <ul className="space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <span className="leading-6">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-0">
        <Button asChild className="w-full" variant={isTrial ? "secondary" : "default"}>
          <Link href={ctaHref}>
            {plan.cta}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
