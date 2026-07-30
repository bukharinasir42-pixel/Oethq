import { apiFetch } from "./api";

/** The compact bank shape the assessment engine consumes. */
export type SpellingBank = {
  cats: { n: string; h: string }[];
  items: [string, number, number][];
  count: number;
};

/** Today's rotating spelling set (a window of the bank that changes every 24h). */
export type SpellingDailyBank = SpellingBank & {
  total: number;
  perDay: number;
  dayKey: number;
  nextRotatesInMs: number;
};

export type AdminSpellingTerm = {
  id: string;
  term: string;
  category: string;
  hint: string;
  difficulty: number;
  words: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SpellingCounts = { total: number; active: number; byCategory: Record<string, number> };

export const spellingApi = {
  // Candidate
  bank: () => apiFetch<SpellingBank>("/spelling/bank"),
  daily: () => apiFetch<SpellingDailyBank>("/spelling/daily"),

  // Admin
  adminCounts: () => apiFetch<SpellingCounts>("/admin/spelling-terms/counts"),
  adminList: (opts: { search?: string; category?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (opts.search) q.set("search", opts.search);
    if (opts.category) q.set("category", opts.category);
    if (opts.page) q.set("page", String(opts.page));
    if (opts.pageSize) q.set("pageSize", String(opts.pageSize));
    return apiFetch<{ rows: AdminSpellingTerm[]; total: number; page: number; pageSize: number }>(
      `/admin/spelling-terms?${q.toString()}`
    );
  },
  adminCreate: (terms: Array<{ term: string; category: string; hint?: string; difficulty?: number; words?: number }>) =>
    apiFetch<{ created: number }>("/admin/spelling-terms", { method: "POST", body: { terms } }),
  adminUpdate: (id: string, data: Partial<Pick<AdminSpellingTerm, "term" | "category" | "hint" | "difficulty" | "isActive">>) =>
    apiFetch<AdminSpellingTerm>(`/admin/spelling-terms/${id}`, { method: "PATCH", body: data }),
  adminDelete: (id: string) => apiFetch<{ ok: boolean }>(`/admin/spelling-terms/${id}`, { method: "DELETE" })
};
