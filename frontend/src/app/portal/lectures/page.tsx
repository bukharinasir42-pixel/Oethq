"use client";

/**
 * /portal/lectures — the per-skill course lecture library. Lectures for skills
 * the user owns are playable; the rest are locked with an upgrade prompt.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalPageHead } from "@/components/portal/portal-primitives";
import { PortalErrorAlert } from "@/components/portal/portal-error-alert";
import { PortalUpgradeModal } from "@/components/portal/portal-upgrade-modal";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { usePortalPlanAccess } from "@/hooks/use-portal-plan-access";
import { useSession } from "@/hooks/use-session";
import type { SkillKey } from "@/hooks/use-ownership";
import { lecturesApi, type CourseLecture, type LecturePlayback } from "@/lib/lectures-api";
import { markActivity } from "@/lib/activity-api";

const SKILL_ORDER: SkillKey[] = ["READING", "LISTENING", "WRITING", "SPEAKING"];
const SKILL_LABEL: Record<SkillKey, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking" };

const PlayIco = () => <svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" /></svg>;
const LockIco = () => <svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>;
const ClockIco = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const StatusIco = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>;

function LecturesInner() {
  const skillFilter = (useSearchParams().get("skill")?.toUpperCase() as SkillKey | null) || null;
  const { profile, status, error, refresh, logout } = useSession();
  const { subscription, planTier } = usePortalPlanAccess();
  const isFreeTrial = planTier === "STARTER";
  const [lectures, setLectures] = useState<CourseLecture[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockedSkill, setLockedSkill] = useState<SkillKey | null>(null);
  const [player, setPlayer] = useState<LecturePlayback | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  const reload = async () => {
    setLoadError(null); setLoading(true);
    try {
      const res = await lecturesApi.list();
      setLectures(res.lectures);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load lectures");
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<SkillKey, CourseLecture[]>();
    for (const l of lectures) {
      const arr = map.get(l.skill) ?? [];
      arr.push(l);
      map.set(l.skill, arr);
    }
    return SKILL_ORDER
      .filter((s) => map.has(s) && (!skillFilter || s === skillFilter))
      .map((s) => ({ skill: s, items: map.get(s)! }));
  }, [lectures, skillFilter]);

  const shown = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);
  const totalMin = useMemo(() => shown.reduce((n, l) => n + (l.durationMin || 0), 0), [shown]);

  const play = async (l: CourseLecture) => {
    setPlayerLoading(true);
    try {
      const pb = await lecturesApi.playback(l.id);
      setPlayer(pb);
      markActivity("lecture");
    } catch {
      setLockedSkill(l.skill);
    } finally { setPlayerLoading(false); }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading lectures..." layout="table" />;
  }
  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to view lectures."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <PortalShell
      title="Course lectures"
      description="Skill lectures from your OET HQ courses."
      profile={profile}
      packageName={subscription?.plan?.name}
      onRefresh={() => void reload()}
      onLogout={logout}
    >
      {loadError ? (
        <PortalErrorAlert title="Unable to load lectures" description={loadError} onRetry={() => void reload()} />
      ) : loading ? (
        <WorkspaceLoadingState title="Loading lectures..." layout="table" />
      ) : (
        <>
          <PortalPageHead
            eyebrow={skillFilter ? `${SKILL_LABEL[skillFilter]} course` : "Your courses"}
            title={skillFilter ? `${SKILL_LABEL[skillFilter]} lectures` : "Course lectures"}
            description="The method lectures for every part of the paper. Watch in order the first time, then return to any part you are still losing marks on."
          >
            <div className="phead-meta">
              <span className="mchip"><b>{shown.length}</b> <span>lectures</span></span>
              <span className="mchip"><b>{totalMin}</b> <span>minutes</span></span>
            </div>
          </PortalPageHead>

          {shown.length === 0 ? (
            <section className="card card-pad" style={{ textAlign: "center" }}>
              <h2 style={{ marginBottom: 8 }}>No lectures yet</h2>
              <p style={{ color: "var(--text)", lineHeight: 1.6 }}>Lectures appear here once your course lecture content is published.</p>
            </section>
          ) : (
            <div className="split">
              <div>
                {grouped.map(({ skill, items }) => (
                  <section className="card" key={skill} style={{ marginBottom: 16 }}>
                    <div className="card-head"><div><h2>{SKILL_LABEL[skill]} method lectures</h2><p>Each lecture covers one part of the paper end to end.</p></div></div>
                    <div className="rows">
                      {items.map((l) => (
                        <div className="row" key={l.id}>
                          <span className="row-ico">{l.locked ? <LockIco /> : <PlayIco />}</span>
                          <span className="row-t">
                            <b>{l.title}</b>
                            {l.description ? <p>{l.description}</p> : null}
                            <span className="row-meta">
                              {l.durationMin ? <span><ClockIco />{l.durationMin} min</span> : null}
                              <span><StatusIco />{l.locked ? "Locked" : "Not started"}</span>
                            </span>
                            <span className="rmeter"><i style={{ width: "0%" }} /></span>
                          </span>
                          <span className="row-r">
                            {l.locked ? (
                              <button className="btn btn-quiet btn-sm" type="button" onClick={() => setLockedSkill(l.skill)}>Upgrade</button>
                            ) : (
                              <button className="btn btn-primary btn-sm" type="button" onClick={() => void play(l)} disabled={playerLoading}>Watch</button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <aside className="ctx">
                <section className="card card-pad">
                  <p className="caps">While you watch</p>
                  <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                    Take the linked timed test straight after each lecture. The method only sticks once you have used it under the clock.
                  </p>
                  <Link className="btn btn-quiet btn-sm" href={`/portal/course-tests${skillFilter ? `?skill=${skillFilter}` : ""}`} style={{ width: "100%" }}>Go to tests</Link>
                </section>
              </aside>
            </div>
          )}
        </>
      )}

      <PortalUpgradeModal isFreeTrial={isFreeTrial} skill={lockedSkill} open={lockedSkill !== null} onOpenChange={(v) => { if (!v) setLockedSkill(null); }} />

      {player ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4" role="dialog" aria-modal="true" onClick={() => setPlayer(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <p className="truncate text-sm font-bold text-slate-800">{player.title}</p>
              <button type="button" onClick={() => setPlayer(null)} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="aspect-video bg-slate-900">
              {player.embedUrl ? (
                <iframe src={player.embedUrl} className="h-full w-full" allow="autoplay; fullscreen; encrypted-media" title={player.title} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-center text-sm text-slate-300">This lecture&apos;s video hasn&apos;t been uploaded yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}

export default function LecturesPage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Loading lectures..." layout="table" />}>
      <LecturesInner />
    </Suspense>
  );
}
