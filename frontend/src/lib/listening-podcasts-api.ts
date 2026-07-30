import { apiFetch, apiUpload } from "./api";
import type { StorageAssetDto } from "./types";

export type PodcastStats = { listenedToday: boolean; streak: number; count: number };

export type PodcastOfDay = {
  id: string;
  kicker: string | null;
  title: string;
  description: string | null;
  durationSec: number | null;
  audioUrl: string | null;
  total: number;
  dayKey: number;
  nextRotatesInMs: number;
} & PodcastStats;

export type AdminPodcast = {
  id: string;
  kicker: string | null;
  title: string;
  description: string | null;
  durationSec: number | null;
  hasAudio: boolean;
  audioKind: "asset" | "url" | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
};

export type AdminPodcastFull = {
  id: string;
  kicker: string | null;
  title: string;
  description: string | null;
  audioAssetId: string | null;
  audioUrl: string | null;
  durationSec: number | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAudioUrl: string | null;
};

export type PodcastInput = {
  kicker?: string | null;
  title: string;
  description?: string | null;
  audioAssetId?: string | null;
  audioUrl?: string | null;
  durationSec?: number | null;
};

export const listeningPodcastsApi = {
  // Candidate
  ofDay: () => apiFetch<{ podcast: PodcastOfDay | null }>("/listening-podcasts/of-day"),
  markListened: () => apiFetch<PodcastStats>("/listening-podcasts/mark-listened", { method: "POST", body: {} }),

  // Admin
  adminCounts: () => apiFetch<{ total: number; active: number }>("/admin/listening-podcasts/counts"),
  adminList: () => apiFetch<{ podcasts: AdminPodcast[] }>("/admin/listening-podcasts"),
  adminGet: (id: string) => apiFetch<AdminPodcastFull>(`/admin/listening-podcasts/${id}`),
  adminCreate: (podcasts: PodcastInput[]) =>
    apiFetch<{ created: number }>("/admin/listening-podcasts", { method: "POST", body: { podcasts } }),
  adminUpdate: (id: string, data: Partial<PodcastInput & { isActive: boolean; displayOrder: number }>) =>
    apiFetch<AdminPodcastFull>(`/admin/listening-podcasts/${id}`, { method: "PATCH", body: data }),
  adminDelete: (id: string) => apiFetch<{ ok: boolean }>(`/admin/listening-podcasts/${id}`, { method: "DELETE" }),

  /** Upload an audio file → stored asset (its id feeds adminCreate/adminUpdate). */
  uploadAudio: (file: File, onProgress?: (p: number) => void) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", file.name);
    return apiUpload<StorageAssetDto>("/storage/upload/AUDIO", fd, { onProgress });
  }
};

/** Read an audio file's duration (seconds) in the browser, best-effort. */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(url); resolve(Number.isFinite(d) && d > 0 ? d : null); };
      a.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      a.src = url;
    } catch {
      resolve(null);
    }
  });
}

export function fmtDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
