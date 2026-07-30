"use client";

/**
 * WritingCorrectionsLanding — premium landing for the 3 Writing Correction
 * packages (2 / 6 / 12 letters). Prices are live from the product catalogue;
 * "Get N corrections" fires the real login-if-needed → checkout flow. Scoped
 * under `.wcl` so nothing leaks into the shared OethqPageFrame nav/footer.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";
import { getToken } from "@/lib/api";
import "./writing-corrections.css";

const PACKAGE_SLUGS = ["writing-corrections-2", "writing-corrections-6", "writing-corrections-12"];
const FALLBACK: Record<string, { price: number; corrections: number }> = {
  "writing-corrections-2": { price: 28, corrections: 2 },
  "writing-corrections-6": { price: 77, corrections: 6 },
  "writing-corrections-12": { price: 147, corrections: 12 }
};

const CRITERIA = [
  { k: "Purpose", d: "Is the reason for writing immediately clear to the reader?" },
  { k: "Content", d: "The right clinical information, accurate and complete." },
  { k: "Conciseness & Clarity", d: "Every sentence earns its place — no padding." },
  { k: "Genre & Style", d: "Correct register and format for a referral letter." },
  { k: "Organisation & Layout", d: "Logical paragraphing the reader can follow fast." },
  { k: "Language", d: "Grammar, vocabulary and cohesion at Grade-B level." }
];

export function WritingCorrectionsLanding() {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogueProduct[]>([]);

  useEffect(() => {
    let active = true;
    productsApi.list().then((r) => { if (active) setProducts(r.products); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const packages = useMemo(() => PACKAGE_SLUGS.map((slug) => {
    const p = products.find((x) => x.slug === slug);
    const fb = FALLBACK[slug];
    return {
      slug,
      corrections: p?.writingCorrections || fb.corrections,
      price: p?.price ?? fb.price,
      featured: !!p?.featured || slug === "writing-corrections-6",
      purchasable: p ? p.isPurchasable : true
    };
  }), [products]);

  const enrol = useCallback(async (slug: string) => {
    if (!getToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/courses/writing-corrections?enrol=" + slug)}`);
      return;
    }
    try {
      const res = await productsApi.checkout(slug);
      router.push(res.checkoutUrl);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not start checkout. Please try again.");
    }
  }, [router]);

  // auto-continue after login (?enrol=slug)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("enrol");
    if (slug && getToken()) void enrol(slug);
  }, [enrol]);

  return (
    <div className="wcl">
      {/* HERO */}
      <section className="wcl-hero">
        <div className="wcl-hero-inner">
          <span className="wcl-eyebrow"><span className="wcl-dot" /> OET Writing Corrections</span>
          <h1>Written by you. <span>Marked like the real exam.</span></h1>
          <p className="wcl-sub">Every letter is corrected against <b>all six official OET Writing criteria</b> — the exact system the examiners use. Clear our correction, clear the exam.</p>
          <div className="wcl-hero-crit">
            {CRITERIA.map((c, i) => <span key={c.k} className="wcl-crit-chip" style={{ ["--i" as string]: i } as React.CSSProperties}>{c.k}</span>)}
          </div>
          <a className="wcl-hero-cta" href="#packages">See the packages <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>
        </div>
      </section>

      {/* PACKAGES */}
      <section className="wcl-pk-wrap" id="packages">
        <p className="wcl-kicker">Choose your correction pack</p>
        <h2 className="wcl-h2">Three ways to build to a <span>B</span></h2>
        <p className="wcl-lead">Each letter comes back marked to the official criteria with a current score, a projected score, and exactly what to fix. Buy once — corrections never expire while your access lasts.</p>
        <div className="wcl-grid">
          {packages.map((pk) => (
            <article key={pk.slug} className={"wcl-card" + (pk.featured ? " wcl-card--hero" : "")}>
              {pk.featured ? <span className="wcl-badge">★ Most chosen</span> : null}
              <div className="wcl-card-n">{pk.corrections}</div>
              <p className="wcl-card-label">letter correction{pk.corrections === 1 ? "" : "s"}</p>
              <div className="wcl-price"><sup>$</sup>{pk.price}</div>
              <p className="wcl-per">${(pk.price / pk.corrections).toFixed(2)} per letter · one-time</p>
              <ul className="wcl-card-list">
                <li>Marked to all 6 official OET criteria</li>
                <li>Current score + projected Grade B score</li>
                <li>Line-by-line fixes and a model rewrite</li>
                <li>Corrections tracked to your writing ID</li>
              </ul>
              <button type="button" className={"wcl-btn" + (pk.featured ? " wcl-btn--gold" : "")} onClick={() => void enrol(pk.slug)} disabled={!pk.purchasable}>
                Get {pk.corrections} corrections
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </article>
          ))}
        </div>
        <p className="wcl-plan-note">Already on a Complete Course? Your plan includes corrections too — <b>Foundation 3</b>, <b>Precision 7</b>, <b>Elite 15</b>. These packs add on top.</p>
      </section>

      {/* CRITERIA / PROMISE */}
      <section className="wcl-promise">
        <div className="wcl-promise-inner">
          <h2>All official OET Writing criteria. <span>Clear the system, clear the exam.</span></h2>
          <div className="wcl-crit-grid">
            {CRITERIA.map((c, i) => (
              <div key={c.k} className="wcl-crit-card" style={{ ["--i" as string]: i } as React.CSSProperties}>
                <span className="wcl-crit-num">{String(i + 1).padStart(2, "0")}</span>
                <b>{c.k}</b><p>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAMPLE CORRECTION */}
      <section className="wcl-sample">
        <div className="wcl-sample-head">
          <p className="wcl-kicker">See a real correction</p>
          <h2 className="wcl-h2">This is what lands in your inbox</h2>
          <p className="wcl-lead">A full correction report — score comparison, criterion-by-criterion bands, and the rewrite that takes a borderline C+ to a B.</p>
          <div className="wcl-sample-stats">
            <div><b>310<span>/500</span></b><span>Current · C+</span></div>
            <div className="wcl-arrow">→</div>
            <div className="wcl-sample-proj"><b>382<span>/500</span></b><span>Projected · B</span></div>
          </div>
        </div>
        <div className="wcl-sample-frame">
          <div className="wcl-sample-bar"><span className="wcl-tl" />OET Writing Correction Report · Sample #168 · Medicine
            <a className="wcl-sample-open" href="/writing/sample-correction.pdf" target="_blank" rel="noopener">Open full report ↗</a>
          </div>
          <iframe title="Sample OET Writing correction report" src="/writing/sample-correction.pdf#toolbar=0&navpanes=0&view=FitH" />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="wcl-final">
        <h2>Stop guessing why you keep getting a C+.</h2>
        <p>Get your letters marked the way the exam marks them — and fix the exact things costing you the B.</p>
        <a className="wcl-hero-cta" href="#packages">Choose your pack <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>
      </section>
    </div>
  );
}
