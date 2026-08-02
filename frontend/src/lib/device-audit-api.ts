/** Admin device tracking — shared-account detection and blocking. */
import { apiFetch } from "@/lib/api";

export type FlaggedAccount = {
  userId: string;
  name: string;
  email: string;
  suspended: boolean;
  devices: number;
  liveDevices: number;
  evictions: number;
  countries: string[];
  cities: string[];
  ipCount: number;
  hardwareCount: number;
  lastSeenAt: string;
  score: number;
  risk: "high" | "medium" | "low" | "none";
  /** Plain-English signals behind the score. */
  reasons: string[];
};

export type SharingReport = {
  generatedAt: string;
  /** No session has ever recorded a country — the CDN is not passing geo headers. */
  geoUnavailable: boolean;
  totalAccounts: number;
  flagged: FlaggedAccount[];
};

export type DeviceRow = {
  id: string;
  label: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  fingerprint: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  live: boolean;
};

export type DeviceList = {
  limit: number;
  liveCount: number;
  evictions: number;
  sessions: DeviceRow[];
};

export const deviceAuditApi = {
  report: (minScore?: number) =>
    apiFetch<SharingReport>(`/admin/device-audit${minScore != null ? `?minScore=${minScore}` : ""}`),
  devices: (userId: string) => apiFetch<DeviceList>(`/admin/users/${userId}/devices`),
  /** End one device. */
  revokeDevice: (sessionId: string) =>
    apiFetch<{ ok: boolean }>(`/admin/devices/${sessionId}`, { method: "DELETE" }),
  /** Sign the student out everywhere. */
  revokeAll: (userId: string) =>
    apiFetch<{ ended: number }>(`/admin/users/${userId}/devices`, { method: "DELETE" }),
  /** Block the account outright — they cannot sign in again until reinstated. */
  suspend: (userId: string, reason: string) =>
    apiFetch<{ ok: boolean }>(`/security/users/${userId}/suspend`, { method: "POST", body: { reason } }),
  reinstate: (userId: string) =>
    apiFetch<{ ok: boolean }>(`/security/users/${userId}/reinstate`, { method: "POST", body: {} })
};
