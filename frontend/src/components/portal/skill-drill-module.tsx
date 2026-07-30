"use client";

/**
 * SkillDrillModule — the owned core-skill module surface. If the module's drill
 * library has drills, it shows a premium "Drill of the day" landing + a
 * sandboxed iframe player. If the library is empty, it falls back to the
 * "coming soon" state. All markup is scoped under the shell's `.oethq-portal`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { skillDrillsApi, type DrillOfDay } from "@/lib/skill-drills-api";

const StarSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>
);
const ShieldSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 22s8-4.5 8-10V5l-8-3-8 3v7c0 5.5 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
);
const CalSvg = () => (
  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
);

const DRILL_NAME: Record<string, string> = {
  "part-a-core": "Skimming & Scanning Drill",
  "part-bc-core": "Comprehension Drill",
  spellings: "Spelling Drill",
  "part-c-podcasts": "Listening Drill"
};

function humanCountdown(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type Def = { title: string; tagline: string; planned: string[] };
type Props = {
  moduleKey: string;
  def: Def;
  skillLabel: string;
  lectureHref: string;
  planName: string;
  accessUntil: string | null;
};

export function SkillDrillModule({ moduleKey, def, skillLabel, lectureHref, planName, accessUntil }: Props) {
  const [drill, setDrill] = useState<DrillOfDay | null | undefined>(undefined);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let active = true;
    skillDrillsApi.ofDay(moduleKey)
      .then((r) => { if (active) setDrill(r.drill); })
      .catch(() => { if (active) setDrill(null); });
    return () => { active = false; };
  }, [moduleKey]);

  if (drill === undefined) {
    return <section className="card card-pad" style={{ textAlign: "center", color: "var(--mute)" }}>Loading today&apos;s drill…</section>;
  }

  // Empty library → premium "coming soon" fallback.
  if (!drill) {
    return <ComingSoon def={def} skillLabel={skillLabel} lectureHref={lectureHref} planName={planName} accessUntil={accessUntil} />;
  }

  if (started) {
    return (
      <section className="card" style={{ overflow: "hidden" }}>
        <div className="card-head" style={{ gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>{drill.title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--mute)" }}>Drill of the day · scan for meaning, not order</p>
          </div>
          <button className="btn btn-quiet btn-sm" type="button" onClick={() => setStarted(false)}>← Back</button>
        </div>
        <iframe
          title={drill.title}
          srcDoc={drill.html}
          sandbox="allow-scripts allow-modals allow-forms allow-popups"
          style={{ width: "100%", height: "80vh", minHeight: 620, border: "none", display: "block", background: "#f3f7fc" }}
        />
      </section>
    );
  }

  const drillName = DRILL_NAME[moduleKey] ?? "Daily Drill";

  return (
    <>
      <section className="drill-hero">
        <div className="drill-hero-top">
          <span className="drill-ico" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
              <line className="scanline" x1="6" y1="12" x2="18" y2="12" />
            </svg>
          </span>
          <div>
            <span className="drill-eyebrow">Drill of the day</span>
            <h2>{drillName}</h2>
          </div>
        </div>
        <p>{def.tagline}</p>
        <div className="drill-actions">
          <button className="drill-start" type="button" onClick={() => setStarted(true)}>
            <span>Start today&apos;s drill <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
          </button>
          <span className="drill-meta">
            A new drill every 24 hours · {drill.total} in the library · next in {humanCountdown(drill.nextRotatesInMs)}
          </span>
        </div>
      </section>

      <div className="split">
        <div>
          <section className="card">
            <div className="card-head"><div><h2>How this drill works</h2><p>A fast, timed scanning workout — hear a meaning, click the matching word.</p></div></div>
            <div className="card-pad">
              <div className="feat">
                {def.planned.map((f) => (<div key={f}><i><StarSvg /></i><b>{f}</b></div>))}
              </div>
            </div>
          </section>
        </div>
        <aside className="ctx">
          <section className="card card-pad">
            <p className="caps">Today&apos;s drill</p>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>{drill.title}</p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
              Everyone works the same drill today. It rotates automatically to a new one from the library every 24 hours.
            </p>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => setStarted(true)} style={{ width: "100%" }}>Start now</button>
          </section>
          <section className="card card-pad">
            <p className="caps">Included with your plan</p>
            <div className="mini" style={{ border: "none", paddingTop: 0 }}>
              <span className="mini-ico"><ShieldSvg /></span>
              <span className="mini-t"><b>No extra cost</b><span>Owned with {planName}</span></span>
            </div>
            {accessUntil && (
              <div className="mini">
                <span className="mini-ico"><CalSvg /></span>
                <span className="mini-t"><b>Access window</b><span>Until {accessUntil}</span></span>
              </div>
            )}
            <Link className="more" href={lectureHref}>Watch the {skillLabel} lecture <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
          </section>
        </aside>
      </div>
    </>
  );
}

/** The "in development" fallback shown when no drills are uploaded yet. */
function ComingSoon({ def, skillLabel, lectureHref, planName, accessUntil }: Omit<Props, "moduleKey">) {
  return (
    <>
      <section className="soon-hero">
        <span className="pill"><StarSvg /> In development</span>
        <h2>{def.title}</h2>
        <p>{def.tagline}</p>
        <div className="soon-bar">
          <div className="t">
            <b>Build progress</b>
            <p>You own this module already. It appears here the moment it ships, at no extra cost.</p>
            <div className="soon-track"><i style={{ width: "62%" }} /></div>
          </div>
        </div>
      </section>
      <div className="split">
        <div>
          <section className="card">
            <div className="card-head"><div><h2>What is coming to this module</h2><p>Interactive exercises being built now.</p></div></div>
            <div className="card-pad">
              <div className="feat">
                {def.planned.map((f) => (<div key={f}><i><StarSvg /></i><b>{f}</b></div>))}
              </div>
            </div>
          </section>
        </div>
        <aside className="ctx">
          <section className="card card-pad">
            <p className="caps">Work on this instead</p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
              This skill is already covered in your method lectures and timed tests. Start there and this module will sharpen it later.
            </p>
            <Link className="btn btn-primary btn-sm" href={lectureHref} style={{ width: "100%" }}>Watch the {skillLabel} lecture</Link>
          </section>
          <section className="card card-pad">
            <p className="caps">Included with your plan</p>
            <div className="mini" style={{ border: "none", paddingTop: 0 }}>
              <span className="mini-ico"><ShieldSvg /></span>
              <span className="mini-t"><b>No extra cost</b><span>Owned with {planName}</span></span>
            </div>
            {accessUntil && (
              <div className="mini">
                <span className="mini-ico"><CalSvg /></span>
                <span className="mini-t"><b>Access window</b><span>Until {accessUntil}</span></span>
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
