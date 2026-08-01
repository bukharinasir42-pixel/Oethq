import { apiFetch } from "./api";

export type ActivityDone = { lecture: boolean; test: boolean; spelling: boolean; podcast: boolean; article: boolean };

export type AccountabilityStudent = {
  userId: string;
  name: string;
  email: string;
  status: string;
  plan: string | null;
  done: ActivityDone;
  /** Which of the five tasks this student's access actually includes. */
  applicable?: ActivityDone;
  /** How many tasks were expected of them today (applicable ones only). */
  expected?: number;
  completed: number;
  missed: number;
  /** Clicked "Submit today's work" on the dashboard. */
  submitted: boolean;
};

export type AccountabilityRoster = {
  dayKey: number;
  students: AccountabilityStudent[];
  summary: { total: number; allDone: number; incomplete: number; submitted: number };
};

export type StudentTestRow = {
  attemptId: string; testId: string; title: string; type: "READING" | "LISTENING";
  status: string; startedAt: string | null; submittedAt: string | null; dayKey: number | null;
  autoSubmitted: boolean;
  score: number | null; totalQuestions: number | null;
  partAScore: number | null; partBScore: number | null; partCScore: number | null;
  scaledScore: number | null; grade: string | null;
};

export type StudentDayRow = {
  dayKey: number; date: string;
  lecture: boolean; spelling: boolean; article: boolean; podcast: boolean; drill: boolean;
  submitted: boolean; tests: number;
};

export type StudentHistory = {
  student: {
    id: string; name: string; email: string; joinedAt: string; lastLogin: string | null;
    plan: string | null; planStatus: string | null; accessEnds: string | null;
    courses: { name: string; slug: string | null; endDate: string | null }[];
  };
  summary: {
    activeDays: number; submittedDays: number; testsSubmitted: number;
    bestScaled: number | null; avgScaled: number | null;
    avgReading: number | null; avgListening: number | null;
    firstActivity: string | null; lastActivity: string | null;
  };
  tests: StudentTestRow[];
  days: StudentDayRow[];
};

export const accountabilityApi = {
  student: (userId: string) => apiFetch<StudentHistory>(`/admin/accountability/student/${encodeURIComponent(userId)}`),
  roster: (day?: number, token?: string) =>
    apiFetch<AccountabilityRoster>(`/admin/accountability${day !== undefined ? `?day=${day}` : ""}`, token !== undefined ? { token } : {}),
  warn: (userId: string, day?: number) =>
    apiFetch<{ userId: string; email: string; delivered: boolean; missing: string[] }>("/admin/accountability/warn", { method: "POST", body: { userId, ...(day !== undefined ? { day } : {}) } }),
  warnBulk: (userIds: string[], day?: number) =>
    apiFetch<{ requested: number; sent: number; failed: number }>("/admin/accountability/warn-bulk", { method: "POST", body: { userIds, ...(day !== undefined ? { day } : {}) } })
};

/** Convert a UTC dayKey (days since epoch) ⇄ a yyyy-mm-dd string. */
export const dayKeyToDate = (dayKey: number) => new Date(dayKey * 86_400_000).toISOString().slice(0, 10);
export const dateToDayKey = (iso: string) => Math.floor(new Date(iso + "T00:00:00Z").getTime() / 86_400_000);
export const todayKey = () => Math.floor(Date.now() / 86_400_000);
