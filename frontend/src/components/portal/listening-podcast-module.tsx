"use client";

/**
 * ListeningPodcastModule — the Listening "Part C Podcasts" surface. Shows the
 * global podcast of the day in a premium player, tracks the student's listening
 * (a "listened today" tick, a running count and a day streak), and rotates to a
 * new podcast every 24h. All markup scoped under the shell's `.oethq-portal`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { listeningPodcastsApi, fmtDuration, type PodcastOfDay, type PodcastStats } from "@/lib/listening-podcasts-api";
import { markActivity } from "@/lib/activity-api";
import "./listening-podcast.css";

const StarSvg = () => (<svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>);
const ShieldSvg = () => (<svg viewBox="0 0 24 24"><path d="M12 22s8-4.5 8-10V5l-8-3-8 3v7c0 5.5 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>);
const HeadphoneSvg = () => (<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0116 0v2" /><rect x="2" y="14" width="5" height="7" rx="1.5" /><rect x="17" y="14" width="5" height="7" rx="1.5" /></svg>);

function humanCountdown(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ---------------- premium seekable audio player ---------------- */
function PodcastPlayer({ src, onNearEnd }: { src: string; onNearEnd: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const marked = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);

  const toggle = () => {
    const a = ref.current; if (!a) return;
    if (a.paused) { void a.play(); } else { a.pause(); }
  };
  const seek = (v: number) => { const a = ref.current; if (a) { a.currentTime = v; setCur(v); } };
  const skip = (d: number) => { const a = ref.current; if (a) seek(Math.min(dur || a.duration || 0, Math.max(0, a.currentTime + d))); };
  const cycleRate = () => {
    const rates = [1, 1.25, 1.5, 1.75, 2];
    const next = rates[(rates.indexOf(rate) + 1) % rates.length];
    setRate(next); if (ref.current) ref.current.playbackRate = next;
  };

  return (
    <div className="pod-player">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget; setCur(a.currentTime);
          if (!marked.current && a.duration && a.currentTime / a.duration >= 0.9) { marked.current = true; onNearEnd(); }
        }}
        onEnded={() => { setPlaying(false); if (!marked.current) { marked.current = true; onNearEnd(); } }}
      />
      <button type="button" className="pod-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72c0 .78.85 1.26 1.53.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" /></svg>
        )}
      </button>
      <div className="pod-main">
        <div className="pod-scrub">
          <input type="range" min={0} max={dur || 0} step={0.1} value={Math.min(cur, dur || 0)} onChange={(e) => seek(Number(e.target.value))} style={{ ["--pct" as string]: `${dur ? (cur / dur) * 100 : 0}%` }} aria-label="Seek" />
        </div>
        <div className="pod-controls">
          <span className="pod-time">{fmtDuration(cur)} <span>/ {fmtDuration(dur)}</span></span>
          <div className="pod-btns">
            <button type="button" onClick={() => skip(-15)} title="Back 15s" className="pod-skip">-15s</button>
            <button type="button" onClick={() => skip(15)} title="Forward 15s" className="pod-skip">+15s</button>
            <button type="button" onClick={cycleRate} title="Playback speed" className="pod-rate">{rate}×</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsRow({ stats, total }: { stats: PodcastStats; total: number }) {
  return (
    <div className="pod-stats">
      <div className={"pod-stat" + (stats.listenedToday ? " done" : "")}>
        <span className="pod-stat-ico">{stats.listenedToday ? "✓" : "○"}</span>
        <span className="pod-stat-t"><b>{stats.listenedToday ? "Listened today" : "Not yet today"}</b><span>Auto-ticks when you finish</span></span>
      </div>
      <div className="pod-stat">
        <span className="pod-stat-ico">🔥</span>
        <span className="pod-stat-t"><b>{stats.streak}-day streak</b><span>Keep it going daily</span></span>
      </div>
      <div className="pod-stat">
        <span className="pod-stat-ico">🎧</span>
        <span className="pod-stat-t"><b>{stats.count} done</b><span>of {total} in the library</span></span>
      </div>
    </div>
  );
}

type Def = { title: string; tagline: string; planned: string[] };
type Props = { def: Def; skillLabel: string; lectureHref: string; planName: string; accessUntil: string | null };

export function ListeningPodcastModule({ def, skillLabel, lectureHref, planName, accessUntil }: Props) {
  const [podcast, setPodcast] = useState<PodcastOfDay | null | undefined>(undefined);
  const [stats, setStats] = useState<PodcastStats | null>(null);

  useEffect(() => {
    let active = true;
    listeningPodcastsApi.ofDay()
      .then((r) => { if (active) { setPodcast(r.podcast); if (r.podcast) setStats({ listenedToday: r.podcast.listenedToday, streak: r.podcast.streak, count: r.podcast.count }); } })
      .catch(() => { if (active) setPodcast(null); });
    return () => { active = false; };
  }, []);

  const markListened = useCallback(() => {
    listeningPodcastsApi.markListened().then(setStats).catch(() => {});
    markActivity("podcast");
  }, []);

  if (podcast === undefined) {
    return <section className="card card-pad" style={{ textAlign: "center", color: "var(--mute)" }}>Loading today&apos;s podcast…</section>;
  }
  if (!podcast || !podcast.audioUrl) {
    return <ComingSoon def={def} skillLabel={skillLabel} lectureHref={lectureHref} planName={planName} accessUntil={accessUntil} />;
  }

  const live = stats ?? { listenedToday: podcast.listenedToday, streak: podcast.streak, count: podcast.count };

  return (
    <>
      <section className="pod-hero">
        <div className="pod-hero-top">
          <span className="pod-ico" aria-hidden><HeadphoneSvg /></span>
          <div className="pod-hero-head">
            <span className="pod-eyebrow"><span className="oethq-livebadge">● LIVE</span>{podcast.kicker || "Daily Live Podcast"}{podcast.durationSec ? ` · ${fmtDuration(podcast.durationSec)}` : ""}</span>
            <h2>{podcast.title}</h2>
          </div>
        </div>
        {podcast.description ? <p className="pod-desc">{podcast.description}</p> : null}
        <PodcastPlayer src={podcast.audioUrl} onNearEnd={markListened} />
        <StatsRow stats={live} total={podcast.total} />
        <span className="pod-meta">A new podcast every 24 hours · {podcast.total} in the library · next in {humanCountdown(podcast.nextRotatesInMs)}</span>
      </section>

      <div className="split">
        <div>
          <section className="card">
            <div className="card-head"><div><h2>How to use the daily live podcast</h2><p>From official OET Listening sources — train your ear for Part C monologues and interviews.</p></div></div>
            <div className="card-pad">
              <div className="feat">
                {def.planned.map((f) => (<div key={f}><i><StarSvg /></i><b>{f}</b></div>))}
              </div>
            </div>
          </section>
        </div>
        <aside className="ctx">
          <section className="card card-pad">
            <p className="caps">Today&apos;s podcast</p>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>{podcast.title}</p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
              Everyone hears the same podcast today. It rotates automatically to a new one from the library every 24 hours, and your progress is tracked.
            </p>
          </section>
          <section className="card card-pad">
            <p className="caps">Included with your plan</p>
            <div className="mini" style={{ border: "none", paddingTop: 0 }}>
              <span className="mini-ico"><ShieldSvg /></span>
              <span className="mini-t"><b>No extra cost</b><span>Owned with {planName}</span></span>
            </div>
            {accessUntil && (
              <div className="mini">
                <span className="mini-ico"><ShieldSvg /></span>
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

function ComingSoon({ def, skillLabel, lectureHref, planName, accessUntil }: Props) {
  return (
    <>
      <section className="soon-hero">
        <span className="pill"><StarSvg /> In development</span>
        <h2>{def.title}</h2>
        <p>{def.tagline}</p>
        <div className="soon-bar">
          <div className="t">
            <b>Podcast library filling up</b>
            <p>You own this module already. The daily podcast appears here as soon as the library is published, at no extra cost.</p>
            <div className="soon-track"><i style={{ width: "60%" }} /></div>
          </div>
        </div>
      </section>
      <div className="split">
        <div>
          <section className="card">
            <div className="card-head"><div><h2>What this module gives you</h2><p>A new premium listening podcast every day.</p></div></div>
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
              This skill is covered in your method lectures and timed tests. Start there and the daily podcast will sharpen it soon.
            </p>
            <Link className="btn btn-primary btn-sm" href={lectureHref} style={{ width: "100%" }}>Watch the {skillLabel} lecture</Link>
          </section>
          <section className="card card-pad">
            <p className="caps">Included with your plan</p>
            <div className="mini" style={{ border: "none", paddingTop: 0 }}>
              <span className="mini-ico"><ShieldSvg /></span>
              <span className="mini-t"><b>No extra cost</b><span>Owned with {planName}</span></span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
