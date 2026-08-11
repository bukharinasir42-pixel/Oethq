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

/** The Listening card's waveform, as percentages of the strip height. */
const WAVE = [
  22, 38, 55, 34, 68, 84, 61, 44, 72, 92, 70, 48, 30, 52, 78, 96, 74, 55,
  36, 62, 88, 66, 42, 28, 50, 76, 58, 40, 66, 86, 54, 33, 46, 26
];
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
          <p className="crs-lede">Four live classes a week on a timetable you set yourself, material built in-house by OET examiners and applied linguistics professors, and every Reading paper explained question by question afterwards. Open a course to see its plans.</p>
        </div>

        <div className="crs-grid">

          {/* COMPLETE COURSE — flagship */}
          <Link className="crs-course crs-course--flag crs-stretch" href="/courses">
            <span className="crs-tag">&#9733; Flagship &middot; all four skills</span>
            <h3>OET Complete Material</h3>
            <p className="crs-desc">All four skills in one system. <b>Four live classes a week</b> on days and at times you set yourself, every Reading paper <b>explained question by question</b> afterwards, human writing corrections, and the Pass Predictor that tells you when to book the real exam.</p>
            <div className="crs-skills">
              <span className="crs-chip">Reading</span><span className="crs-chip">Listening</span><span className="crs-chip">Writing</span><span className="crs-chip">Speaking</span>
            </div>

            {/* The right half of this card was empty. Two of the things the
                plan actually buys, shown rather than listed, in space the
                card was already occupying. */}
            <div className="crs-flagpanel" aria-hidden="true">
              <div className="crs-fp-card">
                <span className="crs-fp-label">Your week</span>
                <div className="crs-week">
                  <span className="crs-day">M</span>
                  <span className="crs-day on">T</span>
                  <span className="crs-day on">W</span>
                  <span className="crs-day">T</span>
                  <span className="crs-day on">F</span>
                  <span className="crs-day on">S</span>
                  <span className="crs-day">S</span>
                </div>
                <span className="crs-fp-note">Four days you pick, two sessions each, at your hours</span>
              </div>
              <div className="crs-fp-card">
                <span className="crs-fp-label">After every Reading paper</span>
                <p className="crs-fp-line">
                  <mark className="crs-demo-mark">treatment should begin immediately</mark>
                </p>
                <span className="crs-fp-note">The sentence the answer came from, marked for you</span>
              </div>
            </div>
            <div className="crs-facts">
              <div className="crs-fact"><b>{completeTiers} tiers</b><span>{hasFreeTrial ? "Free trial included" : "Plans available"}</span></div>
              <div className="crs-fact"><b>4 days/wk</b><span>Live, at your times</span></div>
              <div className="crs-fact"><b>Explained</b><span>Every Reading paper</span></div>
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
            <h3>OET Reading Material</h3>
            <p className="crs-desc">For candidates whose only barrier is Reading. Part A speed, Part C attitude, sat on the official exam interface — then <b>every answer explained by Dr Nasir</b>, with the sentence it came from marked in the passage.</p>

            {/* The feature, running, rather than the claim that it exists. The
                sentence marks itself on a slow loop, which is precisely what a
                student sees on the review screen after they submit. */}
            <div className="crs-demo" aria-hidden="true">
              <p className="crs-demo-line">
                Where a reliable peak flow reading cannot be obtained,{" "}
                <mark className="crs-demo-mark">treatment should begin immediately</mark>
              </p>
              <span className="crs-demo-cap">The sentence your answer came from, highlighted for you</span>
            </div>

            <div className="crs-skills">
              <span className="crs-chip">Part A drills</span><span className="crs-chip">Part C drills</span><span className="crs-chip">Written explanations</span>
            </div>
            <div className="crs-facts">
              <div className="crs-fact"><b>Part A&ndash;C</b><span>Full strategy</span></div>
              <div className="crs-fact"><b>42/42</b><span>Questions explained</span></div>
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
            <h3>OET Listening Material</h3>
            <p className="crs-desc">For candidates whose only barrier is Listening. Part A note-taking and spelling, Part C speaker attitude — every mock played <b>once</b>, on the official OET interface, exactly as it runs on the day.</p>
            {/* The same slot as Reading's, carrying the fact that is true here.
                Listening has no written explanations and does not claim any. */}
            <div className="crs-demo crs-demo--wave" aria-hidden="true">
              <div className="crs-wave">
                {WAVE.map((h, i) => (
                  <i
                    key={i}
                    style={{ height: `${h}%`, animationDelay: `${(i * 0.085).toFixed(3)}s` }}
                  />
                ))}
              </div>
              <span className="crs-demo-cap">Played once. No rewind, exactly as the exam runs</span>
            </div>

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
            <h3>OET Writing Corrections</h3>
            <p className="crs-desc">For candidates whose only barrier is the referral letter. Marked line by line against all six official OET Writing criteria, with your current score and your projected Grade B score — by a human, not a model.</p>
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
