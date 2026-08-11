"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  OetReadingImport,
  OetReadingPartBItem,
  OetMcqQuestion,
  OetLetterMatchQuestion,
  OetFillBlankQuestion,
} from "@/lib/oet-test-schema";
import type { OetResultsProps } from "../oet-exam-types";
import { fetchExplanationStatus, type ExplanationStatus } from "@/lib/explanations-api";
import { OetReadingReview } from "./oet-reading-review";
import "./oet-reading-exam.css";

/* ------------------------------------------------------------------ scoring reference */

/** Rasch ability estimate (theta, logits) per raw score 0..42 — from the
 *  reference equating table. Used only to display the θ step of the flow. */
const THETA_BY_RAW: number[] = [
  -4.74, -3.52, -2.8, -2.36, -2.04, -1.78, -1.57, -1.38, -1.21, -1.06, -0.91, -0.78, -0.65, -0.53,
  -0.42, -0.31, -0.2, -0.09, 0.01, 0.11, 0.22, 0.32, 0.42, 0.52, 0.62, 0.73, 0.83, 0.94, 1.05, 1.17,
  1.28, 1.41, 1.54, 1.68, 1.84, 2.01, 2.19, 2.41, 2.66, 2.98, 3.42, 4.14, 5.37,
];

type BandInfo = { color: string; bg: string; word: string; msg: string };

function bandInfo(band: string): BandInfo {
  const m: Record<string, BandInfo> = {
    A: {
      color: "#0F9A64",
      bg: "rgba(18,138,91,.20)",
      word: "Excellent",
      msg: "A top-band result across the whole paper — fast, accurate scanning in Part A and reliable careful reading in Parts B and C.",
    },
    B: {
      color: "#5FB8F5",
      bg: "rgba(30,143,225,.20)",
      word: "Strong pass",
      msg: "This meets the level most regulators require (Grade B). Your reading holds up across both the expeditious and careful-reading sections.",
    },
    "C+": {
      color: "#E0A64B",
      bg: "rgba(201,120,26,.22)",
      word: "Borderline",
      msg: "Just below the standard Grade B threshold. Tightening a few careful-reading items in Parts B and C would lift you into a pass.",
    },
    C: {
      color: "#E0A64B",
      bg: "rgba(201,120,26,.22)",
      word: "Developing",
      msg: "Below the pass band. Build accuracy on writer-purpose and inference items, and keep Part A moving so time does not run short.",
    },
    D: {
      color: "#E8808C",
      bg: "rgba(194,59,75,.20)",
      word: "Early stage",
      msg: "Well below the pass band. Focus on locating the exact sentence that answers each question before committing.",
    },
    E: {
      color: "#E8808C",
      bg: "rgba(194,59,75,.20)",
      word: "Early stage",
      msg: "Well below the pass band. Focus on locating the exact sentence that answers each question before committing.",
    },
  };
  return m[band] || m.C;
}

/* ------------------------------------------------------------------ icons */

const RetryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
const FlowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 9l-5 5-3-3-4 4" />
  </svg>
);
const FlowArrow = () => (
  <div className="arw">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  </div>
);

/* ------------------------------------------------------------------ review chips */

type Cls = "correct" | "wrong" | "skip";

function RevCard({
  cls,
  num,
  promptHtml,
  children,
}: {
  cls: Cls;
  num: string;
  promptHtml: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`revcard ${cls}`}>
      <div className="rc-top">
        <div className="rc-num">{cls === "skip" ? "–" : cls === "correct" ? "✓" : "✕"}</div>
        <div>
          <div className="rc-q">
            <b>{num}</b> <span dangerouslySetInnerHTML={{ __html: promptHtml }} />
          </div>
        </div>
      </div>
      <div className="rc-ans">{children}</div>
    </div>
  );
}

const Chip = ({ cls, label, children }: { cls: string; label: string; children: React.ReactNode }) => (
  <span className={`chip ${cls}`}>
    <span className="lab">{label}</span> {children}
  </span>
);

const HtmlChip = ({ cls, label, html }: { cls: string; label: string; html: string }) => (
  <span className={`chip ${cls}`}>
    <span className="lab">{label}</span> <span dangerouslySetInnerHTML={{ __html: html }} />
  </span>
);

/* ------------------------------------------------------------------ component */

export function OetReadingResults({ result, onRetake }: OetResultsProps) {
  const content = result.content as OetReadingImport;

  /**
   * Whether this paper has published explanations.
   *
   * Asked before showing the button rather than after clicking it: a large
   * "Check explanation" call to action that opens onto "nothing here yet" is
   * worse than no button, and papers are being backfilled gradually.
   */
  const [exStatus, setExStatus] = useState<ExplanationStatus | null>(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchExplanationStatus(result.testId).then((s) => {
      if (live) setExStatus(s);
    });
    return () => {
      live = false;
    };
  }, [result.testId]);

  const raw = result.correct;
  const total = result.total;
  const scaled = result.scaledScore;
  const band = result.gradeLabel;
  const bi = bandInfo(band);
  const pct = total > 0 ? Math.round((raw / total) * 100) : 0;
  const theta = THETA_BY_RAW[Math.max(0, Math.min(THETA_BY_RAW.length - 1, raw))];

  const R = 88;
  const CIRC = 2 * Math.PI * R;
  const targetOffset = CIRC * (1 - scaled / 500);
  const [ringOffset, setRingOffset] = useState<number>(CIRC);
  const [barsOn, setBarsOn] = useState<boolean>(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setRingOffset(targetOffset);
      setBarsOn(true);
    }, 140);
    return () => window.clearTimeout(id);
  }, [targetOffset]);

  /* ---- per-part totals ---- */
  const aTotal = content.partA.questions.length;
  const bTotal = content.partB.items.length;
  const cTotal = content.partC.texts.reduce((acc, t) => acc + t.questions.length, 0);

  const answerOf = (n: number): string | undefined => result.answers[String(n)];
  const answered = (n: number): boolean => {
    const v = answerOf(n);
    return v !== undefined && v.trim() !== "";
  };
  const stateOf = (n: number): Cls => {
    if (!answered(n)) return "skip";
    return result.perQuestion[n] ? "correct" : "wrong";
  };

  /* ---- review builders ---- */
  const partAReview = useMemo(() => {
    const qs = [...content.partA.questions].sort((a, b) => a.n - b.n);
    return qs.map((q) => {
      const cls = stateOf(q.n);
      const your = answerOf(q.n);
      let chips: React.ReactNode;
      if (q.type === "letter_match") {
        const lm = q as OetLetterMatchQuestion;
        if (cls === "skip")
          chips = (
            <>
              <Chip cls="skip" label="Your answer:">Not answered</Chip>
              <Chip cls="correct" label="Correct:">Text {lm.answer}</Chip>
            </>
          );
        else if (cls === "correct") chips = <Chip cls="yours-c" label="Your answer:">Text {your}</Chip>;
        else
          chips = (
            <>
              <Chip cls="yours-w" label="Your answer:">Text {your}</Chip>
              <Chip cls="correct" label="Correct:">Text {lm.answer}</Chip>
            </>
          );
      } else {
        const fb = q as OetFillBlankQuestion;
        const accepted = fb.answer.terms.join(" / ");
        if (cls === "skip")
          chips = (
            <>
              <Chip cls="skip" label="Your answer:">Not answered</Chip>
              <Chip cls="correct" label="Accepted:">{accepted}</Chip>
            </>
          );
        else if (cls === "correct") chips = <Chip cls="yours-c" label="You wrote:">{your}</Chip>;
        else
          chips = (
            <>
              <Chip cls="yours-w" label="You wrote:">{your}</Chip>
              <Chip cls="correct" label="Accepted:">{accepted}</Chip>
            </>
          );
      }
      return (
        <RevCard key={q.n} cls={cls} num={`Q${q.n}.`} promptHtml={q.prompt}>
          {chips}
        </RevCard>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, result]);

  const mcqChips = (
    cls: Cls,
    your: string | undefined,
    answer: string,
    options: Record<string, string>
  ): React.ReactNode => {
    const opt = (L: string) => `${L} · ${options[L] ?? ""}`;
    if (cls === "skip")
      return (
        <>
          <Chip cls="skip" label="Your answer:">Not answered</Chip>
          <HtmlChip cls="correct" label="Correct:" html={opt(answer)} />
        </>
      );
    if (cls === "correct") return <HtmlChip cls="yours-c" label="Your answer:" html={opt(your as string)} />;
    return (
      <>
        <HtmlChip cls="yours-w" label="Your answer:" html={opt(your as string)} />
        <HtmlChip cls="correct" label="Correct:" html={opt(answer)} />
      </>
    );
  };

  const partBReview = useMemo(() => {
    return content.partB.items.map((it: OetReadingPartBItem) => {
      const cls = stateOf(it.n);
      return (
        <RevCard key={it.n} cls={cls} num={`Q${it.n}.`} promptHtml={it.prompt}>
          {mcqChips(cls, answerOf(it.n), it.answer, it.options)}
        </RevCard>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, result]);

  const partCReview = useMemo(() => {
    return content.partC.texts.map((T, ti) => (
      <div className="rev-group" key={ti}>
        <div className="rg-title">
          Part C · Text {ti + 1} · {T.title.split("—")[0].trim()}
          <span className="ln" />
        </div>
        {T.questions.map((q: OetMcqQuestion) => {
          const cls = stateOf(q.n);
          return (
            <RevCard key={q.n} cls={cls} num={`Q${q.n}.`} promptHtml={q.prompt}>
              {mcqChips(cls, answerOf(q.n), q.answer, q.options)}
            </RevCard>
          );
        })}
      </div>
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, result]);

  const bdCard = (title: string, sub: string, correct: number, partTotal: number) => {
    const p = partTotal > 0 ? Math.round((correct / partTotal) * 100) : 0;
    return (
      <div className="bd-card">
        <div className="bd-h">
          <div className="tt">
            {title}
            <span>{sub}</span>
          </div>
          <div className="frac">
            {correct}
            <span style={{ color: "var(--muted-2)", fontSize: 15 }}>/{partTotal}</span>
          </div>
        </div>
        <div className="bd-bar">
          <i
            style={{
              width: barsOn ? `${p}%` : "0%",
              transition: "width 1s cubic-bezier(.4,0,.2,1)",
            }}
          />
        </div>
        <div className="bd-meta">
          <span>{p}% correct</span>
          <span>{correct} of {partTotal} correct</span>
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- render */
  // Placed AFTER every hook: an early return above them changes the number of
  // hooks React sees between renders, which it rejects outright.
  if (reviewing) {
    return <OetReadingReview result={result} onBack={() => setReviewing(false)} />;
  }

  return (
    <div className="oet-reading">
      <section className="screen active" id="screenResults">
        <div className="results-wrap">
          <div className="results" id="resultsInner">
            {/* hero */}
            <div className="result-hero">
              <div className="rh-top">
                <div className="logo-chip">
                  <span style={{ fontWeight: 800, color: "var(--navy)", fontSize: 13 }}>OET&nbsp;HQ</span>
                </div>
                <div className="rh-label">Reading Test &middot; Equated Result</div>
              </div>
              <div className="rh-main">
                <div className="scorering">
                  <svg width="200" height="200" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={13} />
                    <circle
                      cx="100"
                      cy="100"
                      r={R}
                      fill="none"
                      stroke="url(#ringgrad)"
                      strokeWidth={13}
                      strokeLinecap="round"
                      strokeDasharray={CIRC}
                      strokeDashoffset={ringOffset}
                      id="ring"
                      style={{ transition: "stroke-dashoffset 1.15s cubic-bezier(.4,0,.2,1)" }}
                    />
                    <defs>
                      <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#5FB8F5" />
                        <stop offset="1" stopColor="#1E8FE1" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="center">
                    <div className="big">{scaled}</div>
                    <div className="cap">SCALED &middot; 0&ndash;500</div>
                    <div className="grade" style={{ background: bi.bg, color: bi.color }}>
                      Grade {band}
                    </div>
                  </div>
                </div>
                <div className="rh-verdict">
                  <div className="rawline">
                    Raw score {raw} / {total} &middot; {pct}% correct
                  </div>
                  <h2>{bi.word}</h2>
                  <p>{bi.msg}</p>
                  <div className="rh-stats">
                    <div className="rh-stat">
                      <div className="n">{scaled}</div>
                      <div className="l">Scaled</div>
                    </div>
                    <div className="rh-stat">
                      <div className="n">{band}</div>
                      <div className="l">Grade</div>
                    </div>
                    <div className="rh-stat">
                      <div className="n">
                        {raw}/{total}
                      </div>
                      <div className="l">Raw</div>
                    </div>
                    <div className="rh-stat">
                      <div className="n">{pct}%</div>
                      <div className="l">Correct</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* score explanation */}
            <div className="section-label">
              How this score was calculated<span className="ln" />
            </div>
            <div className="score-panel">
              <div className="sp-head">
                <div className="h">
                  <FlowIcon /> Rasch-based statistical equating
                </div>
                <div className="sub">42 raw marks → ability estimate (θ) → OET-style scaled score</div>
              </div>
              <div className="sp-body">
                <div className="sp-flow">
                  <div className="sp-step">
                    <div className="k">Raw score</div>
                    <div className="v">
                      {raw}
                      <span style={{ fontSize: 15, color: "var(--muted)" }}>/{total}</span>
                    </div>
                    <div className="u">marks correct</div>
                    <FlowArrow />
                  </div>
                  <div className="sp-step">
                    <div className="k">Ability θ</div>
                    <div className="v">
                      {theta >= 0 ? "+" : ""}
                      {theta.toFixed(2)}
                    </div>
                    <div className="u">logits (Rasch)</div>
                    <FlowArrow />
                  </div>
                  <div className="sp-step">
                    <div className="k">Scaled score</div>
                    <div className="v">{scaled}</div>
                    <div className="u">OET 0&ndash;500</div>
                    <FlowArrow />
                  </div>
                  <div className="sp-step">
                    <div className="k">Grade band</div>
                    <div className="v" style={{ color: bi.color }}>
                      {band}
                    </div>
                    <div className="u">{bi.word}</div>
                  </div>
                </div>
                <div className="sp-note">
                  All 42 items carry a Rasch <b>difficulty</b> (in logits). Your raw total is placed on the common
                  ability scale using these difficulties and converted to the 0&ndash;500 scale — the same measurement
                  family OET uses — so a mark on a hard Part C item counts for more than a mark on an easy Part A item.
                  Grade boundaries: <b>A ≥ 450, B ≥ 350, C+ ≥ 300, C ≥ 200</b>.
                </div>
              </div>
            </div>

            {/* breakdown */}
            <div className="section-label">
              Performance by part<span className="ln" />
            </div>
            <div className="breakdown">
              {bdCard("Part A", "Expeditious reading · 1–20", result.partACorrect, aTotal)}
              {bdCard("Part B", "Careful reading · 21–26", result.partBCorrect, bTotal)}
              {bdCard("Part C", "Careful reading · 27–42", result.partCCorrect, cTotal)}
            </div>

            {/* review */}
            <div className="section-label">
              Answer review<span className="ln" />
            </div>
            <div className="review-head">
              <div className="legend">
                <span>
                  <i className="c" /> Correct
                </span>
                <span>
                  <i className="w" /> Incorrect / skipped
                </span>
              </div>
            </div>

            <div className="rev-group">
              <div className="rg-title">
                Part A · {content.partA.topic}
                <span className="ln" />
              </div>
              {partAReview}
            </div>

            <div className="rev-group">
              <div className="rg-title">
                Part B · Workplace extracts
                <span className="ln" />
              </div>
              {partBReview}
            </div>

            {partCReview}

            {exStatus?.available ? (
              <div className="ex-cta">
                <div className="ex-cta-body">
                  <span className="ex-cta-eyebrow">Now the useful part</span>
                  <h3>Check the explanations</h3>
                  <p>
                    Go through the paper question by question and see the exact sentence each answer
                    came from, why it is the answer, and which options were partial distractors —
                    true in the text, but not what the question asked.
                  </p>
                  {exStatus.viewed ? (
                    <span className="ex-cta-note">
                      You have opened these before, so a retake from here is marked practice and left
                      out of your progress.
                    </span>
                  ) : (
                    <span className="ex-cta-note">
                      Opening this shows you the answers. Any retake afterwards counts as practice and
                      is kept out of your progress, so your real score stays honest.
                    </span>
                  )}
                </div>
                <button className="ex-cta-btn" onClick={() => setReviewing(true)}>
                  Check explanation
                  <span aria-hidden>→</span>
                </button>
              </div>
            ) : null}

            <div className="results-cta">
              <button
                className="btn btn-ghost"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Back to top
              </button>
              <button className="btn btn-ghost" onClick={onRetake}>
                <RetryIcon />
                Retake test
              </button>
            </div>
            <div className="result-footer">
              <b>OET HQ</b> &middot; Prepare &middot; Perform &middot; Progress &nbsp;|&nbsp; Full Reading Test &middot;
              Rasch-Equated (Parts A, B &amp; C)
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OetReadingResults;
