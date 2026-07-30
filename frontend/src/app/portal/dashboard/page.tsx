"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { PassReadinessChart } from "@/components/portal/dashboard/pass-readiness-chart";
import { RetainedScoresChart } from "@/components/portal/dashboard/retained-scores-chart";
import { NasirBandScale } from "@/components/portal/nasir-band-scale";
import { PortalErrorAlert } from "@/components/portal/portal-error-alert";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { DashboardDto } from "@/lib/types";

type SubscriptionStatusDto = {
  status: string;
  plan?: { name: string; tier: string };
  expiresInDays?: number;
};

export default function DashboardPage() {
  const { token, profile, status, error, refresh, logout } = useSession();
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = async () => {
    if (!token || !profile) return;
    setLoadError(null);
    try {
      const [dashboardResponse, subscriptionResponse] = await Promise.all([
        apiFetch<DashboardDto>(`/subscriptions/dashboard?userId=${encodeURIComponent(profile.id)}`, { token }),
        apiFetch<SubscriptionStatusDto>(`/subscriptions/status?userId=${encodeURIComponent(profile.id)}`, { token })
      ]);
      setDashboard(dashboardResponse);
      setSubscription(subscriptionResponse);
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load dashboard");
    }
  };

  useEffect(() => {
    void reload();
  }, [token, profile]);

  const retainedResults = dashboard?.retainedResults ?? [];
  // Free trial: no exam pass-probability indicator.
  const isFreeTrial = subscription?.plan?.tier === "STARTER";

  const scoreSummary = useMemo(() => {
    if (retainedResults.length === 0) return null;
    const reading = retainedResults.filter((r) => r.test.type === "READING");
    const listening = retainedResults.filter((r) => r.test.type === "LISTENING");
    return { reading: reading.length, listening: listening.length };
  }, [retainedResults]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading progress and readiness..." layout="dashboard" />;
  }

  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to review readiness and progress."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <PortalShell
      title="Progress"
      description="Monitor retained scores, your latest NASIR band, and readiness trends across Reading and Listening."
      profile={profile}
      packageName={subscription?.plan?.name}
      statusLabel={subscription?.status ? `Status: ${subscription.status}` : undefined}
      expiryLabel={
        subscription?.expiresInDays !== undefined ? `${subscription.expiresInDays} days left` : undefined
      }
      onRefresh={() => void reload()}
      onLogout={logout}
    >
      {loadError ? (
        <PortalErrorAlert title="Unable to load readiness data" description={loadError} onRetry={() => void reload()} />
      ) : null}

      <section className="portal-hero-strip">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Readiness</p>
        <h2 className="mt-1 font-portal-display text-xl font-semibold text-[hsl(var(--primary-deep))]">Progress at a glance</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          NASIR band and retained scores from your Reading and Listening attempts.
        </p>
      </section>

      <section className="portal-stat-grid">
        <Card className="portal-card surface-panel-subtle">
          <CardHeader>
            <CardDescription>NASIR band</CardDescription>
            <CardTitle>{dashboard?.summary.nasirBand || "No band yet"}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="portal-card">
          <CardHeader>
            <CardDescription>Average retained score</CardDescription>
            <CardTitle>{dashboard?.summary.averageScore || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="portal-card">
          <CardHeader>
            <CardDescription>Reading average</CardDescription>
            <CardTitle>{dashboard?.breakdown.readingAverage || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="portal-card">
          <CardHeader>
            <CardDescription>Listening average</CardDescription>
            <CardTitle>{dashboard?.breakdown.listeningAverage || 0}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <NasirBandScale activeBand={dashboard?.summary.nasirBand} className="portal-inset-panel" />

      <section className="portal-two-col">
        <Card className="portal-card equal-card">
          <CardHeader className="space-y-2">
            <CardTitle>Retained score comparison</CardTitle>
            <CardDescription>
              Latest kept result per test — sky is Reading, green is Listening. Dashed line is your average.
            </CardDescription>
          </CardHeader>
          <CardContent className="equal-card-body">
            {retainedResults.length > 0 ? (
              <>
                <RetainedScoresChart results={retainedResults} className="w-full min-h-[180px]" />
                {scoreSummary ? (
                  <div className="mt-4 flex flex-wrap gap-4 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
                      Reading ({scoreSummary.reading})
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden />
                      Listening ({scoreSummary.listening})
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No retained scores to chart yet"
                description="Complete a test from the Task Management area to unlock a readiness trend here."
              />
            )}
          </CardContent>
        </Card>

        {!isFreeTrial && (
        <Card className="portal-card equal-card">
          <CardHeader className="space-y-2">
            <CardTitle>Pass readiness</CardTitle>
            <CardDescription>Probability gauge and skill averages from your retained results.</CardDescription>
          </CardHeader>
          <CardContent className="equal-card-body">
            <PassReadinessChart
              passProbability={dashboard?.summary.passProbability ?? 0}
              readingAverage={dashboard?.breakdown.readingAverage ?? 0}
              listeningAverage={dashboard?.breakdown.listeningAverage ?? 0}
              totalAttempts={dashboard?.summary.totalAttempts ?? 0}
              retainedCount={dashboard?.summary.retainedResults ?? 0}
            />
          </CardContent>
        </Card>
        )}
      </section>
    </PortalShell>
  );
}
