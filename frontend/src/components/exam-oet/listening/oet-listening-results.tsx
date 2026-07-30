"use client";

/**
 * OetListeningResults — the post-submit score report, rendered exactly like the
 * ETHQ reference `#results` screen from our graded OetResult. Gauge, grade pill,
 * score grid and a per-part answer review. Driven by React (no DOM mutation).
 */

import { useMemo } from "react";
import type { OetResultsProps } from "@/components/exam-oet/oet-exam-types";
import type { OetListeningImport } from "@/lib/oet-test-schema";
import "./oet-listening-exam.css";

const GAUGE_CIRCUMFERENCE = 527.8;

function predictorFor(score: number): string {
  if (score >= 450)
    return "Outstanding — well above the level most regulators require. Keep this consistency on exam day.";
  if (score >= 350)
    return "Pass predicted ✓ — Grade B is the level accepted by most boards and councils. You are on track.";
  if (score >= 300)
    return "Very close. You are within reach of Grade B — target Part A note-completion accuracy and retest.";
  if (score >= 200)
    return "A solid base to build on. Focus on paraphrase recognition in Parts B and C, then retest.";
  if (score >= 100)
    return "Keep going — structured daily listening practice with ETHQ materials will lift this quickly.";
  return "Start with guided practice and audio transcripts, then attempt the test again.";
}

type RevRow = {
  n: number;
  part: "A" | "B" | "C";
  ok: boolean;
  user: string;
  correct: string;
};

const PART_LABELS: Record<"A" | "B" | "C", string> = {
  A: "Part A · Note completion",
  B: "Part B · Questions 25–30",
  C: "Part C · Questions 31–42",
};

export function OetListeningResults({ result, onRetake }: OetResultsProps) {
  const score = result.scaledScore;
  const bcCorrect = result.partBCorrect + result.partCCorrect;

  const rows = useMemo<RevRow[]>(() => {
    const content = result.content as OetListeningImport;
    const out: RevRow[] = [];

    // Part A — note completion (fill_blank)
    for (const extract of content.partA.extracts) {
      for (const q of extract.questions) {
        const raw = (result.answers[String(q.n)] ?? "").trim();
        out.push({
          n: q.n,
          part: "A",
          ok: !!result.perQuestion[q.n],
          user: raw.length ? raw : "(no answer)",
          correct: q.answer.terms.join(" / ") || q.answer.display || "(key not set)",
        });
      }
    }

    // Part B — MCQ
    for (const item of content.partB.items) {
      const letter = result.answers[String(item.n)];
      const user =
        letter && item.options[letter]
          ? `${letter} — ${item.options[letter]}`
          : "(no answer)";
      const correct = item.options[item.answer]
        ? `${item.answer} — ${item.options[item.answer]}`
        : item.answer || "(key not set)";
      out.push({
        n: item.n,
        part: "B",
        ok: !!result.perQuestion[item.n],
        user,
        correct,
      });
    }

    // Part C — MCQ
    for (const extract of content.partC.extracts) {
      for (const q of extract.questions) {
        const letter = result.answers[String(q.n)];
        const user =
          letter && q.options[letter]
            ? `${letter} — ${q.options[letter]}`
            : "(no answer)";
        const correct = q.options[q.answer]
          ? `${q.answer} — ${q.options[q.answer]}`
          : q.answer || "(key not set)";
        out.push({
          n: q.n,
          part: "C",
          ok: !!result.perQuestion[q.n],
          user,
          correct,
        });
      }
    }

    out.sort((a, b) => a.n - b.n);
    return out;
  }, [result]);

  const gradePillClass = result.pass ? "grade-pass" : "grade-fail";
  const gradeText = `Grade ${result.gradeLabel}` + (result.pass ? " · Pass predicted" : "");

  let lastPart = "";

  return (
    <div className="oet-listening">
      <section id="results" style={{ display: "block" }}>
        <div className="container">
          <div className="res-hero">
            <div className="res-eyebrow">Official Score Report Predictor</div>
            <div className="gauge-wrap">
              <svg viewBox="0 0 200 200" width="250" height="250" aria-hidden="true">
                <circle
                  cx="100"
                  cy="100"
                  r="84"
                  fill="none"
                  stroke="rgba(255,255,255,.14)"
                  strokeWidth="12"
                />
                <circle
                  id="gaugeArc"
                  cx="100"
                  cy="100"
                  r="84"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={GAUGE_CIRCUMFERENCE}
                  strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - score / 500)}
                  transform="rotate(-90 100 100)"
                  style={{
                    transition: "stroke-dashoffset 1.4s cubic-bezier(.22,.9,.35,1)",
                  }}
                />
                <defs>
                  <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#4E9BE0" />
                    <stop offset="100%" stopColor="#D9B554" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="gauge-score">
                <div className="num" id="scoreNum">
                  {score}
                </div>
                <div className="den">OUT OF 500</div>
              </div>
            </div>
            <div>
              <span className={"grade-pill " + gradePillClass} id="gradePill">
                {gradeText}
              </span>
            </div>
            <p className="predictor" id="predictorText">
              {predictorFor(score)}
            </p>
          </div>

          <div className="res-grid">
            <div className="res-cell">
              <div className="big" id="cellCorrect">
                {result.correct}
              </div>
              <div className="lbl">Correct of 42</div>
            </div>
            <div className="res-cell">
              <div className="big" id="cellA">
                {result.partACorrect}
              </div>
              <div className="lbl">Part A · of 24</div>
            </div>
            <div className="res-cell">
              <div className="big" id="cellBC">
                {bcCorrect}
              </div>
              <div className="lbl">Parts B + C · of 18</div>
            </div>
          </div>

          <h2 className="review-h">Answer review</h2>
          <div id="reviewBody">
            {rows.map((r) => {
              const partHeading =
                r.part !== lastPart ? ((lastPart = r.part), PART_LABELS[r.part]) : null;
              return (
                <div key={r.n}>
                  {partHeading ? (
                    <div className="rev-part">{partHeading}</div>
                  ) : null}
                  <div className={"rev-row " + (r.ok ? "ok" : "bad")}>
                    <div className="rev-mark">{r.ok ? "✓" : "✕"}</div>
                    <div>
                      <div className="q">Question {r.n}</div>
                      <div className="ans">
                        Your answer:{" "}
                        <b className={r.ok ? "right" : "wrong"}>{r.user}</b>
                        {r.ok ? null : (
                          <>
                            {" · Correct: "}
                            <b className="right">{r.correct}</b>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="res-actions">
            <button className="btn-ghost" onClick={onRetake}>
              Retake the test
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OetListeningResults;
