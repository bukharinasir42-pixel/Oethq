"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { TaskControlDeck } from "@/components/admin/task-control-deck";
import { TaskDayEditor, type EditableTask } from "@/components/admin/task-day-editor";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { formatTaskDayTitle } from "@/lib/task-day-utils";
import type { TaskBuilderItem, TestSummaryDto } from "@/lib/types";

const EMPTY_VALUE = "__none__";
const DAY_PAGE_SIZE = 10;

function isTaskConfigured(task: EditableTask) {
  return [task.lectureTitle, task.articleTitle].every((value) => Boolean(value?.trim()));
}

function hydrateTasks(taskResponse: TaskBuilderItem[]): EditableTask[] {
  return taskResponse
    .map((task) => ({
      ...task,
      assignedReadingTestId: task.readingTest?.id || "",
      assignedListeningTestId: task.listeningTest?.id || "",
      lectureAssetId: task.lectureAsset?.id || "",
      lectureThumbnailAssetId: task.lectureThumbnailAsset?.id || "",
      articleAssetId: task.articleAsset?.id || "",
      articleThumbnailAssetId: task.articleThumbnailAsset?.id || "",
      articlePdfAssetId: task.articlePdfAsset?.id || "",
      cheatSheetAssetId: task.cheatSheetAsset?.id || ""
    }))
    .sort((left, right) => left.dayNumber - right.dayNumber);
}

function getTaskSearchValue(task: EditableTask) {
  return [
    formatTaskDayTitle(task.dayNumber),
    `day ${task.dayNumber}`,
    task.summary || "",
    task.lectureTitle,
    task.articleTitle,
    task.pastPaperTitle || ""
  ]
    .join(" ")
    .toLowerCase();
}

export default function TaskBuilderPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [tests, setTests] = useState<TestSummaryDto[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [dirtyDays, setDirtyDays] = useState<number[]>([]);
  const [dayPageIndex, setDayPageIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!token || !profile || profile.role !== "ADMIN") return;
      setLoadingData(true);
      setLoadError(null);
      try {
        await apiFetch("/tasks/ensure-template", { method: "POST", token, body: {} });
        const [taskResponse, testResponse] = await Promise.all([
          apiFetch<TaskBuilderItem[]>("/tasks", { token }),
          apiFetch<TestSummaryDto[]>("/tests/admin", { token })
        ]);
        const hydratedTasks = hydrateTasks(taskResponse);

        setSelectedDayNumber((current) => {
          if (current && hydratedTasks.some((task) => task.dayNumber === current)) {
            return current;
          }

          return hydratedTasks[0]?.dayNumber ?? null;
        });
        setDirtyDays([]);
        setTasks(hydratedTasks);
        setTests(testResponse);
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load task builder");
      } finally {
        setLoadingData(false);
      }
    };

    void load();
  }, [token, profile]);

  const readingTestOptions = useMemo(
    () =>
      tests
        .filter((test) => test.type === "READING" && test.isPublished)
        .map((test) => ({
          label: test.title,
          value: test.id
        })),
    [tests]
  );

  const listeningTestOptions = useMemo(
    () =>
      tests
        .filter((test) => test.type === "LISTENING" && test.isPublished)
        .map((test) => ({
          label: test.title,
          value: test.id
        })),
    [tests]
  );

  const updateTask = (dayNumber: number, patch: Partial<EditableTask>) => {
    setDirtyDays((current) => (current.includes(dayNumber) ? current : [...current, dayNumber]));
    setTasks((current) =>
      current.map((task) => (task.dayNumber === dayNumber ? { ...task, ...patch } : task))
    );
  };

  const saveTask = async (task: EditableTask) => {
    setSavingDay(task.dayNumber);
    try {
      await apiFetch(`/tasks/${task.dayNumber}`, {
        method: "PUT",
        token,
        body: {
          title: formatTaskDayTitle(task.dayNumber),
          summary: task.summary,
          lectureTitle: task.lectureTitle,
          lectureUrl: task.lectureUrl?.trim() || null,
          lectureAssetId: task.lectureAssetId?.trim() || null,
          lectureThumbnailAssetId: task.lectureThumbnailAssetId?.trim() || null,
          articleTitle: task.articleTitle,
          articleUrl: task.articleUrl?.trim() || null,
          articleContent: task.articleContent || undefined,
          articleAssetId: task.articleAssetId?.trim() || null,
          articleThumbnailAssetId: task.articleThumbnailAssetId?.trim() || null,
          articlePdfAssetId: task.articlePdfAssetId?.trim() || null,
          cheatSheetAssetId: task.cheatSheetAssetId?.trim() || null,
          assignedReadingTestId: task.assignedReadingTestId || undefined,
          assignedListeningTestId: task.assignedListeningTestId || undefined,
          isPublished: task.isPublished
        }
      });
      setDirtyDays((current) => current.filter((dayNumber) => dayNumber !== task.dayNumber));
      toast.success(`Saved Day ${task.dayNumber}`);
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to save task");
    } finally {
      setSavingDay(null);
    }
  };

  const [mutating, setMutating] = useState(false);

  const addDay = async () => {
    setMutating(true);
    try {
      const res = await apiFetch<TaskBuilderItem[]>("/tasks/add", { method: "POST", token, body: {} });
      const hydrated = hydrateTasks(res);
      setTasks(hydrated);
      const newest = hydrated[hydrated.length - 1];
      if (newest) setSelectedDayNumber(newest.dayNumber);
      toast.success("Day added as a draft — publish it to show it on the front end");
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to add day");
    } finally {
      setMutating(false);
    }
  };

  const deleteDay = async (dayNumber: number) => {
    setMutating(true);
    try {
      const res = await apiFetch<TaskBuilderItem[]>(`/tasks/${dayNumber}`, { method: "DELETE", token });
      const hydrated = hydrateTasks(res);
      setTasks(hydrated);
      setDirtyDays((current) => current.filter((d) => d !== dayNumber));
      setSelectedDayNumber(hydrated[0]?.dayNumber ?? null);
      toast.success(`Removed Day ${dayNumber}`);
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to remove day");
    } finally {
      setMutating(false);
    }
  };

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks.filter((task) => {
      return !normalizedQuery || getTaskSearchValue(task).includes(normalizedQuery);
    });
  }, [query, tasks]);

  useEffect(() => {
    setDayPageIndex(0);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / DAY_PAGE_SIZE));
  const safePageIndex = Math.min(dayPageIndex, totalPages - 1);
  const pageStart = safePageIndex * DAY_PAGE_SIZE;
  const pagedTasks = filteredTasks.slice(pageStart, pageStart + DAY_PAGE_SIZE);

  useEffect(() => {
    if (!filteredTasks.length) {
      return;
    }

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
  const publishedCount = tasks.filter((task) => task.isPublished).length;
  const configuredCount = tasks.filter((task) => isTaskConfigured(task)).length;
  const unsavedCount = dirtyDays.length;

  if (status === "loading" || status === "idle" || loadingData) {
    return <WorkspaceLoadingState title="Loading task builder..." layout="editor" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage the daily task plan."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell
      title="Daily Task Builder"
      description="Pick a day, edit titles, lecture/article links, test assignments, and publish state. The page scrolls so the full editor stays reachable."
      profile={profile}
      compact
      onRefresh={refresh}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Unable to load task builder" description={loadError} /> : null}

      {/* Match legacy layout: document scroll (no fillContent), compact metrics, then plan + editor */}
      <div className="flex flex-wrap items-center gap-2 py-1">
        <Badge variant="outline" className="tabular-nums">
          {tasks.length} total days
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {filteredTasks.length} visible
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {publishedCount} published
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {configuredCount} content-ready
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {unsavedCount} unsaved
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void addDay()} disabled={mutating} className="cursor-pointer">
            <Plus className="mr-1.5 h-4 w-4" /> Add day
          </Button>
          {selectedTask ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={mutating} className="cursor-pointer text-destructive hover:text-destructive">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove Day {selectedTask.dayNumber}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Day {selectedTask.dayNumber}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the day and its lecture/core-skills content, and removes it from the
                    students&apos; Scheduled Cohort Lectures. Test assignments are unlinked (the tests themselves stay). This
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void deleteDay(selectedTask.dayNumber)}
                  >
                    Remove day
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <section className="mt-2 flex w-full min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="w-full min-w-0 lg:max-w-[400px]">
          <TaskControlDeck
            taskCount={tasks.length}
            visibleCount={filteredTasks.length}
            publishedCount={publishedCount}
            configuredCount={configuredCount}
            unsavedCount={unsavedCount}
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
            dirtyDays={dirtyDays}
            isTaskConfigured={isTaskConfigured}
          />
        </div>

        <div className="min-w-0 w-full">
          {selectedTask ? (
            <TaskDayEditor
              selectedTask={selectedTask}
              previousTask={previousTask}
              nextTask={nextTask}
              onSelectDay={setSelectedDayNumber}
              dirtyDays={dirtyDays}
              isTaskConfigured={isTaskConfigured}
              onUpdate={updateTask}
              onSave={saveTask}
              saving={savingDay === selectedTask.dayNumber}
              readingTestOptions={readingTestOptions}
              listeningTestOptions={listeningTestOptions}
              emptyTestValue={EMPTY_VALUE}
              token={token}
            />
          ) : (
            <Card className="border-border shadow-[var(--shadow-card)]">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <EmptyState
                  title="Select a day to edit"
                  description="Pick a row in the plan list to load the editor."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
