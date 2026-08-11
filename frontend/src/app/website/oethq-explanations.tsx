"use client";

/**
 * OethqExplanations — the homepage showcase for the Reading walkthrough.
 *
 * This is the thing no other OET academy has, so it gets its own section
 * rather than a line in a feature list. It shows the product instead of
 * describing it: a miniature of the real review screen, with the evidence
 * sentence highlighting itself in the passage and the reasoning assembling
 * beside it, in the order a student actually reads them.
 *
 * The content is the genuine article, taken from Reading Test No 1 question 1.
 * Nothing here is written for the website — a candidate who buys arrives at the
 * same words, which is the only way a demonstration is worth running.
 *
 * The animation plays once, when the section is scrolled to, and never for
 * anyone who has asked for reduced motion.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./oethq-explanations.css";

export function OethqExplanations() {
  const demoRef = useRef<HTMLDivElement | null>(null);
  const factsRef = useRef<HTMLDivElement | null>(null);
  const [demoIn, setDemoIn] = useState(false);
  const [factsIn, setFactsIn] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      setDemoIn(true);
      setFactsIn(true);
      return;
    }
    const watch = (el: HTMLElement | null, done: () => void) => {
      if (!el) return null;
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            done();
            io.unobserve(e.target);
          }
        },
        { threshold: 0.28, rootMargin: "0px 0px -6% 0px" }
      );
      io.observe(el);
      return io;
    };
    const a = watch(demoRef.current, () => setDemoIn(true));
    const b = watch(factsRef.current, () => setFactsIn(true));
    return () => {
      a?.disconnect();
      b?.disconnect();
    };
  }, []);

  return (
    <section className="xp-section" id="explanations" aria-labelledby="xp-heading">
      <div className="xp-wrap">
        <div className="xp-head">
          <span className="xp-pill">New for 2026</span>
          <h2 id="xp-heading">
            Every answer, <em>explained by Dr Nasir.</em>
          </h2>
          <p>
            Most academies give you a mock test and an answer key. A key tells you that you were
            wrong. It never tells you <b>why the sentence you chose was the wrong sentence</b>. Sit
            any Reading test or past paper with us and you get the paper worked through question by
            question, in his own words.
          </p>
        </div>

        {/* A miniature of the real review screen. Same content, same order. */}
        <div className={`xp-demo${demoIn ? " xp-in" : ""}`} ref={demoRef}>
          <div className="xp-bar">
            <span className="xp-dot" />
            <span className="xp-dot" />
            <span className="xp-dot" />
            <span className="xp-bartxt">Part A &middot; Question 1</span>
            <span className="xp-verdict">You got this wrong</span>
          </div>

          <div className="xp-split">
            <div className="xp-src">
              <div className="xp-eyebrow">Text A &middot; Assessing severity</div>
              <p>
                Severity in acute asthma should be established using both the overall clinical
                impression and objective measurement; wheeze intensity and audible breathlessness
                correlate poorly with the true degree of airflow obstruction.
              </p>
              <p>
                <mark className="xp-mark">
                  Where a reliable peak flow reading cannot be obtained on the first attempt,
                  treatment should begin immediately rather than being withheld while further
                  attempts are made.
                </mark>
              </p>
              <p>
                A peak flow of 33&ndash;50% of the patient&rsquo;s best or predicted value, together with a
                respiratory rate above 25 per minute, a heart rate above 110, or inability to
                complete sentences in one breath, indicates acute severe asthma.
              </p>
              <p>
                A carbon dioxide level that has begun to rise toward, or settle within, the normal
                reference range should be regarded with particular caution in a patient who remains
                breathless, since this pattern often reflects fatigue rather than genuine
                improvement.
              </p>
            </div>

            <div className="xp-exp">
              <div className="xp-block">
                <div className="xp-h4">The question</div>
                <div className="xp-q">
                  Which text indicates that treatment must not be held back simply because a first
                  attempt at objective measurement was unsuccessful?
                </div>
              </div>

              <div className="xp-block">
                <div className="xp-h4">Proof in the text</div>
                <div className="xp-ev">
                  <q>
                    Where a reliable peak flow reading cannot be obtained on the first attempt,
                    treatment should begin immediately rather than being withheld…
                  </q>
                </div>
              </div>

              <div className="xp-block">
                <div className="xp-h4">Same meaning, different words</div>
                <div className="xp-bridge">
                  <span className="xp-br">
                    <b>held back</b>
                    <i>&rarr;</i>
                    <u>withheld</u>
                  </span>
                  <span className="xp-br">
                    <b>first attempt at measurement</b>
                    <i>&rarr;</i>
                    <u>the first attempt</u>
                  </span>
                </div>
              </div>

              <div className="xp-block">
                <div className="xp-h4">Why this answer is right</div>
                <div className="xp-prose">
                  The question asks about a rule. It says treatment must <b>not be held back</b>.
                  Text A says treatment should begin at once, and should not be <b>withheld</b>.
                  Held back and withheld mean the same thing. That is a <b>paraphrase</b>: same
                  meaning, different words.
                </div>
              </div>

              <div className="xp-block">
                <div className="xp-h4">Remember this next time</div>
                <div className="xp-lesson">
                  The question will almost never use the same words as the text. Look for the same{" "}
                  <b>meaning</b>, not the same words.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`xp-facts${factsIn ? " xp-in-facts" : ""}`} ref={factsRef}>
          <div className="xp-fact is-gold">
            <b>42 / 42</b>
            <span>Every question explained, not only the ones you got wrong</span>
          </div>
          <div className="xp-fact is-blue">
            <b>Highlighted</b>
            <span>The exact sentence the answer comes from, marked in the passage</span>
          </div>
          <div className="xp-fact is-green">
            <b>Every option</b>
            <span>Including why the tempting wrong one was tempting, and the phrase that breaks it</span>
          </div>
          <div className="xp-fact">
            <b>4 days</b>
            <span>Live classes a week, on the days and at the times you choose</span>
          </div>
        </div>

        <div className="xp-sign">
          <span className="xp-rule" aria-hidden />
          <span>
            Written by <b>Dr Nasir Bukhari</b> for every OET HQ Reading test and past paper
          </span>
          <span className="xp-rule" aria-hidden />
        </div>

        <div className="xp-cta-row">
          <Link className="xp-cta" href="/#courses">
            See the courses <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
