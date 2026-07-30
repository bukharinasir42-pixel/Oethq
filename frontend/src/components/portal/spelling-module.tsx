"use client";

/**
 * SpellingModule — the "Listening Spellings" core-skill surface. Shows a premium
 * landing; on Start it runs the provided assessment engine (TTS, streak, results,
 * CSV export) in an iframe, with the LIVE DB bank injected in place of the
 * engine's __SPELLING_BANK__ placeholder. Scoped under the shell's `.oethq-portal`.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { spellingApi, type SpellingDailyBank } from "@/lib/spelling-api";
import { SPELLING_ENGINE_TEMPLATE } from "@/lib/spelling-engine-template";
import { markActivity } from "@/lib/activity-api";

const SpeakerSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 8a5 5 0 010 8M19 5.5a9 9 0 010 13" /></svg>
);
const StarSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>
);
const ShieldSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 22s8-4.5 8-10V5l-8-3-8 3v7c0 5.5 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
);
const CalSvg = () => (
  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
);

const FEATURES = [
  "Hear each term read aloud, then type the spelling",
  "12 medical categories — symptoms, conditions, drugs and more",
  "British / OET spelling standard, graded by difficulty",
  "Streak, accuracy and a missed-word review at the end"
];

type Props = { skillLabel: string; lectureHref: string; planName: string; accessUntil: string | null };

export function SpellingModule({ skillLabel, lectureHref, planName, accessUntil }: Props) {
  const [bank, setBank] = useState<SpellingDailyBank | null | undefined>(undefined);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let active = true;
    // Today's rotating 30-term set (changes every 24h, same for everyone).
    spellingApi.daily().then((b) => { if (active) setBank(b); }).catch(() => { if (active) setBank(null); });
    return () => { active = false; };
  }, []);

  // "New set in Xh" from the server-computed time to the next 24h rotation.
  const rotatesLabel = useMemo(() => {
    if (!bank || !bank.nextRotatesInMs) return null;
    const h = Math.max(0, Math.floor(bank.nextRotatesInMs / 3_600_000));
    const m = Math.max(0, Math.floor((bank.nextRotatesInMs % 3_600_000) / 60_000));
    return h >= 1 ? `New set in ${h}h` : `New set in ${m}m`;
  }, [bank]);

  // Build the engine document once we have the bank + the student starts.
  const srcDoc = useMemo(() => {
    if (!bank || !started) return null;
    return SPELLING_ENGINE_TEMPLATE.replace(
      "__SPELLING_BANK__",
      () => JSON.stringify({ cats: bank.cats, items: bank.items })
    );
  }, [bank, started]);

  if (bank === undefined) {
    return <section className="card card-pad" style={{ textAlign: "center", color: "var(--mute)" }}>Loading the spelling bank…</section>;
  }

  if (!bank || bank.count === 0) {
    return (
      <section className="card card-pad" style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: 8 }}>Spelling assessment coming soon</h2>
        <p style={{ color: "var(--text)", lineHeight: 1.6 }}>Your OET Listening spelling bank is being prepared and will appear here shortly.</p>
      </section>
    );
  }

  if (started && srcDoc) {
    return (
      <section className="card" style={{ overflow: "hidden" }}>
        <div className="card-head" style={{ gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Spelling Assessment</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--mute)" }}>OET Listening Part A · today&apos;s {bank.count} terms{rotatesLabel ? ` · ${rotatesLabel}` : ""}</p>
          </div>
          <button className="btn btn-quiet btn-sm" type="button" onClick={() => setStarted(false)}>← Back</button>
        </div>
        <iframe
          title="OET Listening Spelling Assessment"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"
          allow="autoplay"
          style={{ width: "100%", height: "85vh", minHeight: 640, border: "none", display: "block", background: "#f3f7fc" }}
        />
      </section>
    );
  }

  return (
    <>
      <section className="drill-hero">
        <div className="drill-hero-top">
          <span className="drill-ico" aria-hidden><SpeakerSvg /></span>
          <div>
            <span className="drill-eyebrow">Listening · Part A · Daily set</span>
            <h2>Spelling Assessment</h2>
          </div>
        </div>
        <p>{bank.count} <strong>new</strong> spellings today — a fresh set drawn from the {bank.total.toLocaleString()}-term bank across {bank.cats.length} categories, rotating automatically every 24 hours. Hear each medical term and spell it, exactly like OET Listening Part A.</p>
        <div className="drill-actions">
          <button className="drill-start" type="button" onClick={() => { markActivity("spelling"); setStarted(true); }}>
            <span>Start assessment <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
          </button>
          <span className="drill-meta">Text-to-speech · choose categories &amp; difficulty inside · tracks streak &amp; accuracy</span>
        </div>
      </section>

      <div className="split">
        <div>
          <section className="card">
            <div className="card-head"><div><h2>How the assessment works</h2><p>A timed spelling workout for the words that decide Part A marks.</p></div></div>
            <div className="card-pad">
              <div className="feat">
                {FEATURES.map((f) => (<div key={f}><i><StarSvg /></i><b>{f}</b></div>))}
              </div>
            </div>
          </section>
        </div>
        <aside className="ctx">
          <section className="card card-pad">
            <p className="caps">Today&apos;s set</p>
            <div className="mini" style={{ border: "none", paddingTop: 0 }}>
              <span className="mini-ico"><CalSvg /></span>
              <span className="mini-t"><b>{bank.count} new terms today</b><span>{rotatesLabel ? `${rotatesLabel} · ` : ""}from a {bank.total.toLocaleString()}-term bank</span></span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "var(--mute)" }}>
              Your set changes automatically every 24 hours, so you practise fresh words each day — the same set for the whole cohort.
            </p>
          </section>
          <section className="card card-pad">
            <p className="caps">Sound on</p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
              Each term is read aloud by your device. Turn your volume up and pick a clear voice inside the assessment settings.
            </p>
            <Link className="more" href={lectureHref}>Watch the {skillLabel} lecture <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
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
