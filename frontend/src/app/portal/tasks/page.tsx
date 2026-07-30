"use client";

import { useEffect, useMemo, useState } from "react";
import { TaskControlDeck } from "@/components/admin/task-control-deck";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalErrorAlert } from "@/components/portal/portal-error-alert";
import { CompleteCourseGate } from "@/components/portal/complete-course-gate";
import { HowToIntroductionPanel } from "@/components/portal/how-to-introduction-panel";
import { TaskDayViewer } from "@/components/portal/task-day-viewer";
import { OnboardingModal, ScheduleSettingsModal } from "@/components/cohort/cohort-classes";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { usePortalPlanAccess } from "@/hooks/use-portal-plan-access";
import { cohortApi, type CohortDay, type CohortMe } from "@/lib/cohort-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { formatTaskDayTitle } from "@/lib/task-day-utils";
import { getOpenItemCount, isDayPracticeComplete } from "@/lib/portal-utils";
import type { HowToIntroductionDto, RetainedResultDto, TaskBuilderItem, TaskItem } from "@/lib/types";

type SubscriptionStatusDto = {
  status: string;
  plan?: { name: string; tier: string };
  expiresInDays?: number;
};

type ResultHistoryResponse = {
  retainedResults: RetainedResultDto[];
};

const DAY_PAGE_SIZE = 10;

function getTaskSearchValue(task: TaskItem) {
  return [
    formatTaskDayTitle(task.dayNumber),
    `day ${task.dayNumber}`,
    task.summary || "",
    task.lectureTitle,
    task.articleTitle
  ]
    .join(" ")
    .toLowerCase();
}

function hasTaskContent(task: TaskBuilderItem) {
  return Boolean(
    task.lectureTitle?.trim() ||
      task.articleTitle?.trim() ||
      task.lectureUrl?.trim() ||
      task.articleUrl?.trim() ||
      task.articleContent?.trim() ||
      task.readingTest ||
      task.listeningTest
  );
}

export default function TasksPage() {
  const { token, profile, status, error, refresh, logout } = useSession();
  const { completeExperienceAccess, loaded: planLoaded } = usePortalPlanAccess();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completedTestIds, setCompletedTestIds] = useState<Set<string>>(() => new Set());
  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [dayPageIndex, setDayPageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"introduction" | "study-plan">("study-plan");
  const [introduction, setIntroduction] = useState<HowToIntroductionDto | null>(null);
  // Cohort layer: scheduled live sessions for the selected day + onboarding state.
  const [cohortMe, setCohortMe] = useState<CohortMe | null>(null);
  const [cohortDay, setCohortDay] = useState<CohortDay | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [introductionLoading, setIntroductionLoading] = useState(true);
  const [introductionError, setIntroductionError] = useState<string | null>(null);

  const reload = async () => {
    if (!token || !profile) return;
    setLoadError(null);
    setIntroductionLoading(true);
    setIntroductionError(null);
    try {
      const [taskResult, subscriptionResult, introductionResult, resultsResult] = await Promise.allSettled([
        apiFetch<TaskItem[]>(`/tasks/for-user?userId=${encodeURIComponent(profile.id)}`, { token }),
        apiFetch<SubscriptionStatusDto>(`/subscriptions/status?userId=${encodeURIComponent(profile.id)}`, { token }),
        apiFetch<HowToIntroductionDto>("/how-to-introduction", { token }),
        apiFetch<ResultHistoryResponse>("/tests/results/mine", { token })
      ]);

      if (taskResult.status === "fulfilled") {
        const sorted = [...taskResult.value].sort((left, right) => left.dayNumber - right.dayNumber);
        setTasks(sorted);
        setSelectedDayNumber((current) => {
          if (current && sorted.some((task) => task.dayNumber === current)) {
            return current;
          }
          return sorted.find((task) => getOpenItemCount(task) > 0)?.dayNumber ?? sorted[0]?.dayNumber ?? null;
        });
      } else {
        setLoadError(taskResult.reason instanceof Error ? taskResult.reason.message : "Failed to load tasks");
      }

      if (subscriptionResult.status === "fulfilled") {
        setSubscription(subscriptionResult.value);
      }

      if (introductionResult.status === "fulfilled") {
        setIntroduction(introductionResult.value);
      } else {
        setIntroductionError(
          introductionResult.reason instanceof Error
            ? introductionResult.reason.message
            : "Failed to load introduction video"
        );
      }

      if (resultsResult.status === "fulfilled") {
        setCompletedTestIds(new Set(resultsResult.value.retainedResults.map((result) => result.testId)));
      } else {
        setCompletedTestIds(new Set());
      }
    } finally {
      setIntroductionLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [token, profile]);

  // Deep-link support: /portal/tasks?day=N (from reminder emails / old cohort links).
  useEffect(() => {
    if (typeof window === "undefined" || tasks.length === 0) return;
    const dayParam = new URLSearchParams(window.location.search).get("day");
    const n = dayParam ? Number(dayParam) : NaN;
    if (Number.isFinite(n) && tasks.some((t) => t.dayNumber === n)) setSelectedDayNumber(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length]);

  // Cohort onboarding state (class-time schedule) — drives scheduled sessions.
  const loadCohortMe = () => {
    if (!token || !profile) return;
    cohortApi.me().then(setCohortMe).catch(() => setCohortMe(null));
  };
  useEffect(() => {
    if (!token || !profile || !completeExperienceAccess) return;
    loadCohortMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, profile, completeExperienceAccess]);

  // Load the selected day's live cohort sessions (only once onboarded).
  const refreshCohortDay = () => {
    if (!token || !profile || !cohortMe?.onboarded || selectedDayNumber == null) {
      setCohortDay(null);
      return;
    }
    cohortApi.day(selectedDayNumber).then(setCohortDay).catch(() => setCohortDay(null));
  };
  useEffect(() => {
    refreshCohortDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, profile, cohortMe?.onboarded, selectedDayNumber]);

  const openTasks = useMemo(() => tasks.filter((task) => getOpenItemCount(task) > 0), [tasks]);
  const lockedTasks = useMemo(() => tasks.filter((task) => getOpenItemCount(task) === 0), [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter((task) => !normalizedQuery || getTaskSearchValue(task).includes(normalizedQuery));
  }, [query, tasks]);

  useEffect(() => {
    setDayPageIndex(0);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / DAY_PAGE_SIZE));
  const safePageIndex = Math.min(dayPageIndex, totalPages - 1);
  const pageStart = safePageIndex * DAY_PAGE_SIZE;
  const pagedTasks = filteredTasks.slice(pageStart, pageStart + DAY_PAGE_SIZE);

  useEffect(() => {
    if (!filteredTasks.length) return;
    if (!selectedDayNumber || !filteredTasks.some((task) => task.dayNumber === selectedDayNumber)) {
      setSelectedDayNumber(filteredTasks[0].dayNumber);
    }
  }, [filteredTasks, selectedDayNumber]);

  const selectedTask =
    tasks.find((task) => task.dayNumber === selectedDayNumber) ?? filteredTasks[0] ?? null;
  const selectedTaskIndex = selectedTask
    ? tasks.findIndex((task) => task.dayNumber === selectedTask.dayNumber)
    : -1;
  const previousTask = selectedTaskIndex > 0 ? tasks[selectedTaskIndex - 1] : null;
  const nextTask =
    selectedTaskIndex >= 0 && selectedTaskIndex < tasks.length - 1 ? tasks[selectedTaskIndex + 1] : null;

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading your study plan..." layout="editor" />;
  }

  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to open your study plan."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  if (profile && !planLoaded) {
    return <WorkspaceLoadingState title="Loading your study plan..." layout="editor" />;
  }

  // The daily study plan is the Complete Course journey. Standalone-only buyers
  // (no active subscription) see an upgrade gate instead.
  if (planLoaded && !completeExperienceAccess) {
    return (
      <PortalShell
        title="Study plan"
        description="Your guided day-by-day OET journey."
        profile={profile}
        packageName={subscription?.plan?.name}
        onRefresh={() => void reload()}
        onLogout={logout}
      >
        <CompleteCourseGate
          title="The daily study plan is part of the Complete Course"
          description="Your standalone course is self-paced with its own lectures, tests and past papers. Upgrade to a Complete Course for the guided day-by-day study plan."
        />
      </PortalShell>
    );
  }

  return (
    <PortalShell
      title="Task Management"
      description="Review your 40-day plan, open unlocked resources, and launch any available Reading or Listening attempt."
      profile={profile}
      compact
      packageName={subscription?.plan?.name}
      statusLabel={subscription?.status ? `Status: ${subscription.status}` : undefined}
      expiryLabel={
        subscription?.expiresInDays !== undefined ? `${subscription.expiresInDays} days left` : undefined
      }
      onRefresh={() => void reload()}
      onLogout={logout}
    >
      {loadError ? (
        <PortalErrorAlert title="Unable to load tasks" description={loadError} onRetry={() => void reload()} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 py-1">
        <Badge variant="outline" className="tabular-nums">
          {tasks.length} total days
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {filteredTasks.length} visible
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {openTasks.length} open
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {lockedTasks.length} locked
        </Badge>
      </div>

      {!loadError && tasks.length === 0 ? (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "introduction" | "study-plan")} className="mt-2 space-y-6">
          <TabsList className="grid h-auto w-full max-w-xl grid-cols-2">
            <TabsTrigger value="introduction" className="whitespace-normal px-3 py-2 text-left">
              {introduction?.title?.trim() || "Introduction (How to use)"}
            </TabsTrigger>
            <TabsTrigger value="study-plan" className="whitespace-normal px-3 py-2 text-left">
              Study plan
            </TabsTrigger>
          </TabsList>
          <TabsContent value="introduction" className="mt-0">
            <HowToIntroductionPanel intro={introduction} loading={introductionLoading} error={introductionError} />
          </TabsContent>
          <TabsContent value="study-plan" className="mt-0">
            <EmptyState
              title="Your study plan is still empty"
              description="Once your plan is published, each day will appear here with resources and unlocked test actions."
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "introduction" | "study-plan")} className="mt-2 space-y-6">
          <TabsList className="grid h-auto w-full max-w-xl grid-cols-2">
            <TabsTrigger value="introduction" className="whitespace-normal px-3 py-2 text-left">
              {introduction?.title?.trim() || "Introduction (How to use)"}
            </TabsTrigger>
            <TabsTrigger value="study-plan" className="whitespace-normal px-3 py-2 text-left">
              Study plan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="introduction" className="mt-0">
            <HowToIntroductionPanel intro={introduction} loading={introductionLoading} error={introductionError} />
          </TabsContent>

          <TabsContent value="study-plan" className="mt-0">
        {cohortMe && !cohortMe.onboarded ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Set your daily class times</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Pick your country, timezone and two class times once — your lectures then unlock live each day with reminders, chat and recordings.</p>
            </div>
          </div>
        ) : cohortMe?.schedule ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3">
            <p className="text-sm text-muted-foreground">
              Class times: <span className="font-semibold text-foreground">{cohortMe.schedule.class1Time}</span> &amp; <span className="font-semibold text-foreground">{cohortMe.schedule.class2Time}</span> · {cohortMe.schedule.timezone}
            </p>
            <button type="button" onClick={() => setScheduleOpen(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary">
              ✏️ Change class times
            </button>
          </div>
        ) : null}
        <section className="flex w-full min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="w-full min-w-0 lg:max-w-[400px]">
            <TaskControlDeck
              mode="candidate"
              taskCount={tasks.length}
              visibleCount={filteredTasks.length}
              publishedCount={0}
              configuredCount={tasks.filter(hasTaskContent).length}
              unsavedCount={0}
              openDayCount={openTasks.length}
              lockedDayCount={lockedTasks.length}
              query={query}
              onQueryChange={setQuery}
              pageIndex={safePageIndex}
              totalPages={totalPages}
              pageStart={pageStart}
              onPagePrev={() => setDayPageIndex((current) => Math.max(0, current - 1))}
              onPageNext={() => setDayPageIndex((current) => Math.min(totalPages - 1, current + 1))}
              pagedTasks={pagedTasks}
              selectedDayNumber={selectedDayNumber}
              onSelectDay={setSelectedDayNumber}
              dirtyDays={[]}
              isTaskConfigured={hasTaskContent}
              isDayOpen={(task: TaskBuilderItem) => getOpenItemCount(task as TaskItem) > 0}
              isDayComplete={(task: TaskBuilderItem) => isDayPracticeComplete(task as TaskItem, completedTestIds)}
            />
          </div>

          <div className="min-w-0 w-full">
            {selectedTask ? (
              <TaskDayViewer
                selectedTask={selectedTask}
                previousTask={previousTask}
                nextTask={nextTask}
                completedTestIds={completedTestIds}
                onSelectDay={setSelectedDayNumber}
                cohortSessions={cohortMe?.onboarded ? cohortDay?.sessions ?? null : null}
                onCohortRefresh={refreshCohortDay}
              />
            ) : (
              <Card className="border-border shadow-[var(--shadow-card)]">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <EmptyState
                    title="Select a day to view"
                    description="Pick a row in the day list to see lectures, core skills, article, and assignments."
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </section>
          </TabsContent>
        </Tabs>
      )}

      {completeExperienceAccess && cohortMe && !cohortMe.onboarded ? (
        <OnboardingModal onDone={() => { loadCohortMe(); }} />
      ) : null}
      {scheduleOpen && cohortMe?.schedule ? (
        <ScheduleSettingsModal
          schedule={cohortMe.schedule}
          onClose={() => setScheduleOpen(false)}
          onDone={() => { setScheduleOpen(false); loadCohortMe(); refreshCohortDay(); }}
        />
      ) : null}
    </PortalShell>
  );
}
