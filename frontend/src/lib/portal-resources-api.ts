import { apiFetch } from "./api";

export type PortalResourcePlacement =
  | "READING_CHEATSHEET"
  | "LISTENING_CHEATSHEET"
  | "READING_ARTICLE_INTRO"
  | "ONBOARDING_INTRO";
export type PortalResourceKind = "PDF" | "VIDEO";

/** Candidate-facing (URLs already resolved server-side; premium fields withheld if locked). */
export type CheatSheetItem = {
  id: string;
  kind: PortalResourceKind;
  title: string;
  description: string | null;
  displayOrder: number;
  pdfUrl: string | null;
  embedUrl: string | null;
};

export type CheatSheetResponse = {
  skill: "READING" | "LISTENING";
  locked: boolean;
  pdfs: CheatSheetItem[];
  videos: CheatSheetItem[];
};

export type ArticleIntro = {
  id: string;
  title: string;
  description: string | null;
  embedUrl: string | null;
};

/** Admin row (full). */
export type AdminPortalResource = {
  id: string;
  placement: PortalResourcePlacement;
  kind: PortalResourceKind;
  title: string;
  description: string | null;
  displayOrder: number;
  pdfUrl: string | null;
  bunnyVideoId: string | null;
  videoUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortalResourceInput = {
  placement: PortalResourcePlacement;
  kind: PortalResourceKind;
  title: string;
  description?: string | null;
  displayOrder?: number;
  pdfUrl?: string | null;
  bunnyVideoId?: string | null;
  videoUrl?: string | null;
  isPublished?: boolean;
};

export const portalResourcesApi = {
  // Candidate
  cheatSheets: (skill: "READING" | "LISTENING") =>
    apiFetch<CheatSheetResponse>(`/cheat-sheets?skill=${skill}`),
  articleIntro: () => apiFetch<{ intro: ArticleIntro | null }>("/article-intro"),
  onboardingIntro: () => apiFetch<{ intro: CheatSheetItem | null; watched: boolean }>("/onboarding-intro"),
  onboardingComplete: () => apiFetch<{ ok: boolean; watched: boolean }>("/onboarding-intro/complete", { method: "POST", body: {} }),

  // Admin
  adminList: (placement?: PortalResourcePlacement) =>
    apiFetch<{ resources: AdminPortalResource[] }>(
      `/admin/portal-resources${placement ? `?placement=${placement}` : ""}`
    ),
  adminCreate: (data: PortalResourceInput) =>
    apiFetch<AdminPortalResource>("/admin/portal-resources", { method: "POST", body: data }),
  adminUpdate: (id: string, data: Partial<PortalResourceInput>) =>
    apiFetch<AdminPortalResource>(`/admin/portal-resources/${id}`, { method: "PATCH", body: data }),
  adminDelete: (id: string) =>
    apiFetch<{ ok: boolean }>(`/admin/portal-resources/${id}`, { method: "DELETE" })
};
