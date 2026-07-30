import { apiFetch } from "./api";

export type SuspendedUser = {
  id: string;
  name: string;
  email: string;
  screenshotStrikes: number;
  suspendedAt: string | null;
  suspendedReason: string | null;
};

export const securityApi = {
  listSuspended: () => apiFetch<SuspendedUser[]>("/security/suspended"),
  reinstate: (userId: string) => apiFetch<{ ok: boolean }>(`/security/users/${userId}/reinstate`, { method: "POST", body: {} }),
  suspend: (userId: string, reason?: string) =>
    apiFetch<{ ok: boolean }>(`/security/users/${userId}/suspend`, { method: "POST", body: { reason } })
};
