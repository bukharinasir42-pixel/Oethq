"use client";

/**
 * CheatSheetModule — the premium per-skill "Cheat Sheets" surface. Shows the
 * cheat-sheet PDFs first (inline preview + open/download), then a flagship
 * "How to use the cheat sheets" heading with the how-to lecture video(s). Content
 * is admin-managed (PortalResource) and gated server-side by skill ownership.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { portalResourcesApi, type CheatSheetItem, type CheatSheetResponse } from "@/lib/portal-resources-api";
import "./reading-article.css";

const StarSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>
);
const ShieldSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 22s8-4.5 8-10V5l-8-3-8 3v7c0 5.5 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
);
const CalSvg = () => (
  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
);

function VideoEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", background: "#0f172a" }}>
      <iframe
        src={src}
        title={title}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}

function PdfCard({ item }: { item: CheatSheetItem }) {
  if (!item.pdfUrl) return null;
  return (
    <section className="card" style={{ overflow: "hidden" }}>
      <div className="card-head" style={{ gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{item.title}</h2>
          {item.description ? <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--mute)" }}>{item.description}</p> : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <a className="btn btn-quiet btn-sm" href={item.pdfUrl} target="_blank" rel="noreferrer">Open full screen</a>
          <a className="btn btn-primary btn-sm" href={item.pdfUrl} download>Download</a>
        </div>
      </div>
      <div className="card-pad">
        <iframe
          src={`${item.pdfUrl}#view=FitH`}
          title={item.title}
          style={{ width: "100%", height: 620, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }}
        />
      </div>
    </section>
  );
}

type Props = { skill: "READING" | "LISTENING"; skillLabel: string; lectureHref: string; planName: string; accessUntil: string | null };

export function CheatSheetModule({ skill, skillLabel, lectureHref, planName, accessUntil }: Props) {
  const [data, setData] = useState<CheatSheetResponse | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    portalResourcesApi.cheatSheets(skill)
      .then((r) => { if (active) setData(r); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, [skill]);

  if (data === undefined) {
    return <section className="card card-pad" style={{ textAlign: "center", color: "var(--mute)" }}>Loading cheat sheets…</section>;
  }

  const pdfs = data?.pdfs ?? [];
  const videos = data?.videos ?? [];
  const isEmpty = pdfs.length === 0 && videos.length === 0;

  return (
    <>
      <section className="drill-hero">
        <div className="drill-hero-top">
          <span className="drill-ico ar-hero-ico" aria-hidden><StarSvg /></span>
          <div>
            <span className="drill-eyebrow"><span className="oethq-livebadge">★ PREMIUM</span> {skillLabel} Cheat Sheets</span>
            <h2>OET {skillLabel} Cheat Sheets</h2>
          </div>
        </div>
        <p>Download and study the {skillLabel.toLowerCase()} cheat sheets, then watch the lessons below on exactly how to use them in the exam.</p>
      </section>

      {isEmpty ? (
        <section className="card card-pad" style={{ textAlign: "center", color: "var(--mute)" }}>
          <b style={{ color: "var(--ink)" }}>Cheat sheets are being prepared</b>
          <p style={{ margin: "8px auto 0", maxWidth: 440, lineHeight: 1.6 }}>
            You own this module. The {skillLabel.toLowerCase()} cheat sheets and the how-to lessons appear here as soon as they&apos;re published — at no extra cost.
          </p>
        </section>
      ) : (
        <div className="split">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* PDFs first */}
            {pdfs.map((p) => <PdfCard key={p.id} item={p} />)}

            {/* How-to lecture videos */}
            {videos.length > 0 ? (
              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>How to use the cheat sheets</h2>
                    <p>Watch these short lessons on applying the {skillLabel.toLowerCase()} cheat sheets under exam conditions.</p>
                  </div>
                </div>
                <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {videos.map((v) => (
                    <div key={v.id}>
                      <p style={{ margin: "0 0 8px", fontSize: 14.5, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.01em" }}>{v.title}</p>
                      {v.description ? <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>{v.description}</p> : null}
                      {v.embedUrl ? <VideoEmbed src={v.embedUrl} title={v.title} /> : (
                        <p style={{ fontSize: 13, color: "var(--mute)" }}>This lesson&apos;s video isn&apos;t available yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="ctx">
            <section className="card card-pad">
              <p className="caps">In this module</p>
              <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                {pdfs.length} cheat sheet{pdfs.length === 1 ? "" : "s"} to view &amp; download{videos.length ? ` · ${videos.length} how-to lesson${videos.length === 1 ? "" : "s"}` : ""}.
              </p>
              <Link className="btn btn-primary btn-sm" href={lectureHref} style={{ width: "100%" }}>Watch the {skillLabel} lectures</Link>
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
      )}
    </>
  );
}
