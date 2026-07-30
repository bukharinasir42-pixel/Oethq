"use client";

/**
 * WebsiteCourseCatalogue — homepage "Choose your course" section.
 * Visual design per the client `courses.html` (scoped `.crs-*`); prices/links
 * stay DYNAMIC from the live product catalogue + plans so admin price edits flow
 * straight through. Complete → /courses (existing plans/packages flow).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";
import type { PlanDto } from "@/lib/types";
import "./oethq-courses-section.css";

const usd = (n: number) => `US$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const Arrow = () => (<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);

export function WebsiteCourseCatalogue() {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [plans, setPlans] = useState<PlanDto[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      productsApi.list().then((r) => r.products).catch(() => [] as CatalogueProduct[]),
      apiFetch<PlanDto[]>("/plans", { token: null }).catch(() => [] as PlanDto[])
    ]).then(([p, pl]) => {
      if (!active) return;
      setProducts(p);
      setPlans(pl);
    });
    return () => { active = false; };
  }, []);

  const priceOf = (slug: string, fallback: number) => {
    const p = products.find((x) => x.slug === slug);
    return p && p.price != null ? Number(p.price) : fallback;
  };

  // Each single-skill course now has four price tiers (Foundation → Mega).
  const tierRange = (skillEnum: string, from: number, up: number) => {
    const prices = products
      .filter((p) => p.tierRank > 0 && p.includedSkills[0] === skillEnum && !p.retired && p.price != null)
      .map((p) => Number(p.price))
      .filter((n) => n > 0);
    return prices.length ? { from: Math.min(...prices), up: Math.max(...prices) } : { from, up };
  };
  const Rr = tierRange("READING", 39, 139);
  const Lr = tierRange("LISTENING", 39, 139);
  const Wr = tierRange("WRITING", 39, 139);

  const activePlans = plans.filter((pl) => pl.isActive ?? true);
  const paidPrices = activePlans.filter((pl) => pl.tier !== "STARTER").map((pl) => Number(pl.price)).filter((n) => n > 0);
  const completeFrom = paidPrices.length ? Math.min(...paidPrices) : 249;
  const completeUp = paidPrices.length ? Math.max(...paidPrices) : 1299;
  const completeTiers = activePlans.length || 5;
  const hasFreeTrial = activePlans.some((pl) => pl.tier === "STARTER");

  return (
    <section className="crs-section" id="courses" aria-labelledby="crs-heading">
      <div className="crs-wrap">
        <div className="crs-head">
          <span className="crs-eyebrow">Choose your course</span>
          <h2 id="crs-heading">Fix all four skills, or fix the <span className="crs-blue">one that&apos;s failing you.</span></h2>
          <p className="crs-lede">Every course is taught on a scheduled cohort timetable and built in-house by OET examiners and applied linguistics professors. Open a course to see its plans.</p>
        </div>

        <div className="crs-grid">

          {/* COMPLETE COURSE — flagship */}
          <Link className="crs-course crs-course--flag crs-stretch" href="/courses">
            <span className="crs-tag">&#9733; Flagship &middot; all four skills</span>
            <h3>OET Complete Course</h3>
            <p className="crs-desc">Reading, Listening, Writing and Speaking in one system — cohort lectures, live daily drills, writing corrections and the Pass Predictor that tells you when to book the real exam.</p>
            <div className="crs-skills">
              <span className="crs-chip">Reading</span><span className="crs-chip">Listening</span><span className="crs-chip">Writing</span><span className="crs-chip">Speaking</span>
            </div>
            <div className="crs-facts">
              <div className="crs-fact"><b>{completeTiers} tiers</b><span>{hasFreeTrial ? "Free trial included" : "Plans available"}</span></div>
              <div className="crs-fact"><b>Up to 60d</b><span>Access range</span></div>
              <div className="crs-fact"><b>Day 45</b><span>Library refreshes</span></div>
            </div>
            <div className="crs-foot">
              <div className="crs-price">
                <small>Invest from</small>
                <b>{usd(completeFrom)} <em>&mdash; up to {usd(completeUp)}</em></b>
                {hasFreeTrial ? <span className="crs-free">Start free &mdash; 7 days, no card</span> : null}
              </div>
              <span className="crs-btn crs-btn--light crs-btn--sm">View the plans <Arrow /></span>
            </div>
          </Link>

          {/* READING */}
          <Link className="crs-course crs-course--solo crs-stretch" href="/courses/reading">
            <span className="crs-tag">Single skill</span>
            <h3>OET Reading Course</h3>
            <p className="crs-desc">For candidates whose only barrier is Reading. Part A speed and spelling, Part C opinion and attitude — every mock sat on the official OET exam interface.</p>
            <div className="crs-skills">
              <span className="crs-chip">Part A drills</span><span className="crs-chip">Part C drills</span><span className="crs-chip">Official interface</span>
            </div>
            <div className="crs-facts">
              <div className="crs-fact"><b>Part A&ndash;C</b><span>Full strategy</span></div>
              <div className="crs-fact"><b>4 plans</b><span>Foundation &rarr; Mega</span></div>
              <div className="crs-fact"><b>Official</b><span>Exam interface</span></div>
            </div>
            <div className="crs-foot">
              <div className="crs-price">
                <small>Invest from</small>
                <b>{usd(Rr.from)} <em>&mdash; up to {usd(Rr.up)}</em></b>
              </div>
              <span className="crs-btn crs-btn--primary crs-btn--sm">See the plans <Arrow /></span>
            </div>
          </Link>

          {/* LISTENING */}
          <Link className="crs-course crs-course--solo crs-stretch" href="/courses/listening">
            <span className="crs-tag">Single skill</span>
            <h3>OET Listening Course</h3>
            <p className="crs-desc">For candidates whose only barrier is Listening. Part A note-taking and spelling, Part C speaker attitude — every mock played once, on the official OET interface.</p>
            <div className="crs-skills">
              <span className="crs-chip">Part A drills</span><span className="crs-chip">Part C drills</span><span className="crs-chip">Single-play audio</span>
            </div>
            <div className="crs-facts">
              <div className="crs-fact"><b>Part A&ndash;C</b><span>Full strategy</span></div>
              <div className="crs-fact"><b>4 plans</b><span>Foundation &rarr; Mega</span></div>
              <div className="crs-fact"><b>Single-play</b><span>Real audio</span></div>
            </div>
            <div className="crs-foot">
              <div className="crs-price">
                <small>Invest from</small>
                <b>{usd(Lr.from)} <em>&mdash; up to {usd(Lr.up)}</em></b>
              </div>
              <span className="crs-btn crs-btn--primary crs-btn--sm">See the plans <Arrow /></span>
            </div>
          </Link>

          {/* WRITING */}
          <Link className="crs-course crs-course--solo crs-stretch" href="/courses/writing">
            <span className="crs-tag">Single skill</span>
            <h3>OET Writing Course</h3>
            <p className="crs-desc">For candidates whose only barrier is the referral letter. Marked line by line against all six official OET Writing criteria — by a human, not a model.</p>
            <div className="crs-skills">
              <span className="crs-chip">6 official criteria</span><span className="crs-chip">Human marked</span><span className="crs-chip">Case notes</span>
            </div>
            <div className="crs-facts">
              <div className="crs-fact"><b>6 criteria</b><span>Marked to all</span></div>
              <div className="crs-fact"><b>2 &ndash; 12</b><span>Letter corrections</span></div>
              <div className="crs-fact"><b>Human</b><span>Not a model</span></div>
            </div>
            <div className="crs-foot">
              <div className="crs-price">
                <small>Invest from</small>
                <b>{usd(Wr.from)} <em>&mdash; up to {usd(Wr.up)}</em></b>
                <span className="crs-free">Standalone correction packs still available</span>
              </div>
              <span className="crs-btn crs-btn--primary crs-btn--sm">See the plans <Arrow /></span>
            </div>
          </Link>

          {/* SPEAKING — coming soon (same dimensions as the other solo cards) */}
          <article className="crs-course crs-course--solo crs-course--soon" aria-label="OET Speaking Course — coming soon">
            <span className="crs-tag">Single skill &middot; next</span>
            <h3>OET Speaking Course</h3>
            <p className="crs-desc">Role-play control, relationship building and the language examiners actually reward — trained on scheduled live sessions, the same way as the other skills.</p>
            <div className="crs-skills">
              <span className="crs-chip">Role-play control</span><span className="crs-chip">Relationship building</span><span className="crs-chip">Live sessions</span>
            </div>
            <div className="crs-facts">
              <div className="crs-fact"><b>Role-play</b><span>Exam format</span></div>
              <div className="crs-fact"><b>Examiner</b><span>Reward language</span></div>
              <div className="crs-fact"><b>Live</b><span>Scheduled</span></div>
            </div>
            <div className="crs-foot">
              <div className="crs-price">
                <small>Launching</small>
                <span className="crs-soon-price">Coming soon</span>
              </div>
              <span className="crs-btn crs-btn--primary crs-btn--sm" aria-disabled="true">Coming soon</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
