"use client";

/**
 * OnboardingGate — a mandatory, flagship full-screen "how to use the course"
 * intro that takes over the portal on a student's first entry. The course does
 * not open until the video is watched to the end.
 *
 * Enforcement (Bunny embed via the player.js protocol):
 *  • tracks real playback progress (timeupdate),
 *  • blocks fast-forwarding — snaps the video back if they seek past what they've
 *    actually watched,
 *  • unlocks "Start my course" only on `ended` (or ≥98% watched).
 * Completion is recorded per account (POST /onboarding-intro/complete) so it
 * never shows again. Renders nothing if no intro video is configured or if the
 * student has already watched it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { portalResourcesApi, type CheatSheetItem } from "@/lib/portal-resources-api";
import "./onboarding-gate.css";

const RING = 2 * Math.PI * 26; // r=26

export function OnboardingGate({ accessGranted }: { accessGranted: boolean }) {
  const [phase, setPhase] = useState<"loading" | "hidden" | "show">("loading");
  const [intro, setIntro] = useState<CheatSheetItem | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pct, setPct] = useState(0);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const maxWatched = useRef(0);
  const duration = useRef(0);

  // Decide whether to show the gate.
  useEffect(() => {
    if (!accessGranted) { setPhase("hidden"); return; }
    let active = true;
    portalResourcesApi.onboardingIntro()
      .then((r) => {
        if (!active) return;
        if (r.watched || !r.intro || !r.intro.embedUrl) setPhase("hidden");
        else { setIntro(r.intro); setPhase("show"); }
      })
      .catch(() => { if (active) setPhase("hidden"); });
    return () => { active = false; };
  }, [accessGranted]);

  // Lock body scroll while the gate is up.
  useEffect(() => {
    if (phase !== "show") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [phase]);

  // player.js bridge: progress, no-skip, and end detection.
  useEffect(() => {
    if (phase !== "show") return;
    const post = (method: string, value?: unknown) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ context: "player.js", version: "0.0.11", method, ...(value !== undefined ? { value } : {}) }), "*"
        );
      } catch { /* ignore */ }
    };
    const subscribe = () => { post("addEventListener", "timeupdate"); post("addEventListener", "ended"); };
    const onMsg = (e: MessageEvent) => {
      let d: unknown = e.data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
      const msg = d as { context?: string; event?: string; value?: { seconds?: number; duration?: number } };
      if (!msg || msg.context !== "player.js") return;
      if (msg.event === "ready") { subscribe(); return; }
      if (msg.event === "ended") { maxWatched.current = duration.current || maxWatched.current; setPct(100); setComplete(true); return; }
      if (msg.event === "timeupdate" && msg.value) {
        const s = Number(msg.value.seconds) || 0;
        const dur = Number(msg.value.duration) || 0;
        if (dur) duration.current = dur;
        if (s > maxWatched.current + 2.5) {
          post("setCurrentTime", maxWatched.current); // block fast-forwarding
        } else {
          maxWatched.current = Math.max(maxWatched.current, s);
          if (duration.current > 0) {
            const p = Math.min(100, Math.round((maxWatched.current / duration.current) * 100));
            setPct(p);
            if (maxWatched.current >= duration.current * 0.98) setComplete(true);
          }
        }
      }
    };
    window.addEventListener("message", onMsg);
    const t = window.setTimeout(subscribe, 900); // in case 'ready' already fired before we attached
    return () => { window.removeEventListener("message", onMsg); window.clearTimeout(t); };
  }, [phase]);

  const start = useCallback(async () => {
    if (!complete || saving) return;
    setSaving(true);
    try { await portalResourcesApi.onboardingComplete(); } catch { /* still let them in */ }
    setPhase("hidden");
  }, [complete, saving]);

  if (phase !== "show" || !intro) return null;

  return (
    <div className="obg" role="dialog" aria-modal="true" aria-label="How to use the course">
      <div className="obg-mesh" aria-hidden><span className="b b1" /><span className="b b2" /><span className="b b3" /></div>
      <div className="obg-card">
        <div className="obg-head">
          <span className="obg-eyebrow">Before you begin</span>
          <h1>How to use your course</h1>
          <p>A quick walkthrough so you get the maximum out of every feature. Your course opens the moment you finish — please watch it through.</p>
        </div>

        <div className={"obg-stage" + (complete ? " done" : "")}>
          <iframe
            ref={iframeRef}
            className="obg-video"
            src={intro.embedUrl ?? ""}
            title={intro.title}
            loading="eager"
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
          />
          {complete ? <span className="obg-burst" aria-hidden /> : null}
        </div>

        <div className="obg-foot">
          <div className="obg-prog">
            <svg viewBox="0 0 60 60" className="obg-ring" aria-hidden>
              <circle className="obg-ring-bg" cx="30" cy="30" r="26" />
              <circle className="obg-ring-fg" cx="30" cy="30" r="26"
                style={{ strokeDasharray: RING, strokeDashoffset: RING - (RING * pct) / 100 }} />
            </svg>
            <div className="obg-prog-t">
              <b>{complete ? "Watched" : `${pct}%`}</b>
              <span>{complete ? "You're all set" : "keep watching"}</span>
            </div>
          </div>

          <button type="button" className={"obg-start" + (complete ? " ready" : "")} onClick={() => void start()} disabled={!complete || saving}>
            <span className="obg-start-sheen" aria-hidden />
            {complete
              ? (saving ? "Opening…" : (<>Start my course <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>))
              : (<><svg viewBox="0 0 24 24" className="obg-lock"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg> Watch to unlock</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
