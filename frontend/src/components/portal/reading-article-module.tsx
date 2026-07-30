"use client";

/**
 * ReadingArticleModule — the Reading Part B/C core-skill surface. If the article
 * bank has published articles it shows a premium "Article of the day" landing +
 * a magazine-style reader (structured content, our serif typography). Empty bank
 * → premium "coming soon". All markup scoped under the shell's `.oethq-portal`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { readingArticlesApi, type ArticleOfDay } from "@/lib/reading-articles-api";
import { portalResourcesApi, type ArticleIntro } from "@/lib/portal-resources-api";
import { markActivity } from "@/lib/activity-api";
import "./reading-article.css";

/** The admin-configured "must watch before Part C articles" intro video, shown
 *  above the articles surface. Renders nothing until/unless one is published. */
function ArticleIntroBlock({ intro }: { intro: ArticleIntro | null }) {
  if (!intro?.embedUrl) return null;
  return (
    <section className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
      <div className="card-head">
        <div>
          <h2 style={{ margin: 0 }}><span className="oethq-livebadge">★ WATCH FIRST</span> {intro.title}</h2>
          {intro.description ? <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--mute)" }}>{intro.description}</p> : null}
        </div>
      </div>
      <div className="card-pad">
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", background: "#0f172a" }}>
          <iframe
            src={intro.embedUrl}
            title={intro.title}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      </div>
    </section>
  );
}

const StarSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>
);
const ShieldSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M12 22s8-4.5 8-10V5l-8-3-8 3v7c0 5.5 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
);
const CalSvg = () => (
  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
);
const BookSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 012-2h10a2 2 0 012 2v16l-6-3-6 3V5z" /><path d="M9 7h6M9 11h6" /></svg>
);

const toParas = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const pad2 = (n: number) => String(n).padStart(2, "0");
function humanCountdown(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type Def = { title: string; tagline: string; planned: string[] };
type Props = { def: Def; skillLabel: string; lectureHref: string; planName: string; accessUntil: string | null };

export function ReadingArticleModule({ def, skillLabel, lectureHref, planName, accessUntil }: Props) {
  const [article, setArticle] = useState<ArticleOfDay | null | undefined>(undefined);
  const [intro, setIntro] = useState<ArticleIntro | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    let active = true;
    readingArticlesApi.ofDay()
      .then((r) => { if (active) setArticle(r.article); })
      .catch(() => { if (active) setArticle(null); });
    portalResourcesApi.articleIntro()
      .then((r) => { if (active) setIntro(r.intro); })
      .catch(() => { if (active) setIntro(null); });
    return () => { active = false; };
  }, []);

  if (article === undefined) {
    return <section className="card card-pad" style={{ textAlign: "center", color: "var(--mute)" }}>Loading today&apos;s article…</section>;
  }

  if (!article) {
    return <ComingSoon def={def} skillLabel={skillLabel} lectureHref={lectureHref} planName={planName} accessUntil={accessUntil} />;
  }

  if (reading) {
    const paras = toParas(article.bodyText);
    return (
      <>
      <ArticleIntroBlock intro={intro} />
      <section className="card" style={{ overflow: "hidden" }}>
        <div className="card-head" style={{ gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Daily Live Article</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--mute)" }}>From official OET Reading Part C sources · careful-reading practice for Parts B &amp; C</p>
          </div>
          <button className="btn btn-quiet btn-sm" type="button" onClick={() => setReading(false)}>← Back</button>
        </div>
        <div className="card-pad">
          <article className="article-reader">
            {article.kicker ? <div className="ar-kicker">{article.kicker}</div> : null}
            <h1 className="ar-title">{article.title}</h1>
            {article.standfirst ? <p className="ar-standfirst">{article.standfirst}</p> : null}
            <div className="ar-body">
              {paras.map((p, i) => (
                <p key={i} className="ar-para"><span className="ar-num">{pad2(i + 1)}</span>{p}</p>
              ))}
            </div>
            {article.attribution ? <p className="ar-attrib">{article.attribution}</p> : null}
          </article>
        </div>
      </section>
      </>
    );
  }

  return (
    <>
      <ArticleIntroBlock intro={intro} />
      <section className="drill-hero">
        <div className="drill-hero-top">
          <span className="drill-ico ar-hero-ico" aria-hidden><BookSvg /></span>
          <div>
            <span className="drill-eyebrow"><span className="oethq-livebadge">● LIVE</span> Daily Live Article</span>
            <h2>Reading Part B &amp; C · Live Article</h2>
          </div>
        </div>
        <p>{def.tagline}</p>
        <div className="drill-actions">
          <button className="drill-start" type="button" onClick={() => { markActivity("article"); setReading(true); }}>
            <span>Read today&apos;s article <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
          </button>
          <span className="drill-meta">
            A new article every 24 hours · {article.total} in the library · next in {humanCountdown(article.nextRotatesInMs)}
          </span>
        </div>
      </section>

      <div className="split">
        <div>
          <section className="card">
            <div className="card-head"><div><h2>How to use the daily live article</h2><p>From official OET Part C sources — read it the way Part C rewards: for argument, opinion and precise meaning.</p></div></div>
            <div className="card-pad">
              <div className="feat">
                {def.planned.map((f) => (<div key={f}><i><StarSvg /></i><b>{f}</b></div>))}
              </div>
            </div>
          </section>
        </div>
        <aside className="ctx">
          <section className="card card-pad">
            <p className="caps">Today&apos;s article</p>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>{article.title}</p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
              Everyone reads the same article today. It rotates automatically to a new one from the library every 24 hours.
            </p>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => { markActivity("article"); setReading(true); }} style={{ width: "100%" }}>Read now</button>
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

/** Premium "coming soon" shown when the article bank is empty. */
function ComingSoon({ def, skillLabel, lectureHref, planName, accessUntil }: Props) {
  return (
    <>
      <section className="soon-hero">
        <span className="pill"><StarSvg /> In development</span>
        <h2>{def.title}</h2>
        <p>{def.tagline}</p>
        <div className="soon-bar">
          <div className="t">
            <b>Article bank filling up</b>
            <p>You own this module already. The daily article appears here as soon as the library is published, at no extra cost.</p>
            <div className="soon-track"><i style={{ width: "68%" }} /></div>
          </div>
        </div>
      </section>
      <div className="split">
        <div>
          <section className="card">
            <div className="card-head"><div><h2>What this module gives you</h2><p>A new premium reading passage every day.</p></div></div>
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
              This skill is covered in your method lectures and timed tests. Start there and the daily article will sharpen it soon.
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
