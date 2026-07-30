import { apiFetch } from "./api";

export type WritingCaseNoteLite = { id: string; title: string; wordGuidance: string | null; timeLimitMin: number };
export type WritingLibrary = {
  profession: string | null;
  writingCode: string | null;
  totalCorrections: number;
  allowed: number;
  used: number;
  remaining: number;
  planLimit: number;
  packageLimit: number;
  caseNotes: WritingCaseNoteLite[];
};
export type WritingCaseNote = {
  id: string;
  title: string;
  profession: string;
  scenario: string;
  caseNotesHtml: string;
  wordGuidance: string | null;
  timeLimitMin: number;
};
export type WritingSubmitResult = { id: string; letterNumber: number; studentCode: string; wordCount: number; delivered: boolean };
export type WritingHistory = {
  writingCode: string | null;
  total: number;
  submissions: { id: string; caseNoteTitle: string; letterNumber: number; wordCount: number; autoSubmitted: boolean; submittedAt: string }[];
};

// admin
export type AdminCaseNoteRow = { id: string; title: string; wordGuidance: string | null; timeLimitMin: number; displayOrder: number; isActive: boolean; createdAt: string };
export type AdminCaseNoteFull = { id: string; profession: string; title: string; scenario: string; caseNotesHtml: string; wordGuidance: string | null; timeLimitMin: number; isActive: boolean; displayOrder: number };
export type AdminSubmissionRow = {
  id: string; userId: string; studentName: string; studentEmail: string; studentCode: string;
  profession: string; caseNoteTitle: string; letterNumber: number; wordCount: number;
  autoSubmitted: boolean; emailDelivered: boolean; submittedAt: string; studentTotal: number;
};
export type CaseNoteInput = { title: string; scenario: string; caseNotesHtml: string; wordGuidance?: string | null; timeLimitMin?: number | null };

export const writingApi = {
  // candidate
  library: () => apiFetch<WritingLibrary>("/writing/library"),
  caseNote: (id: string) => apiFetch<WritingCaseNote>(`/writing/case-notes/${id}`),
  submit: (caseNoteId: string, letterText: string, auto = false) =>
    apiFetch<WritingSubmitResult>("/writing/submit", { method: "POST", body: { caseNoteId, letterText, auto } }),
  my: () => apiFetch<WritingHistory>("/writing/my"),

  // admin
  adminCounts: () => apiFetch<Record<string, { total: number; active: number }>>("/admin/writing/counts"),
  adminList: (profession: string) => apiFetch<{ caseNotes: AdminCaseNoteRow[] }>(`/admin/writing?profession=${encodeURIComponent(profession)}`),
  adminGet: (id: string) => apiFetch<AdminCaseNoteFull>(`/admin/writing/${id}`),
  adminCreate: (profession: string, data: CaseNoteInput) => apiFetch<{ id: string }>("/admin/writing", { method: "POST", body: { profession, ...data } }),
  adminUpdate: (id: string, data: Partial<CaseNoteInput & { isActive: boolean; displayOrder: number }>) => apiFetch<AdminCaseNoteFull>(`/admin/writing/${id}`, { method: "PATCH", body: data }),
  adminDelete: (id: string) => apiFetch<{ ok: boolean }>(`/admin/writing/${id}`, { method: "DELETE" }),
  adminSettings: () => apiFetch<{ settings: Record<string, string>; globalDefault: string }>("/admin/writing/settings"),
  adminSetSetting: (profession: string, correctionEmail: string) => apiFetch<{ ok: boolean }>("/admin/writing/settings", { method: "PUT", body: { profession, correctionEmail } }),
  adminSubmissions: (q: { profession?: string; userId?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.profession) p.set("profession", q.profession);
    if (q.userId) p.set("userId", q.userId);
    const qs = p.toString();
    return apiFetch<{ submissions: AdminSubmissionRow[] }>(`/admin/writing/submissions${qs ? `?${qs}` : ""}`);
  },
  adminSubmission: (id: string) => apiFetch<AdminCaseNoteFull & { letterText: string; letterNumber: number; wordCount: number; studentCode: string; submittedAt: string; caseNoteTitle: string; student: { name: string; email: string; writingCode: string | null } | null }>(`/admin/writing/submissions/${id}`)
};
