import { apiFetch } from "./api";

export type CohortSlot = "LECTURE" | "CORE_SKILLS";

export type CohortSession = {
  slot: CohortSlot;
  title: string;
  durationMin: number | null;
  scheduledAtUtc: string;
  scheduledLocal: string;
  state:
    | "LOCKED" | "UPCOMING" | "STARTING_SOON" | "AVAILABLE" | "IN_PROGRESS"
    | "MISSED" | "RECORDING_AVAILABLE" | "COMPLETED";
  attendance: "UPCOMING" | "ATTENDED" | "LATE" | "MISSED" | "EXCUSED";
  watchPct: number;
  resumePositionSec: number;
  embedUrl: string | null;
  primaryAction: string;
  earlyAccess: boolean;
};

export type CohortTest = {
  type: "READING" | "LISTENING";
  testId: string;
  title: string;
  status: string;
  score: number | null;
  bandLabel: string | null;
  action: string;
};

export type CohortDay = {
  dayNumber: number;
  title: string;
  summary: string | null;
  isToday: boolean;
  sessions: CohortSession[];
  tests: CohortTest[];
  dayStatus: string;
  completionPct: number;
};

export type CohortMe = {
  onboarded: boolean;
  schedule: {
    country: string; timezone: string; class1Time: string; class2Time: string;
    startDate: string; totalDays: number; restWeekday: number; lockedAt: string | null;
  } | null;
  programmeDays: number;
};

export type TimelineDay = {
  dayNumber: number; title: string; date: string;
  label: "Done" | "Today" | "Catch-up" | "Available" | "Upcoming"; completionPct: number;
};

export type CohortChatMessage = {
  id: string;
  authorName: string;
  role: string; // CANDIDATE | STAFF | ADMIN
  text: string;
  createdAtUtc: string;
  mine: boolean;
};

export type AttendanceDashboard = {
  attendanceRate: number; sessionsAttended: number; sessionsMissed: number;
  currentStreak: number; avgActiveWatchMin: number; warningCount: number;
  log: Array<{
    dayNumber: number; title: string; slot: CohortSlot;
    scheduledLocal: string; firstJoinedLocal: string | null;
    activeWatchMin: number; attendance: string; completed: boolean;
    reading?: { score: number | null; band: string | null } | null;
    listening?: { score: number | null; band: string | null } | null;
  }>;
};

export const cohortApi = {
  me: () => apiFetch<CohortMe>("/cohort/me"),
  saveTimezone: (country: string, timezone: string) =>
    apiFetch<CohortMe>("/cohort/onboarding/timezone", {
      method: "POST", body: { country, timezone }
    }),
  saveSchedule: (class1Time: string, class2Time: string) =>
    apiFetch<CohortMe>("/cohort/onboarding/schedule", {
      method: "POST", body: { class1Time, class2Time }
    }),
  today: () => apiFetch<{ state: string } & Partial<CohortDay> & { lastDayNumber?: number }>("/cohort/today"),
  days: () => apiFetch<{ days: TimelineDay[] }>("/cohort/days"),
  day: (n: number) => apiFetch<CohortDay>(`/cohort/days/${n}`),
  join: (n: number, slot: CohortSlot) =>
    apiFetch<CohortDay>(`/cohort/sessions/${n}/${slot}/join`, { method: "POST" }),
  progress: (n: number, slot: CohortSlot, positionSec: number, activeDeltaSec: number, mode: "live" | "recording") =>
    apiFetch<{ ok: boolean; completed: boolean }>(`/cohort/sessions/${n}/${slot}/progress`, {
      method: "POST", body: { positionSec, activeDeltaSec, mode }
    }),
  pending: () => apiFetch<{ pendingCount: number; days: Array<{ dayNumber: number; completionPct: number }> }>("/cohort/pending"),
  attendance: () => apiFetch<AttendanceDashboard>("/cohort/attendance"),
  chat: (n: number, slot: CohortSlot, after?: string) =>
    apiFetch<{ messages: CohortChatMessage[] }>(
      `/cohort/sessions/${n}/${slot}/chat${after ? `?after=${encodeURIComponent(after)}` : ""}`
    ),
  sendChat: (n: number, slot: CohortSlot, text: string) =>
    apiFetch<CohortChatMessage>(`/cohort/sessions/${n}/${slot}/chat`, {
      method: "POST", body: { text }
    })
};
