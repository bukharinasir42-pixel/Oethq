import { apiFetch, apiUpload } from "./api";
import type { OetTestImport } from "./oet-test-schema";
import type { StorageAssetDto } from "./types";

export type OetAudioState = {
  kind: "asset" | "url" | null;
  url: string | null;
  title: string | null;
};

export type OetValidateResult =
  | { ok: true; type: "READING" | "LISTENING"; title: string; totalQuestions: number }
  | { ok: false; errors: string[] };

export type OetImportResult = {
  id: string;
  type: "READING" | "LISTENING";
  title: string;
  totalQuestions: number;
  isPublished: boolean;
};

export type OetPlayable = {
  test: {
    id: string;
    type: "READING" | "LISTENING";
    title: string;
    timerDuration: number;
    partATimer: number | null;
    partBCTimer: number | null;
    /** Resolved session-audio URL for listening tests (null if none attached). */
    audioUrl?: string | null;
  };
  /** contentJson with the answer key stripped. */
  content: OetTestImport;
  attempt: { id: string; expiresAt: string; answers: Record<string, string>; startedAt: string } | null;
};

export type OetStartResult = { attemptId: string; expiresAt: string; answers: Record<string, string> };

export type OetResult = {
  attemptId: string;
  testId: string;
  title: string;
  type: "READING" | "LISTENING";
  status: string;
  submitted: boolean;
  answers: Record<string, string>;
  scaledScore: number;
  grade: string;
  gradeLabel: string;
  pass: boolean;
  correct: number;
  total: number;
  partACorrect: number;
  partBCorrect: number;
  partCCorrect: number;
  perQuestion: Record<number, boolean>;
  /** full content WITH answer key (review). */
  content: OetTestImport;
};

export type OetAdminDetail = {
  id: string;
  type: "READING" | "LISTENING";
  title: string;
  description: string | null;
  totalQuestions: number;
  timerDuration: number;
  partATimer: number | null;
  partBCTimer: number | null;
  isPublished: boolean;
  contentSchemaVersion: number | null;
  audio: OetAudioState | null;
  content: OetTestImport;
};

export const oetTestsApi = {
  // admin
  validate: (json: unknown) => apiFetch<OetValidateResult>("/oet-tests/validate", { method: "POST", body: { json } }),
  import: (json: unknown, testId?: string) =>
    apiFetch<OetImportResult>("/oet-tests/import", { method: "POST", body: { json, testId } }),
  adminDetail: (id: string) => apiFetch<OetAdminDetail>(`/oet-tests/${id}/admin`),
  publish: (id: string, isPublished: boolean) =>
    apiFetch<{ id: string; isPublished: boolean }>(`/tests/${id}/publish`, { method: "PUT", body: { isPublished } }),
  // admin: listening audio
  getAudio: (id: string) => apiFetch<OetAudioState>(`/oet-tests/${id}/audio`),
  setAudio: (id: string, body: { audioAssetId?: string | null; audioUrl?: string | null }) =>
    apiFetch<OetAudioState>(`/oet-tests/${id}/audio`, { method: "PUT", body }),
  /** Upload an audio file, returning the stored asset (its id feeds setAudio). */
  uploadAudio: (file: File, onProgress?: (percent: number) => void) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", file.name);
    return apiUpload<StorageAssetDto>("/storage/upload/AUDIO", fd, { onProgress });
  },
  // candidate
  play: (id: string) => apiFetch<OetPlayable>(`/oet-tests/${id}/play`),
  start: (id: string) => apiFetch<OetStartResult>(`/oet-tests/${id}/attempts/start`, { method: "POST", body: {} }),
  saveProgress: (attemptId: string, answers: Record<string, string>) =>
    apiFetch<{ ok: boolean }>(`/oet-attempts/${attemptId}/progress`, { method: "PUT", body: { answers } }),
  submit: (attemptId: string, answers: Record<string, string>, auto = false) =>
    apiFetch<OetResult>(`/oet-attempts/${attemptId}/submit`, { method: "POST", body: { answers, auto } }),
  result: (attemptId: string) => apiFetch<OetResult>(`/oet-attempts/${attemptId}/result`)
};
