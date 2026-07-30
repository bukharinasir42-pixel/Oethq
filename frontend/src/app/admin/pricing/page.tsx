"use client";

import { useCallback, useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { InlineLoader } from "@/components/loaders";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StandaloneCoursePricing } from "@/components/admin/standalone-course-pricing";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { PlanDto } from "@/lib/types";
import { cn } from "@/lib/utils";

function priceToNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const TIER_ORDER: Record<string, number> = {
  FOUNDATION: 0,
  ACCELERATOR: 1,
  MASTERY: 2
};

function tierLabel(tier: string) {
  return tier
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function tierCardClass(tier: string) {
  switch (tier) {
    case "FOUNDATION":
      return "border-primary/25 bg-primary/[0.05]";
    case "ACCELERATOR":
      return "border-[hsl(var(--cyan)/0.35)] bg-[hsl(var(--cyan)/0.08)]";
    case "MASTERY":
      return "border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))]";
    default:
      return "border-border bg-card";
  }
}

type Draft = {
  name: string;
  description: string;
  price: string;
  currency: string;
  writingLimit: string;
};

function planToDraft(p: PlanDto): Draft {
  return {
    name: p.name,
    description: p.description ?? "",
    price: String(priceToNumber(p.price)),
    currency: p.currency || "USD",
    writingLimit: String(p.writingLimit ?? 0)
  };
}

export default function AdminPricingPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    if (!token) return;
    const rows = await apiFetch<PlanDto[]>("/plans/admin", { token });
    const manageable = rows.filter((p) => p.tier !== "STARTER" && p.tier !== "CUSTOM");
    const sorted = [...manageable].sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
    setPlans(sorted);
    const next: Record<string, Draft> = {};
    for (const p of sorted) {
      next[p.id] = planToDraft(p);
    }
    setDrafts(next);
  }, [token]);

  useEffect(() => {
    const load = async () => {
      if (!token || !profile || profile.role !== "ADMIN") return;
      try {
        await loadPlans();
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load plans");
      }
    };
    void load();
  }, [loadPlans, profile, token]);

  const save = async (plan: PlanDto) => {
    if (!token) return;
    const d = drafts[plan.id];
    if (!d?.name.trim()) {
      toast.error("Package name is required");
      return;
    }
    const priceNum = parseFloat(d.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Enter a valid price greater than zero");
      return;
    }
    setSavingId(plan.id);
    try {
      await apiFetch<PlanDto>(`/plans/${plan.id}`, {
        method: "PUT",
        token,
        body: {
          name: d.name.trim(),
          description: d.description.trim() || null,
          price: priceNum,
          currency: d.currency.trim() || "USD",
          writingLimit: Math.max(0, parseInt(d.writingLimit, 10) || 0)
        }
      });
      toast.success(`Saved “${d.name.trim()}”`);
      await loadPlans();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading pricing…" layout="cards" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to edit pricing."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell
      title="Price & Plan Management"
      description="Edit package names, short descriptions, and prices shown on the landing page and purchase flows. Test limits and duration stay in the database for each tier."
      profile={profile}
      fillContent
      onRefresh={() => void loadPlans()}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert description={loadError} /> : null}

      <div className="flex w-full flex-col gap-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4" aria-hidden />
              Compare plans
            </CardTitle>
            <CardDescription>
              Changes apply to public <code className="rounded bg-muted px-1">GET /plans</code> and the site after refresh. Currency is a three-letter code (e.g. USD). Starter and Custom
              tiers are not listed here.
            </CardDescription>
          </CardHeader>
        </Card>

        <StandaloneCoursePricing />

        <div className="equal-card-grid md:grid-cols-2 xl:grid-cols-2">
          {plans.map((plan) => {
            const d = drafts[plan.id];
            if (!d) return null;
            return (
              <Card key={plan.id} className={cn("equal-card min-w-0", tierCardClass(plan.tier))}>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{tierLabel(plan.tier)}</Badge>
                    {plan.isActive === false ? (
                      <Badge variant="outline" className="border-destructive/40 text-destructive">
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-lg">Package</CardTitle>
                </CardHeader>
                <CardContent className="equal-card-body space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${plan.id}`}>Package name</Label>
                    <Input
                      id={`name-${plan.id}`}
                      value={d.name}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [plan.id]: { ...d, name: e.target.value } }))}
                      placeholder="e.g. OET Accelerator"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`desc-${plan.id}`}>Short description</Label>
                    <Textarea
                      id={`desc-${plan.id}`}
                      rows={3}
                      value={d.description}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [plan.id]: { ...d, description: e.target.value } }))}
                      placeholder="Shown under the title on marketing cards."
                      className="resize-y"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`price-${plan.id}`}>Price</Label>
                      <Input
                        id={`price-${plan.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={d.price}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [plan.id]: { ...d, price: e.target.value } }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cur-${plan.id}`}>Currency</Label>
                      <Input
                        id={`cur-${plan.id}`}
                        value={d.currency}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [plan.id]: { ...d, currency: e.target.value.toUpperCase().slice(0, 8) } }))}
                        placeholder="USD"
                        maxLength={8}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`wl-${plan.id}`}>Writing corrections included</Label>
                    <Input
                      id={`wl-${plan.id}`}
                      type="number"
                      min={0}
                      value={d.writingLimit}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [plan.id]: { ...d, writingLimit: e.target.value } }))}
                      placeholder="0"
                    />
                    <p className="text-[11px] text-muted-foreground">Letters this tier lets a student submit for correction. Students cannot submit more than this (plus any writing packages they buy).</p>
                  </div>
                  <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Other limits (read-only here): Reading {plan.readingLimit} · Listening {plan.listeningLimit} · Past papers{" "}
                    {plan.pastPaperLimit} · {plan.durationDays} days
                  </div>
                  <Button type="button" onClick={() => void save(plan)} disabled={savingId === plan.id}>
                    <span className="inline-flex items-center justify-center gap-2">
                      {savingId === plan.id ? <InlineLoader label="Saving plan" size="sm" /> : "Save package"}
                    </span>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plans found. Seed the database or create plans via the API.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
