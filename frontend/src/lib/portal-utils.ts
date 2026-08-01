import type { TaskItem, TestSummaryDto } from "@/lib/types";

/**
 * "coming-soon" replaces the old "locked": on the study plan a day with nothing
 * in it is not gated, it is simply unbuilt. Calling it locked implied it would
 * open later, which it never does — days only open when a lecture is uploaded.
 */
export type TaskDayState = "coming-soon" | "open";

export type TaskActivityKind = "lecture" | "article" | "reading" | "listening" | "pastPaper" | "cheatSheet";

export type TaskActivity = {
  kind: TaskActivityKind;
  label: string;
  available: boolean;
  locked: boolean;
  href?: string;
};

function hasLectureResource(task: TaskItem) {
  return Boolean(task.lectureUrl?.trim()) || Boolean(task.lectureAsset?.signedUrl);
}

/**
 * Activities shown for a study-plan day.
 *
 * Lectures only. The daily article, the Reading and Listening exams and the
 * cheat sheet all used to appear here as well, but they duplicate what the
 * Reading and Listening course modules already provide, so the study plan now
 * carries just the lecture. Nothing is unassigned in the database — the tests
 * still back the free trial's Day-1 sample and the course modules — this is
 * purely what the day view renders.
 */
export function getTaskActivities(task: TaskItem): TaskActivity[] {
  if (!hasLectureResource(task)) return [];
  return [
    {
      kind: "lecture",
      label: task.lectureTitle || "Lecture",
      available: true,
      locked: task.lectureLocked,
      href: !task.lectureLocked ? task.lectureAsset?.signedUrl || task.lectureUrl || undefined : undefined
    }
  ];
}

export function getConfiguredItemCount(task: TaskItem) {
  return getTaskActivities(task).length;
}

export function getOpenItemCount(task: TaskItem) {
  return getTaskActivities(task).filter((item) => !item.locked).length;
}

export function getTaskDayProgressPercent(task: TaskItem) {
  const configured = getConfiguredItemCount(task);
  if (configured === 0) return 0;
  return Math.round((getOpenItemCount(task) / configured) * 100);
}

export function getTaskDayState(task: TaskItem): TaskDayState {
  return getOpenItemCount(task) > 0 ? "open" : "coming-soon";
}

/**
 * Day is "Done" only when both Reading and Listening tests are linked
 * and the candidate has a retained result for each.
 */
export function isDayPracticeComplete(task: TaskItem, completedTestIds: Set<string> | ReadonlySet<string>): boolean {
  const readingId = task.readingTest?.id;
  const listeningId = task.listeningTest?.id;
  if (!readingId || !listeningId) return false;
  return completedTestIds.has(readingId) && completedTestIds.has(listeningId);
}

export function findNextOpenTask(tasks: TaskItem[]) {
  const sorted = [...tasks].sort((a, b) => a.dayNumber - b.dayNumber);
  return sorted.find((task) => getOpenItemCount(task) > 0) ?? null;
}

export function getPlanProgress(tasks: TaskItem[]) {
  const total = tasks.length;
  const openDays = tasks.filter((t) => getOpenItemCount(t) > 0).length;
  const lockedDays = tasks.filter((t) => getOpenItemCount(t) === 0).length;
  const engaged = total > 0 ? Math.round(((total - lockedDays) / total) * 100) : 0;
  return { total, openDays, lockedDays, engaged };
}

export function formatTestDurationMinutes(test: TestSummaryDto) {
  return test.timerDuration;
}

export function isTechnicalError(message: string) {
  return (
    message.includes("prisma") ||
    message.includes("Invalid `") ||
    message.includes("invocation") ||
    message.length > 180
  );
}

export function humanizeError(message: string) {
  if (isTechnicalError(message)) {
    return "We could not load your study data right now. Please try again in a moment.";
  }
  return message;
}
