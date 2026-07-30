import { apiFetch } from "./api";

export type ActivityDone = { lecture: boolean; test: boolean; spelling: boolean; podcast: boolean; article: boolean };

export type AccountabilityStudent = {
  userId: string;
  name: string;
  email: string;
  status: string;
  plan: string | null;
  done: ActivityDone;
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

export const accountabilityApi = {
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
