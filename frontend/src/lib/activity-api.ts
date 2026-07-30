import { apiFetch } from "./api";

export type ActivityKind = "lecture" | "spelling" | "article" | "podcast";

/** Fire-and-forget: record that the student did a daily activity. Never throws. */
export function markActivity(kind: ActivityKind): void {
  void apiFetch("/activity/mark", { method: "POST", body: { kind } }).catch(() => {});
}
