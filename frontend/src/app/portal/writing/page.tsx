"use client";

/**
 * /portal/writing — the OET Writing course. Shows the case-note library for the
 * student's profession (each opens a timed 45-min letter task), plus their own
 * submission history: writing ID, total corrections and each letter's number.
 */
import { useCallback, useEffect, useState } from "react";
import { ProfessionPicker } from "@/components/portal/profession-picker";
import Link from "next/link";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalPageHead } from "@/components/portal/portal-primitives";
import { WritingUpgradeModal } from "@/components/portal/writing-upgrade-modal";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { writingApi, type WritingLibrary, type WritingHistory } from "@/lib/writing-api";

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalWritingPage() {
  const { profile, token, status, error, refresh, logout } = useSession();
  const [lib, setLib] = useState<WritingLibrary | null>(null);
  const [history, setHistory] = useState<WritingHistory | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token || !profile) return;
    setLoadError(null);
    try {
      const [l, h] = await Promise.all([writingApi.library(), writingApi.my()]);
      setLib(l);
      setHistory(h);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load writing");
    }
  }, [token, profile]);

  useEffect(() => { void load(); }, [load]);

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading writing…" layout="table" />;
  if (status === "unauth" || !profile) {
    return <WorkspaceAccessDeniedState title="Portal access required" description={error || "Please log in with your candidate account."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />;
  }

  const profession = lib?.profession ?? null;

  return (
    <PortalShell title="OET Writing" description="Timed letter practice from your profession's case notes — submitted for expert correction." profile={profile} onRefresh={() => void load()} onLogout={logout}>
      <PortalPageHead eyebrow="Writing course" title="OET Writing" description="Read the case notes, write your referral letter in 45 minutes, and submit it for correction. Every letter is numbered and tracked.">
        <div className="phead-meta">
          {lib?.writingCode ? <span className="mchip"><b>{lib.writingCode}</b> <span>your writing ID</span></span> : null}
          <span className="mchip"><b>{lib?.used ?? 0} / {lib?.allowed ?? 0}</b> <span>corrections used</span></span>
          <span className="mchip"><b>{lib?.remaining ?? 0}</b> <span>remaining</span></span>
          {profession ? <span className="mchip"><b>{profession}</b> <span>profession</span></span> : null}
        </div>
      </PortalPageHead>

      {loadError ? (
        <section className="card card-pad" style={{ borderColor: "var(--bad)" }}><p style={{ color: "var(--bad)" }}>{loadError}</p></section>
      ) : !profession ? (
        // Was a dead end telling them to contact support. They can answer this
        // themselves, and an admin-created account never had one to begin with.
        <ProfessionPicker onSaved={() => void load()} />
      ) : (
        <div className="split">
          <div>
            {lib && lib.remaining <= 0 ? (
              <section className="card card-pad" style={{ marginBottom: 16, borderColor: "var(--brand,#38BDF8)", background: "var(--sky,#EAF3FC)" }}>
                <p style={{ margin: "0 0 4px", fontWeight: 800, color: "var(--ink)" }}>{lib.allowed === 0 ? "No writing corrections in your plan yet" : "You've used all your writing corrections"}</p>
                <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                  {lib.allowed === 0
                    ? "Add a Writing Corrections package to submit letters for expert marking."
                    : `You've submitted ${lib.used} of ${lib.allowed} corrections. Add more to keep going.`}
                </p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setUpgradeOpen(true)}>Get more corrections</button>
              </section>
            ) : null}
            <section className="card">
              <div className="card-head"><div><h2>{profession} · Case notes</h2><p>Pick a case note to start a timed 45-minute letter.{lib && lib.remaining > 0 ? ` ${lib.remaining} correction${lib.remaining === 1 ? "" : "s"} left.` : ""}</p></div></div>
              <div className="card-pad">
                {(lib?.caseNotes.length ?? 0) === 0 ? (
                  <p style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.6 }}>No case notes have been published for {profession} yet. They&apos;ll appear here as soon as they&apos;re added.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {lib!.caseNotes.map((cn) => (
                      <div key={cn.id} className="wl-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 14 }}>
                        <span style={{ flex: "0 0 auto", width: 38, height: 38, borderRadius: 10, background: "var(--sky)", color: "var(--brand,#0B63B0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M9 13h6M9 17h6" /></svg>
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>{cn.title}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--mute)" }}>{cn.timeLimitMin} min · {cn.wordGuidance || "180–200"} words</p>
                        </div>
                        {lib && lib.remaining > 0 ? (
                          <Link className="btn btn-primary btn-sm" href={`/portal/writing/${cn.id}`}>Start letter</Link>
                        ) : (
                          <span className="btn btn-quiet btn-sm" style={{ opacity: 0.6, cursor: "not-allowed" }} title="No corrections remaining">No corrections left</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
          <aside className="ctx">
            <section className="card card-pad">
              <p className="caps">Your letters</p>
              {(history?.submissions.length ?? 0) === 0 ? (
                <p style={{ margin: "0 0 4px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>You haven&apos;t submitted a letter yet. Start one to build your correction history.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {history!.submissions.map((s) => (
                    <div key={s.id} className="mini" style={{ border: "none", paddingTop: 0, alignItems: "flex-start" }}>
                      <span className="mini-ico" style={{ fontWeight: 800, fontSize: 12 }}>#{s.letterNumber}</span>
                      <span className="mini-t"><b style={{ display: "block" }}>{s.caseNoteTitle}</b><span>{s.wordCount} words · {fmtDate(s.submittedAt)}{s.autoSubmitted ? " · auto" : ""}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="card card-pad">
              <p className="caps">How correction works</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                When you submit, your letter is emailed to our correction team with your writing ID and letter number. You&apos;ll get marked feedback by email — track your count above.
              </p>
            </section>
          </aside>
        </div>
      )}
      <WritingUpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </PortalShell>
  );
}
