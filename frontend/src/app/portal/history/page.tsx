"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalPageHead } from "@/components/portal/portal-primitives";
import { PortalErrorAlert } from "@/components/portal/portal-error-alert";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { TestSummaryDto } from "@/lib/types";

type AttemptHistoryItem = {
  id: string;
  status: string;
  section: string;
  score?: number | null;
  bandLabel?: string | null;
  submittedAt?: string | null;
  updatedAt: string;
  test: TestSummaryDto;
};

type ResultHistoryResponse = {
  attempts: AttemptHistoryItem[];
};

type SubscriptionStatusDto = {
  status: string;
  plan?: { name: string; tier: string };
  expiresInDays?: number;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function getAttemptMode(status: string) {
  return status === "AUTO_SUBMITTED" ? "Auto-submit" : "Manual";
}

export default function HistoryPage() {
  const { token, profile, status, error, refresh, logout } = useSession();
  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = async () => {
    if (!token || !profile) return;
    setLoadError(null);
    try {
      const [historyResponse, subscriptionResponse] = await Promise.all([
        apiFetch<ResultHistoryResponse>("/tests/results/mine", { token }),
        apiFetch<SubscriptionStatusDto>(`/subscriptions/status?userId=${encodeURIComponent(profile.id)}`, { token })
      ]);
      setAttempts(historyResponse.attempts);
      setSubscription(subscriptionResponse);
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load attempt history");
    }
  };

  useEffect(() => {
    void reload();
  }, [token, profile]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading attempt history..." layout="table" />;
  }

  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to review attempt history."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <PortalShell
      title="Retake History"
      description="Every submission is recorded here, including auto-submits and later retakes that replaced older retained results."
      profile={profile}
      packageName={subscription?.plan?.name}
      statusLabel={subscription?.status ? `Status: ${subscription.status}` : undefined}
      expiryLabel={
        subscription?.expiresInDays !== undefined ? `${subscription.expiresInDays} days left` : undefined
      }
      onRefresh={() => void reload()}
      onLogout={logout}
    >
      {loadError ? (
        <PortalErrorAlert title="Unable to load attempt history" description={loadError} onRetry={() => void reload()} />
      ) : null}

      <PortalPageHead
        eyebrow="Retake history"
        title="Every submission on record"
        description="Every attempt is kept here — manual and auto-submitted — including retakes that later replaced a retained result."
      >
        <div className="phead-meta">
          <span className="mchip"><b>{attempts.length}</b> <span>recorded attempts</span></span>
          <span className="mchip"><b>{attempts.filter((a) => a.score == null).length}</b> <span>pending</span></span>
          <span className="mchip"><b>{attempts.filter((a) => a.status === "AUTO_SUBMITTED").length}</b> <span>auto-submits</span></span>
        </div>
      </PortalPageHead>

      {attempts.length === 0 ? (
        <section className="card card-pad" style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>No attempts recorded yet</h2>
          <p style={{ color: "var(--text)", lineHeight: 1.6 }}>
            Your completed and auto-submitted attempts appear here after you start taking tests.
          </p>
        </section>
      ) : (
        <section className="card">
          <div className="card-head"><div><h2>Attempt timeline</h2><p>Every attempt, including auto-submissions and attempts that were later replaced.</p></div></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Test</th><th>Type</th><th>Status</th><th>Submitted</th><th>Score</th><th>Band</th><th>Mode</th></tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.test.title}</b></td>
                    <td><span className={`tag ${a.test.type === "LISTENING" ? "tag-ink" : "tag-blue"}`}>{titleCase(a.test.type)}</span></td>
                    <td><span className="tag tag-grey">{titleCase(a.status.replaceAll("_", " "))}</span></td>
                    <td className="num">{fmtDate(a.submittedAt || a.updatedAt)}</td>
                    <td className="num">{a.score ?? "—"}</td>
                    <td>{a.bandLabel ? <span className="tag tag-ink">{a.bandLabel}</span> : "—"}</td>
                    <td>{getAttemptMode(a.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </PortalShell>
  );
}
