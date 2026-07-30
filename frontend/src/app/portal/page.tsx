"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { PremiumPortalDashboard } from "@/components/portal/premium-portal-dashboard";
import { StandaloneCourseDashboard } from "@/components/portal/standalone-course-dashboard";
import { PortalErrorAlert } from "@/components/portal/portal-error-alert";
import { ResumeExamBanner } from "@/components/portal/resume-exam-banner";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { usePortalPlanAccess } from "@/hooks/use-portal-plan-access";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { DashboardDto, RetainedResultDto, TaskItem } from "@/lib/types";

type SubscriptionStatusDto = {
  status: string;
  plan?: { name: string; tier: string };
  expiresInDays?: number;
};

type ResultHistoryResponse = {
  retainedResults: RetainedResultDto[];
};

export default function PortalHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectPlanId = searchParams.get("selectPlan");
  const selectTier = searchParams.get("selectTier");
  const pendingAssignKey = selectTier || selectPlanId;
  const { token, profile, status, error, refresh, logout } = useSession();
  const { completeExperienceAccess, ownsSkill, ownedSkills, skillAccess, passPredictor, accessDaysLeft, loaded: planLoaded } = usePortalPlanAccess();
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completedTestIds, setCompletedTestIds] = useState<Set<string>>(() => new Set());
  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assigningPlan, setAssigningPlan] = useState(false);
  const assignedPlanRef = useRef<string | null>(null);

  const reload = async () => {
    if (!token || !profile) return;
    setLoadError(null);
    try {
      const [dashboardResponse, taskResponse, subscriptionResponse, resultsResponse] = await Promise.all([
        apiFetch<DashboardDto>(`/subscriptions/dashboard?userId=${encodeURIComponent(profile.id)}`, { token }),
        apiFetch<TaskItem[]>(`/tasks/for-user?userId=${encodeURIComponent(profile.id)}`, { token }),
        apiFetch<SubscriptionStatusDto>(`/subscriptions/status?userId=${encodeURIComponent(profile.id)}`, {
          token
        }),
        apiFetch<ResultHistoryResponse>("/tests/results/mine", { token }).catch(() => ({ retainedResults: [] }))
      ]);
      setDashboard(dashboardResponse);
      setTasks(taskResponse);
      setSubscription(subscriptionResponse);
      setCompletedTestIds(new Set(resultsResponse.retainedResults.map((row) => row.testId)));
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load portal home");
    }
  };

  useEffect(() => {
    if (!token || !profile || !pendingAssignKey || assignedPlanRef.current === pendingAssignKey) {
      return;
    }
    assignedPlanRef.current = pendingAssignKey;
    setAssigningPlan(true);
    void (async () => {
      try {
        await apiFetch("/subscriptions/select-plan", {
          method: "POST",
          token,
          body: selectTier ? { tier: selectTier } : { planId: selectPlanId }
        });
      } finally {
        router.replace("/portal");
        setAssigningPlan(false);
      }
    })();
  }, [token, profile, pendingAssignKey, selectPlanId, selectTier, router]);

  useEffect(() => {
    if (assigningPlan) return;
    void reload();
  }, [token, profile, assigningPlan]);

  if (status === "loading" || status === "idle" || assigningPlan) {
    return (
      <WorkspaceLoadingState
        title={assigningPlan ? "Assigning your plan..." : "Loading candidate portal..."}
        layout="minimal"
      />
    );
  }

  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to view your study overview."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const activeAttempt = dashboard?.activeAttempt;
  // Show the student's REAL remaining access (course entitlement OR subscription,
  // whichever is longer) — not just the subscription, which for a course-only
  // student is the lapsed free trial.
  const expiresInDays = accessDaysLeft ?? subscription?.expiresInDays;

  return (
    <PortalShell
      title="Dashboard"
      description="Track readiness, continue active attempts, and jump into the next available task from your study plan."
      profile={profile}
      packageName={subscription?.plan?.name}
      examCountdownLabel={
        expiresInDays !== undefined ? `${expiresInDays} day${expiresInDays === 1 ? "" : "s"} left` : undefined
      }
      onRefresh={() => void reload()}
      onLogout={logout}
    >
      {loadError ? (
        <PortalErrorAlert title="Unable to load portal overview" description={loadError} onRetry={() => void reload()} />
      ) : null}

      {activeAttempt ? <ResumeExamBanner attempt={activeAttempt} /> : null}

      {!planLoaded ? (
        <WorkspaceLoadingState title="Loading your course..." layout="minimal" />
      ) : completeExperienceAccess || ownedSkills.length > 0 ? (
        // Complete/trial students get the full tiled dashboard; single-skill buyers
        // get the same dashboard focused on the skill(s) they own (rest shown locked).
        <PremiumPortalDashboard
          profileName={profile.name}
          dashboard={dashboard}
          tasks={tasks}
          completedTestIds={completedTestIds}
          ownedSkills={ownedSkills}
          skillAccess={skillAccess}
          fullAccess={completeExperienceAccess}
          passPredictor={passPredictor}
          accessDaysLeft={accessDaysLeft}
        />
      ) : (
        <StandaloneCourseDashboard profileName={profile.name} ownsSkill={ownsSkill} />
      )}
    </PortalShell>
  );
}
