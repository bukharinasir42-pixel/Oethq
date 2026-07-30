"use client";

/**
 * /portal/course-tests?skill=READING|LISTENING — the practice + mock tests that
 * ship with a standalone skill course. Owned skill → tests are launchable; not
 * owned → the whole surface is locked behind the upgrade modal.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalPageHead } from "@/components/portal/portal-primitives";
import { PortalErrorAlert } from "@/components/portal/portal-error-alert";
import { PortalUpgradeModal } from "@/components/portal/portal-upgrade-modal";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { usePortalPlanAccess } from "@/hooks/use-portal-plan-access";
import { useSession } from "@/hooks/use-session";
import { lecturesApi, type CourseTest } from "@/lib/lectures-api";

const ClipIco = () => <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12l2 2 4-4" /></svg>;
const QIco = () => <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
const ClockIco = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;

function CourseTestsInner() {
  const raw = useSearchParams().get("skill")?.toUpperCase();
  const skill: "READING" | "LISTENING" = raw === "LISTENING" ? "LISTENING" : "READING";
  const skillLabel = skill === "READING" ? "Reading" : "Listening";

  const { profile, status, error, refresh, logout } = useSession();
  const { subscription, planTier } = usePortalPlanAccess();
  const isFreeTrial = planTier === "STARTER";
  const [tests, setTests] = useState<CourseTest[]>([]);
  const [locked, setLocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const reload = async () => {
    setLoadError(null); setLoading(true);
    try {
      const res = await lecturesApi.courseTests(skill);
      setTests(res.tests);
      setLocked(res.locked);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load tests");
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [skill]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading tests..." layout="table" />;
  }
  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to view tests."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <PortalShell
      title={`${skillLabel} tests`}
      description={`Practice and mock tests from your OET ${skillLabel} course.`}
      profile={profile}
      packageName={subscription?.plan?.name}
      onRefresh={() => void reload()}
      onLogout={logout}
    >
      {loadError ? (
        <PortalErrorAlert title="Unable to load tests" description={loadError} onRetry={() => void reload()} />
      ) : loading ? (
        <WorkspaceLoadingState title="Loading tests..." layout="table" />
      ) : (
        <>
          <PortalPageHead
            eyebrow={`${skillLabel} course`}
            title={`${skillLabel} tests`}
            description="Practice and mock tests in the real exam interface, under the exam clock. Take the linked test straight after each method lecture."
          >
            {!locked && <div className="phead-meta"><span className="mchip"><b>{tests.length}</b> <span>tests</span></span></div>}
          </PortalPageHead>

          {locked ? (
            <section className="card card-pad" style={{ textAlign: "center" }}>
              <h2 style={{ marginBottom: 8 }}>Unlock the OET {skillLabel} Course</h2>
              <p style={{ maxWidth: 460, margin: "0 auto 18px", color: "var(--text)", lineHeight: 1.6 }}>
                The {skillLabel} practice and mock tests are part of the {skillLabel} course. Add it to your plan to start practising right away.
              </p>
              <button className="btn btn-primary" type="button" onClick={() => setShowUpgrade(true)}>Upgrade to unlock</button>
            </section>
          ) : tests.length === 0 ? (
            <section className="card card-pad" style={{ textAlign: "center" }}>
              <h2 style={{ marginBottom: 8 }}>No tests yet</h2>
              <p style={{ color: "var(--text)", lineHeight: 1.6 }}>Your {skillLabel} tests appear here once they are published.</p>
            </section>
          ) : (
            <div className="split">
              <div>
                <section className="card">
                  <div className="card-head"><div><h2>{skillLabel} practice &amp; mock tests</h2><p>Every paper is timed in the real exam interface.</p></div></div>
                  <div className="rows">
                    {tests.map((t) => (
                      <div className="row" key={t.id}>
                        <span className="row-ico"><ClipIco /></span>
                        <span className="row-t">
                          <b>{t.title}</b>
                          {t.description ? <p>{t.description}</p> : null}
                          <span className="row-meta">
                            <span><QIco />{t.totalQuestions} questions</span>
                            {t.timerDuration ? <span><ClockIco />{t.timerDuration} min</span> : null}
                          </span>
                        </span>
                        <span className="row-r">
                          {t.locked ? (
                            <button className="btn btn-quiet btn-sm" type="button" onClick={() => setShowUpgrade(true)}>Upgrade</button>
                          ) : (
                            <Link className="btn btn-primary btn-sm" href={`/portal/tests/${t.id}`}>Start</Link>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <aside className="ctx">
                <section className="card card-pad">
                  <p className="caps">Before you start</p>
                  <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                    Watch the method lecture for each part first, then sit the linked test under the clock. That is where the method sticks.
                  </p>
                  <Link className="btn btn-quiet btn-sm" href={`/portal/lectures?skill=${skill}`} style={{ width: "100%" }}>Watch the {skillLabel} lectures</Link>
                </section>
              </aside>
            </div>
          )}
        </>
      )}

      <PortalUpgradeModal isFreeTrial={isFreeTrial} skill={skill} open={showUpgrade} onOpenChange={(v) => { if (!v) setShowUpgrade(false); }} />
    </PortalShell>
  );
}

export default function CourseTestsPage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Loading tests..." layout="table" />}>
      <CourseTestsInner />
    </Suspense>
  );
}
