import type { TaskItem, TestSummaryDto } from "@/lib/types";

export type TaskDayState = "locked" | "open";

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

export function getTaskActivities(task: TaskItem): TaskActivity[] {
  const items: TaskActivity[] = [];

  if (hasLectureResource(task)) {
    items.push({
      kind: "lecture",
      label: task.lectureTitle || "Lecture",
      available: true,
      locked: task.lectureLocked,
      href: !task.lectureLocked ? task.lectureAsset?.signedUrl || task.lectureUrl || undefined : undefined
    });
  }
  const hasCoreSkillsResource =
    Boolean(task.articleUrl?.trim()) || Boolean(task.articleAsset?.signedUrl || task.articleAsset?.publicUrl);
  if (hasCoreSkillsResource) {
    items.push({
      kind: "article",
      label: task.articleTitle || "Core skills",
      available: true,
      locked: task.coreSkillsLocked || task.articleLocked,
      href: !(task.coreSkillsLocked || task.articleLocked)
        ? task.articleAsset?.signedUrl || task.articleAsset?.publicUrl || task.articleUrl || undefined
        : undefined
    });
  }
  if (task.readingTest) {
    items.push({
      kind: "reading",
      label: "Reading exam",
      available: true,
      locked: task.readingLocked,
      href: !task.readingLocked ? `/portal/tests/${task.readingTest.id}` : undefined
    });
  }
  if (task.listeningTest) {
    items.push({
      kind: "listening",
      label: "Listening exam",
      available: true,
      locked: task.listeningLocked,
      href: !task.listeningLocked ? `/portal/tests/${task.listeningTest.id}` : undefined
    });
  }
  const cheatSheetUrl =
    task.cheatSheetAsset?.signedUrl?.trim() || task.cheatSheetAsset?.publicUrl?.trim() || "";
  if (cheatSheetUrl) {
    items.push({
      kind: "cheatSheet",
      label: "Cheat sheet",
      available: true,
      locked: task.cheatSheetLocked,
      href: !task.cheatSheetLocked ? cheatSheetUrl : undefined
    });
  }
  return items;
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
  return getOpenItemCount(task) > 0 ? "open" : "locked";
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
