"use client";

import { useEffect, useState } from "react";
import { AdminOverviewDashboard } from "@/components/admin/admin-overview-dashboard";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { AdminOverviewDto, PlanDto, SubscribedUserDto } from "@/lib/types";

type TestStatsDto = {
  totalTests: number;
  publishedTests: number;
  attemptsInProgress: number;
  completedToday: number;
};

export default function AdminPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [overview, setOverview] = useState<AdminOverviewDto | null>(null);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [subscribedUsers, setSubscribedUsers] = useState<SubscribedUserDto[]>([]);
  const [testStats, setTestStats] = useState<TestStatsDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token || !profile || profile.role !== "ADMIN") return;
      try {
        const [overviewResponse, planResponse, subscribedResponse, statsResponse] = await Promise.all([
          apiFetch<AdminOverviewDto>("/users/overview", { token }),
          apiFetch<PlanDto[]>("/plans", { token }),
          apiFetch<SubscribedUserDto[]>("/users/subscribed", { token }),
          apiFetch<TestStatsDto>("/tests/stats", { token })
        ]);
        setOverview(overviewResponse);
        setPlans(planResponse);
        setSubscribedUsers(subscribedResponse);
        setTestStats(statsResponse);
      } catch (caughtError: unknown) {
        const message = caughtError instanceof Error ? caughtError.message : "Failed to load admin overview";
        setLoadError(message);
      }
    };

    void load();
  }, [token, profile]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading admin workspace..." layout="minimal" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage plans, tests, and candidate workflows."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const adminName = profile.name?.trim() || profile.email || "Admin";

  return (
    <AdminShell
      title="Overview"
      description="Pipeline health, pricing, and roster at a glance."
      profile={profile}
      onRefresh={refresh}
      onLogout={logout}
    >
      <AdminOverviewDashboard
        overview={overview}
        plans={plans}
        subscribedUsers={subscribedUsers}
        testStats={testStats}
        loadError={loadError}
        adminName={adminName}
      />
    </AdminShell>
  );
}
