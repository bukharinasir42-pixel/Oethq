"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalPageHead } from "@/components/portal/portal-primitives";
import { PortalErrorAlert } from "@/components/portal/portal-error-alert";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { RetainedResultDto } from "@/lib/types";

type ResultHistoryResponse = {
  retainedResults: RetainedResultDto[];
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

/** OET grade enum → display label (C_PLUS → C+). */
function gradeLabel(g?: string | null) {
  return g === "C_PLUS" ? "C+" : g || "—";
}
/** OET pass is a B (scaled ≥ 350): A/B highlighted, rest neutral. */
function gradeTag(g?: string | null) {
  return g === "A" || g === "B" ? "tag tag-blue" : "tag tag-grey";
}

function getLatestResult(results: RetainedResultDto[]) {
  return results.reduce<RetainedResultDto | null>((latest, result) => {
    if (!latest) {
      return result;
    }

    return new Date(result.completedAt).getTime() > new Date(latest.completedAt).getTime() ? result : latest;
  }, null);
}

export default function ResultsPage() {
  const { token, profile, status, error, refresh, logout } = useSession();
  const [results, setResults] = useState<RetainedResultDto[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = async () => {
    if (!token || !profile) return;
    setLoadError(null);
    try {
      const [resultResponse, subscriptionResponse] = await Promise.all([
        apiFetch<ResultHistoryResponse>("/tests/results/mine", { token }),
        apiFetch<SubscriptionStatusDto>(`/subscriptions/status?userId=${encodeURIComponent(profile.id)}`, { token })
      ]);
      setResults(resultResponse.retainedResults);
      setSubscription(subscriptionResponse);
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load results");
    }
  };

  useEffect(() => {
    void reload();
  }, [token, profile]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading retained results..." layout="table" />;
  }

  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to review retained results."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const latestResult = getLatestResult(results);

  return (
    <PortalShell
      title="Results"
      description="Review the latest score kept for each test. Retakes remain in history, but these retained scores drive your dashboard."
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
        <PortalErrorAlert title="Unable to load retained results" description={loadError} onRetry={() => void reload()} />
      ) : null}

      <PortalPageHead
        eyebrow="Results"
        title="Your best result per test"
        description="The latest score kept for each test. Retakes stay in history, but these retained scores drive your dashboard and readiness reading."
      >
        <div className="phead-meta">
          <span className="mchip"><b>{results.length}</b> <span>retained tests</span></span>
          {latestResult?.scaledScore != null ? (
            <span className="mchip"><b>{latestResult.scaledScore}</b> <span>latest scaled / 500</span></span>
          ) : (
            <span className="mchip"><b>{results.length ? Math.round(results.reduce((t, r) => t + r.score, 0) / results.length) : 0}</b> <span>average raw</span></span>
          )}
          <span className="mchip"><b>{latestResult?.oetGrade ? gradeLabel(latestResult.oetGrade) : (latestResult?.bandLabel || "—")}</b> <span>latest grade</span></span>
        </div>
      </PortalPageHead>

      {results.length === 0 ? (
        <section className="card card-pad" style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>No retained results yet</h2>
          <p style={{ color: "var(--text)", lineHeight: 1.6 }}>
            Complete a Reading or Listening test to start building your retained-result history.
          </p>
        </section>
      ) : (
        <div className="split">
          <div>
            <section className="card">
              <div className="card-head"><div><h2>Retained result table</h2><p>These are the results currently counted in your readiness summary.</p></div></div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Test</th><th>Type</th><th>Completed</th><th>Scaled score</th><th>Grade</th><th>Raw</th><th>Part scores</th><th></th></tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td><b>{r.test.title}</b></td>
                        <td><span className={`tag ${r.test.type === "LISTENING" ? "tag-ink" : "tag-blue"}`}>{titleCase(r.test.type)}</span></td>
                        <td className="num">{fmtDate(r.completedAt)}</td>
                        <td>
                          {r.scaledScore != null
                            ? <b className="num">{r.scaledScore}<span style={{ color: "var(--mute)", fontWeight: 600 }}> / 500</span></b>
                            : <span className="num" style={{ color: "var(--faint)" }}>—</span>}
                        </td>
                        <td>{r.oetGrade ? <span className={gradeTag(r.oetGrade)}>{gradeLabel(r.oetGrade)}</span> : <span style={{ color: "var(--faint)" }}>—</span>}</td>
                        <td className="num">{r.score}<span style={{ color: "var(--mute)" }}> / 42</span></td>
                        <td className="num">A {r.partAScore || 0} · B {r.partBScore || 0} · C {r.partCScore || 0}</td>
                        <td><Link className="btn btn-quiet btn-sm" href="/portal/history">Review</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <aside className="ctx">
            <section className="card card-pad">
              <p className="caps">Reading this table</p>
              <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                Part scores show where the marks went. A 0 on Part A with 2 on B and C says the problem is speed, not comprehension.
              </p>
              <Link className="btn btn-primary btn-sm" href="/portal/skill-practice?skill=READING&module=part-a-core" style={{ width: "100%" }}>Work on Part A speed</Link>
            </section>
            <section className="card card-pad">
              <p className="caps">Where retakes go</p>
              <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                Every attempt is kept, including auto-submits. Only the latest one per test appears here.
              </p>
              <Link className="more" href="/portal/history">Open retake history <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
            </section>
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
