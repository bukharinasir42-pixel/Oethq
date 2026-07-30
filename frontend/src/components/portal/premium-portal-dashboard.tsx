"use client";

/**
 * PremiumPortalDashboard — candidate dashboard, revamped to the client
 * dashboard.html concept (scoped under `.dash`, light theme). Wired to the real
 * dashboard / tasks / cohort data: greeting + cohort day, today's daily-task
 * tiles, today's live schedule, the clearance meter + NASIR band, latest scaled
 * scores, consistency, runway. Ends with a flagship "Submit today's work" button
 * that records the day into the accountability system (POST /activity/mark).
 * Rendered as content inside the existing PortalShell (shell owns nav/topbar).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cohortApi, type CohortMe, type CohortDay } from "@/lib/cohort-api";
import { apiFetch } from "@/lib/api";
import { isDayPracticeComplete } from "@/lib/portal-utils";
import { SkillUpgradeModal } from "@/components/portal/skill-upgrade-modal";
import { moduleUnlockedForTier, moduleUnlockedForTrial, type ModuleKey } from "@/lib/portal-tier-access";
import type { SkillAccess } from "@/lib/products-api";
import type { SkillKey } from "@/hooks/use-ownership";
import type { DashboardDto, TaskItem } from "@/lib/types";
import "./premium-dashboard.css";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86_400_000;

// NASIR band ladder keyed to pass-probability %. Gate ("book the exam") = STRONG.
const NASIR = [
  { name: "CRITICAL", floor: 0 }, { name: "AT RISK", floor: 25 }, { name: "DEVELOPING", floor: 40 },
  { name: "COMPETITIVE", floor: 55 }, { name: "STRONG", floor: 70 }, { name: "EXCELLENT", floor: 85 }
] as const;
const GATE_IDX = 4;

const fmtLong = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
const greetWord = (h: number) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

// ---- task-tile icons (from the design) ----
const IcLecture = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="15" height="16" rx="2" /><path d="m17 10 5-3v10l-5-3z" /></svg>);
const IcDoc = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M15 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>);
const IcHead = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a7 7 0 0 0-7 7v3" /><path d="M19 13v-3a7 7 0 0 0-7-7" /><rect x="3" y="12" width="4" height="7" rx="2" /><rect x="17" y="12" width="4" height="7" rx="2" /></svg>);
const IcDrill = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" /><circle cx="12" cy="12" r="3" /></svg>);
const IcArticle = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h13a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H5a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z" /><path d="M7 8h7M7 12h7M7 16h4" /></svg>);
const IcSpell = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M16 9a4 4 0 0 1 0 6" /><path d="M19.5 6.5a8 8 0 0 1 0 11" /></svg>);
const IcMic = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v4M8 22h8" /></svg>);
const IcCheck = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>);
const IcMoon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>);
const IcSun = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
const IcSheet = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>);
const IcPen = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
const IcLock = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);

type Props = {
  profileName?: string;
  dashboard: DashboardDto | null;
  tasks: TaskItem[];
  completedTestIds: ReadonlySet<string>;
  /** Skills the student owns (single-skill buyers). Ignored when fullAccess. */
  ownedSkills?: string[];
  /** Per-skill effective tier access (drives tier-level tile locking). */
  skillAccess?: Record<string, SkillAccess>;
  /** Complete Course: every skill's tiles are unlocked. */
  fullAccess?: boolean;
  /** Free trial (STARTER): only the modules the Tier 0 card advertises are open. */
  isFreeTrial?: boolean;
  /** Pass Predictor unlocked (Precision+ or Complete). Hides the meter when false. */
  passPredictor?: boolean;
  /** True remaining access days (course entitlement OR subscription, whichever is longer). */
  accessDaysLeft?: number | null;
};

export function PremiumPortalDashboard({ profileName, dashboard, tasks, completedTestIds, ownedSkills = [], skillAccess = {}, fullAccess = true, isFreeTrial: isFreeTrialProp = false, passPredictor = true, accessDaysLeft = null }: Props) {
  // Prefer the caller's value (from the subscription hook, authoritative even
  // before the dashboard payload lands); fall back to the dashboard's own plan.
  const isFreeTrial = isFreeTrialProp || dashboard?.subscription?.plan?.tier === "STARTER";
  const [lockedSkill, setLockedSkill] = useState<SkillKey | null>(null);
  // A tile is locked when the skill isn't owned, OR it is owned but the student's
  // tier doesn't unlock that module (e.g. cheat sheets below Precision).
  const tileLocked = useCallback((s: SkillKey, module?: ModuleKey) => {
    // The trial has no entitlements, so tier rank says nothing about it: gate on
    // the advertised trial module list instead of showing everything as open and
    // letting the student hit a 403.
    if (isFreeTrial) return module ? !moduleUnlockedForTrial(module) : false;
    if (fullAccess) return false;
    if (!ownedSkills.includes(s)) return true;
    if (module && !moduleUnlockedForTier(skillAccess[s], module)) return true;
    return false;
  }, [fullAccess, isFreeTrial, ownedSkills, skillAccess]);
  const firstOwned = (ownedSkills[0] as SkillKey | undefined) ?? "READING";
  const [cohort, setCohort] = useState<CohortMe | null>(null);
  const [today, setToday] = useState<(Partial<CohortDay> & { state?: string }) | null>(null);
  useEffect(() => {
    let active = true;
    cohortApi.me().then((c) => { if (active) setCohort(c); }).catch(() => undefined);
    cohortApi.today().then((d) => { if (active) setToday(d); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  // ---- derive real values ----
  const totalDays = cohort?.schedule?.totalDays ?? 40;
  const startDate = useMemo(() => (cohort?.schedule?.startDate ? new Date(cohort.schedule.startDate) : null), [cohort]);
  const subEnd = dashboard?.subscription?.endDate ? new Date(dashboard.subscription.endDate) : null;
  const now = Date.now();
  const currentDay = startDate ? Math.min(totalDays, Math.max(1, Math.floor((now - startDate.getTime()) / DAY_MS) + 1)) : 1;
  const completedDays = useMemo(() => tasks.filter((t) => isDayPracticeComplete(t, completedTestIds)).length, [tasks, completedTestIds]);
  // Prefer the true access window (course entitlement) over the raw subscription,
  // so a course student sees their real remaining days, not a lapsed free trial.
  const daysLeft = accessDaysLeft ?? (subEnd ? Math.max(0, Math.ceil((subEnd.getTime() - now) / DAY_MS)) : null);
  const accessEnd = daysLeft != null ? new Date(now + daysLeft * DAY_MS) : subEnd;
  const runwayPct = daysLeft != null ? Math.max(4, Math.min(100, Math.round((daysLeft / Math.max(totalDays, daysLeft)) * 100))) : 0;

  const passProb = Math.round(dashboard?.summary?.passProbability ?? 0);
  const bandIdx = NASIR.reduce((acc, b, i) => (passProb >= b.floor ? i : acc), 0);
  const bandName = (dashboard?.summary?.nasirBand ?? NASIR[bandIdx].name).toString().replace(/_/g, " ").toUpperCase();
  const retained = dashboard?.summary?.retainedResults ?? 0;
  const gradeLabel = (g?: string | null) => (g === "C_PLUS" ? "C+" : g || "E");
  const latestReading = dashboard?.retainedResults?.find((r) => r.test.type === "READING" && r.scaledScore != null);
  const latestListening = dashboard?.retainedResults?.find((r) => r.test.type === "LISTENING" && r.scaledScore != null);
  const planName = dashboard?.subscription?.plan?.name ?? "OET Complete Course";
  const dnow = new Date();

  // ---- today's daily-task tiles (real routes) ----
  type Tile = { icon: React.ReactNode; title: string; desc: string; state: string; foot: string; href: string; ac?: string; live?: boolean; nw?: boolean; skill?: SkillKey; module?: ModuleKey };
  const liveLecture = today?.sessions?.find((s) => s.slot === "LECTURE");
  const tiles: Tile[] = [
    // Cohort lecture — cross-skill for Complete/trial; single-skill buyers get their skill's lectures.
    { icon: <IcLecture />, title: "Daily Lecture", desc: liveLecture?.title || "Today's live cohort lecture, with chat at your chosen slot.", state: liveLecture?.scheduledLocal ? liveLecture.scheduledLocal : "TODAY", foot: `${today?.sessions?.length ?? 2} live class${(today?.sessions?.length ?? 2) === 1 ? "" : "es"}`, href: fullAccess ? "/portal/tasks" : `/portal/lectures?skill=${firstOwned}`, ac: "var(--crit)", live: true },
    // Reading
    { icon: <IcDoc />, title: "Reading Test", desc: "Full paper, Parts A B C, on the official OET interface under the clock.", state: "OPEN", foot: "42 questions · 60 min", href: "/portal/course-tests?skill=READING", skill: "READING", module: "tests" },
    { icon: <IcDrill />, title: "Part A Skill Drill", desc: "Timed skim-and-scan workout. Speed is what Part A actually marks.", state: "NEW TODAY", foot: "Rotates daily", href: "/portal/skill-practice?skill=READING&module=part-a-core", nw: true, skill: "READING", module: "part-a-core" },
    { icon: <IcArticle />, title: "Part C Article", desc: "A fresh article from official OET Reading Part C sources.", state: "NEW TODAY", foot: "Daily · live", href: "/portal/skill-practice?skill=READING&module=part-bc-core", nw: true, skill: "READING", module: "part-bc-core" },
    { icon: <IcSheet />, title: "Reading Cheat Sheet", desc: "The Part A/B/C strategy sheets, with the how-to-use lectures.", state: "OPEN", foot: "Inline PDF + video", href: "/portal/skill-practice?skill=READING&module=cheat-sheets", skill: "READING", module: "cheat-sheets" },
    // Listening
    { icon: <IcHead />, title: "Listening Test", desc: "Parts A B C, audio plays once. No pause, no rewind — like the day.", state: "OPEN", foot: "42 questions · 50 min", href: "/portal/course-tests?skill=LISTENING", skill: "LISTENING", module: "tests" },
    { icon: <IcSpell />, title: "Listening Daily Spelling", desc: "Hear a medical term, type it. Heard right but spelled wrong still scores zero.", state: "DAILY", foot: "1,938 terms", href: "/portal/skill-practice?skill=LISTENING&module=spellings", skill: "LISTENING", module: "spellings" },
    { icon: <IcMic />, title: "Part C Podcast", desc: "Extended monologues at exam register, from official OET Listening sources.", state: "NEW TODAY", foot: "10–15 min · daily", href: "/portal/skill-practice?skill=LISTENING&module=part-c-podcasts", nw: true, skill: "LISTENING", module: "part-c-podcasts" },
    { icon: <IcSheet />, title: "Listening Cheat Sheet", desc: "The Part B/C listening strategy sheets, with the how-to-use lectures.", state: "OPEN", foot: "Inline PDF + video", href: "/portal/skill-practice?skill=LISTENING&module=cheat-sheets", skill: "LISTENING", module: "cheat-sheets" },
    // Writing
    { icon: <IcPen />, title: "Writing Corrections", desc: "Submit a referral letter, marked by a human to all six official criteria.", state: "OPEN", foot: "Current → projected B", href: "/portal/writing", skill: "WRITING", module: "writing" }
  ];

  // ---- schedule (real cohort sessions, else today's timed tests) ----
  const scheduleItems = (today?.sessions ?? []).map((s) => ({
    t: s.scheduledLocal || (s.slot === "LECTURE" ? "Lecture" : "Class"),
    h4: s.title, p: `${s.slot === "LECTURE" ? "Live lecture" : "Core skills"} · ${s.durationMin ?? 45} min`, live: s.state === "IN_PROGRESS" || s.state === "STARTING_SOON"
  }));

  // ================= dark mode (per-student, persisted) =================
  const [dark, setDark] = useState(false);
  useEffect(() => { try { setDark(localStorage.getItem("dash-theme") === "dark"); } catch { /* ignore */ } }, []);
  const toggleTheme = useCallback(() => setDark((v) => {
    const n = !v;
    try { localStorage.setItem("dash-theme", n ? "dark" : "light"); } catch { /* ignore */ }
    return n;
  }), []);

  // ================= submit today's work =================
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "done">("idle");
  const submitWork = useCallback(async () => {
    if (submitState !== "idle") return;
    setSubmitState("saving");
    try {
      await apiFetch("/activity/mark", { method: "POST", body: { kind: "submit" } });
      setSubmitState("done");
    } catch {
      setSubmitState("idle");
    }
  }, [submitState]);

  // ================= entrance + arc + streak animations =================
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".t, .lx"));
    if (reduce) { els.forEach((e) => e.classList.add("in")); }
    else els.forEach((e, i) => window.setTimeout(() => e.classList.add("in"), 70 + i * 45));
    // arc fill
    const arc = root.querySelector<SVGPathElement>("#dashArc");
    if (arc) window.setTimeout(() => { arc.style.strokeDashoffset = String(314 - 314 * (passProb / 100)); }, reduce ? 0 : 420);
    // count-up %
    const el = root.querySelector<HTMLElement>("#dashPP");
    if (el) {
      if (reduce) el.textContent = `${passProb}%`;
      else { let c = 0; const t = window.setInterval(() => { c += Math.max(1, Math.ceil(passProb / 22)); if (c >= passProb) { c = passProb; window.clearInterval(t); } el.textContent = `${c}%`; }, 55); }
    }
  }, [passProb]);

  const openCount = tiles.filter((t) => !(t.skill && tileLocked(t.skill, t.module))).length;

  return (
    <div className={"dash" + (dark ? " dash-dark" : "")} ref={rootRef}>
      <div className="mesh" aria-hidden><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>

      <main className="content">
        {/* greeting */}
        <div className="greet">
          <div>
            <span className="m">{WD[dnow.getDay()]} {dnow.getDate()} {MON[dnow.getMonth()]} · Day {String(currentDay).padStart(2, "0")} of {totalDays}</span>
            <h1>{greetWord(dnow.getHours())}, {profileName || "there"}. <em>{openCount} things open for you today.</em></h1>
          </div>
          <div className="greet-act">
            <Link className="btn btn-navy mag" href="/portal/tasks">Open Day {String(currentDay).padStart(2, "0")}</Link>
            <Link className="btn btn-gh mag" href="/portal/tasks">{totalDays}-day plan</Link>
            <button type="button" className="dash-theme" onClick={toggleTheme} aria-label="Toggle dark mode">
              {dark ? <IcSun /> : <IcMoon />} {dark ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        {/* alert — only when scores are still zero (and the Pass Predictor is unlocked) */}
        {passPredictor && !isFreeTrial && retained === 0 ? (
          <div className="bento">
            <section className="t c12 alert in">
              <span className="bar" />
              <div>
                <h4>Your clearance meter is still pinned to zero</h4>
                <p>Until you submit a timed Reading and Listening test, your scaled scores, your part breakdown and your NASIR band all read zero — none of those numbers mean anything yet. Submit your first timed test to bring the meter to life.</p>
              </div>
              <Link className="btn btn-sky mag" href="/portal/course-tests?skill=READING" style={{ marginLeft: "auto" }}>Submit a test now</Link>
            </section>
          </div>
        ) : null}

        {/* ===== TODAY'S DAILY TASK ===== */}
        <div className="sec-head">
          <div><h2>Today&apos;s Daily Task</h2><p>Everything that refreshes today — one tap each.</p></div>
          <span className="m">{openCount} open</span>
        </div>

        <div className="pad">
          {tiles.map((tile) => {
            const locked = tile.skill ? tileLocked(tile.skill, tile.module) : false;
            if (locked) {
              const s = tile.skill as SkillKey;
              const owns = ownedSkills.includes(s);
              const label = s.charAt(0) + s.slice(1).toLowerCase();
              return (
                <button key={tile.title} type="button" className="lx is-locked" onClick={() => setLockedSkill(s)}>
                  <div className="lx-top">
                    <span className="lx-ico">{tile.icon}</span>
                    <span className="lx-state locked"><IcLock /> LOCKED</span>
                  </div>
                  <h4>{tile.title}</h4>
                  <p>{owns ? `Not in your ${label} tier — upgrade to open this.` : `Not in your plan yet — unlock the ${label} course to open this.`}</p>
                  <div className="lx-foot"><b>{owns ? "Tap to upgrade" : "Tap to unlock"}</b><span className="lx-go">→</span></div>
                </button>
              );
            }
            return (
              <Link key={tile.title} className="lx" href={tile.href} style={tile.ac ? ({ ["--ac" as string]: tile.ac } as React.CSSProperties) : undefined}>
                <div className="lx-top">
                  <span className="lx-ico" style={tile.ac ? { background: "var(--crit-wash)", borderColor: "var(--crit-line)" } : undefined}>{tile.icon}</span>
                  <span className={"lx-state" + (tile.live ? " live" : tile.nw ? " new" : "")}>{tile.live ? <i /> : null}{tile.state}</span>
                </div>
                <h4>{tile.title}</h4>
                <p>{tile.desc}</p>
                <div className="lx-foot"><b>{tile.foot}</b><span className="lx-go">→</span></div>
              </Link>
            );
          })}

          {/* Submit today's work — flagship tile (fills the grid, right after Part C Podcast) */}
          <button type="button" className={"lx lx-submit" + (submitState === "done" ? " is-done" : "")} onClick={submitWork} disabled={submitState !== "idle"}>
            <span className="dash-submit-sheen" aria-hidden />
            <span className="lx-submit-ico"><IcCheck /></span>
            <h4>{submitState === "done" ? "Work submitted ✓" : submitState === "saving" ? "Submitting…" : "Submit today's work"}</h4>
            <p>{submitState === "done" ? "Logged for today — your coach can see you showed up." : "One tap logs today's session to your coach & builds your streak."}</p>
          </button>
        </div>

        {/* ===== SCHEDULE + METER ===== */}
        <div className="sec-head">
          <div><h2>Today&apos;s schedule</h2><p>Your live classes and timed papers, in order.</p></div>
        </div>

        <div className="bento">
          <section className="t c8">
            <div className="sched">
              {scheduleItems.length ? scheduleItems.map((s, i) => (
                <ScheduleRow key={i} time={s.t} title={s.h4} sub={s.p} live={s.live} />
              )) : (
                <>
                  <ScheduleRow time="60′" title="Reading test — Parts A, B and C" sub="42 questions · official interface · moves your band" />
                  <ScheduleRow time="50′" title="Listening test — Parts A, B and C" sub="42 questions · audio plays once · opens your Listening average" />
                </>
              )}
            </div>
          </section>

          {/* CLEARANCE METER — Pass Predictor (Precision+ / Complete only) */}
          {!passPredictor ? (
            <section className="t c4 meter">
              <div style={{ display: "flex", alignItems: "center" }}><span className="m">Pass Predictor</span><span className="lx-state locked" style={{ marginLeft: "auto" }}><IcLock /> LOCKED</span></div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", padding: "18px 6px", gap: 10 }}>
                <span className="lx-submit-ico" style={{ background: "var(--sky-wash)", borderColor: "var(--sky-line)", color: "var(--sky)" }}><IcLock /></span>
                <b style={{ fontSize: 17 }}>The clearance meter is a Precision feature</b>
                <p style={{ fontSize: 13, color: "var(--faint)", maxWidth: "30ch" }}>Upgrade to the Precision tier to see your pass probability and the “book at 70” signal.</p>
                <button type="button" className="btn btn-sky mag" onClick={() => setLockedSkill(firstOwned)} style={{ marginTop: 4 }}>Unlock Pass Predictor</button>
              </div>
            </section>
          ) : (
          <section className="t c4 r2 meter">
            <div style={{ display: "flex", alignItems: "center" }}><span className="m">Clearance meter</span><span className="m" style={{ marginLeft: "auto" }}>Book at 70</span></div>
            <div className="arc-wrap">
              <svg viewBox="0 0 260 152" aria-label={`Pass probability ${passProb} percent`}>
                <defs><linearGradient id="dashMg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--crit)" /><stop offset="58%" stopColor="var(--sky-2)" /><stop offset="100%" stopColor="var(--sky)" /></linearGradient></defs>
                <path className="arc-bg" d="M22 136 A108 108 0 0 1 238 136" />
                <path className="arc-fg" id="dashArc" d="M22 136 A108 108 0 0 1 238 136" style={{ stroke: "url(#dashMg)" }} />
                <line className="notch" x1="41.6" y1="70.3" x2="28.9" y2="63.0" />
                <line className="notch" x1="70.4" y1="40.6" x2="61.9" y2="28.6" />
                <line className="notch" x1="108.1" y1="29.0" x2="105.1" y2="14.7" />
                <line className="notch gate" x1="151.9" y1="29.0" x2="154.9" y2="14.7" />
                <line className="notch" x1="196.7" y1="52.2" x2="207.0" y2="41.9" />
              </svg>
              <div className="arc-v">
                <span className="big n" id="dashPP" style={passProb >= 70 ? { color: "var(--done)" } : passProb >= 40 ? { color: "var(--sky)" } : undefined}>0%</span>
                <span className="band" style={passProb >= 70 ? { background: "rgba(14,158,104,.1)", borderColor: "rgba(14,158,104,.3)", color: "var(--done)" } : passProb >= 40 ? { background: "var(--sky-wash)", borderColor: "var(--sky-line)", color: "var(--sky)" } : undefined}>NASIR · {bandName}</span>
              </div>
            </div>
            <div className="arc-ends"><span>0 · CRITICAL</span><span className="gate">↑ 70 BOOK</span><span>100</span></div>

            <div className="conf">
              <div className="conf-h"><span className="m">Results retained</span><b>{retained} of 5</b></div>
              <div className="cells">
                {[0, 1, 2, 3, 4].map((i) => (<span key={i} className={"cell" + (i < retained ? " filled" : "")}>{i < retained ? "✓" : i + 1}</span>))}
              </div>
              <p className="conf-note">{retained >= 5 ? <>Five solid results — the meter is trustworthy. Keep it fresh with new timed tests.</> : <>The meter can&apos;t be trusted until all five slots are filled — that&apos;s why the arc is drawn thin. <b>Two timed tests</b> move it fastest.</>}</p>
              <Link className="btn btn-sky mag" href="/portal/course-tests?skill=READING" style={{ marginTop: 16, width: "100%" }}>Fill the next slot · 60 min</Link>
            </div>
          </section>
          )}

          {/* NASIR band — Pass Predictor only */}
          {passPredictor ? (
          <section className="t c8">
            <div style={{ display: "flex", alignItems: "center" }}><span className="m">NASIR band</span><span className="m" style={{ marginLeft: "auto" }}>Booking advised from STRONG</span></div>
            <div className="bsteps">
              {NASIR.map((b, i) => (<span key={b.name} className={"bstep" + (i === bandIdx ? " on" : i === GATE_IDX ? " gate" : "")}><i>{i === bandIdx ? `${passProb}%` : b.floor === 0 ? "0" : b.floor}</i></span>))}
            </div>
            <div className="bnames">
              {NASIR.map((b, i) => (<span key={b.name} className={i === bandIdx ? "on" : i === GATE_IDX ? "gate" : ""}>{b.name}</span>))}
            </div>
          </section>
          ) : null}

          {/* stats */}
          <section className="t c3 stat">
            <span className="m">Reading · latest scaled</span>
            <b className={"v n " + (latestReading?.scaledScore ? "sky" : "bad")}>{latestReading?.scaledScore ?? 0}</b>
            <span className="s">Grade {gradeLabel(latestReading?.oetGrade)} · parts A{latestReading?.partAScore ?? 0} · B{latestReading?.partBScore ?? 0} · C{latestReading?.partCScore ?? 0}</span>
          </section>
          <section className="t c3 stat">
            <span className="m">Listening · latest scaled</span>
            <b className={"v n " + (latestListening?.scaledScore ? "sky" : "bad")}>{latestListening?.scaledScore ?? 0}</b>
            <span className="s">Grade {gradeLabel(latestListening?.oetGrade)}</span>
          </section>
          <section className="t c3 stat">
            <span className="m">Tests retained</span>
            <b className="v ok n">{retained}</b><span className="s">official results kept</span>
          </section>
          <section className="t c3 stat">
            <span className="m">Days on track</span>
            <b className="v sky n">{completedDays}</b><span className="s">of {totalDays} · both tests submitted</span>
          </section>

          {/* consistency */}
          <section className="t c5">
            <div style={{ display: "flex", alignItems: "center" }}><span className="m">Consistency</span><span className="m" style={{ marginLeft: "auto" }}>{completedDays} of {totalDays} days</span></div>
            <div className="streak">
              {Array.from({ length: totalDays }).map((_, i) => (<span key={i} className={"sq" + (i < completedDays ? " d1" : "")} />))}
            </div>
            <p style={{ fontSize: 13, color: "var(--faint)", marginTop: 14 }}>A day counts when both timed tests are submitted.</p>
          </section>

          {/* runway */}
          <section className="t c3 stat">
            <span className="m">Runway</span>
            <b className="v n">{daysLeft ?? "—"}</b><span className="s">days left{accessEnd ? ` · ends ${fmtLong(accessEnd)}` : ""}</span>
            <div className="runway-bar" style={{ marginTop: 14 }}><i style={{ display: "block", height: "100%", borderRadius: 4, width: `${runwayPct}%`, background: "linear-gradient(90deg,var(--sky-2),var(--sky))" }} /></div>
          </section>
          <section className="t c4 stat">
            <span className="m">Your course</span>
            <b className="v n" style={{ fontSize: 26 }}>{planName}</b>
            <span className="s">{isFreeTrial ? "Free trial" : "Active plan"} · <Link href="/courses" style={{ color: "var(--sky)" }}>manage</Link></span>
          </section>
        </div>
      </main>
      <SkillUpgradeModal skill={lockedSkill} open={lockedSkill !== null} onOpenChange={(v) => { if (!v) setLockedSkill(null); }} />
    </div>
  );
}

function ScheduleRow({ time, title, sub, live }: { time: string; title: string; sub: string; live?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className={"si" + (live ? " live" : "")}>
      <span className="si-t">{time}</span>
      <div className="si-b"><h4>{title}</h4><p>{live ? "Live now · " : ""}{sub}</p></div>
      <button className="si-chk" aria-label="Mark done" aria-checked={done} onClick={() => setDone((v) => !v)} style={done ? { background: "var(--done)", borderColor: "var(--done)" } : undefined}>{done ? "✓" : ""}</button>
    </div>
  );
}
