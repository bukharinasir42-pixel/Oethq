import { apiFetch } from "./api";

export const DRILL_MODULES = ["part-a-core", "part-bc-core", "spellings", "part-c-podcasts"] as const;
export type DrillModule = (typeof DRILL_MODULES)[number];

export const DRILL_MODULE_LABEL: Record<DrillModule, string> = {
  "part-a-core": "Reading Part A · Core skills",
  "part-bc-core": "Reading Part B & C · Core skills",
  spellings: "Listening spellings",
  "part-c-podcasts": "Part C podcasts"
};

export type DrillOfDay = {
  id: string;
  title: string;
  html: string;
  total: number;
  dayKey: number;
  nextRotatesInMs: number;
};

export type AdminDrill = {
  id: string;
  title: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  sizeKb: number;
};

export const skillDrillsApi = {
  // Candidate
  ofDay: (module: string) =>
    apiFetch<{ drill: DrillOfDay | null }>(`/skill-drills/of-day?module=${encodeURIComponent(module)}`),

  // Admin
  adminCounts: () => apiFetch<Record<string, { total: number; active: number }>>("/admin/skill-drills/counts"),
  adminList: (module: string) =>
    apiFetch<{ drills: AdminDrill[] }>(`/admin/skill-drills?module=${encodeURIComponent(module)}`),
  adminGet: (id: string) => apiFetch<AdminDrill & { html: string; module: string }>(`/admin/skill-drills/${id}`),
  adminCreate: (module: string, drills: Array<{ title: string; html: string }>) =>
    apiFetch<{ created: number }>("/admin/skill-drills", { method: "POST", body: { module, drills } }),
  adminUpdate: (id: string, data: Partial<{ title: string; isActive: boolean; displayOrder: number }>) =>
    apiFetch<AdminDrill>(`/admin/skill-drills/${id}`, { method: "PATCH", body: data }),
  adminDelete: (id: string) => apiFetch<{ ok: boolean }>(`/admin/skill-drills/${id}`, { method: "DELETE" })
};
