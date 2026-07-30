"use client";

/**
 * OetListeningExam — renders an OET Listening sub-test exactly like the ETHQ
 * reference interactive HTML, but driven by our canonical schema and React
 * state (no id/querySelector mutation). Same DOM structure and class names so
 * the scoped `.oet-listening` stylesheet applies verbatim.
 *
 * Flow: cover → 5 paginated steps (Part A ext.1, Part A ext.2, Part B,
 * Part C ext.1, Part C ext.2) → confirm modal → onSubmit. Answers are keyed by
 * GLOBAL question number (1–42) as strings.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  OetListeningExamProps,
} from "@/components/exam-oet/oet-exam-types";
import type {
  OetFillBlankQuestion,
  OetListeningPartAExtract,
  OetListeningPartBItem,
  OetListeningPartCExtract,
  OetMcqQuestion,
} from "@/lib/oet-test-schema";
import "./oet-listening-exam.css";

const TOTAL = 42;
const LOW_SECONDS = 300;

const DEFAULT_BRIEFS = {
  A: "In this part of the test, you will hear two different extracts. In each extract, a health professional is talking to a patient. For questions 1–24, complete the notes with information that you hear. Where a speaker corrects themselves, record the final, corrected version.",
  B: "In this part of the test, you will hear six different extracts. In each extract, you will hear health professionals talking about workplace situations. For questions 25–30, choose the answer (A, B or C) which fits best according to what you hear.",
  C: "In this part of the test, you will hear two different extracts. In each extract, you will hear a health professional talking about an aspect of their work. For questions 31–42, choose the answer (A, B or C) which fits best according to what you hear.",
};
const PART_TITLES = {
  A: "Consultation note completion",
  B: "Short healthcare interactions",
  C: "Extended professional listening",
};

function range(nums: number[]): string {
  if (nums.length === 0) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? `${min}` : `${min}–${max}`;
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

/* ---------------- note-completion line (Part A) ---------------- */
function NoteLi({
  q,
  value,
  onChange,
}: {
  q: OetFillBlankQuestion;
  value: string;
  onChange: (n: number, value: string) => void;
}) {
  const filled = value.trim().length > 0;
  const idx = q.prompt.indexOf("[blank]");
  const before = idx >= 0 ? q.prompt.slice(0, idx) : q.prompt;
  const after = idx >= 0 ? q.prompt.slice(idx + "[blank]".length) : "";
  return (
    <li>
      {before ? <span dangerouslySetInnerHTML={{ __html: before }} /> : null}
      <span className={"qnum" + (filled ? " done" : "")} id={`chip${q.n}`}>
        {q.n}
      </span>
      <input
        className={"gap" + (filled ? " filled" : "")}
        type="text"
        data-q={q.n}
        autoComplete="off"
        spellCheck={false}
        aria-label={`Question ${q.n}`}
        value={value}
        onChange={(e) => onChange(q.n, e.target.value)}
      />
      {after ? <span dangerouslySetInnerHTML={{ __html: after }} /> : null}
    </li>
  );
}

/* ---------------- MCQ block (Parts B & C) ---------------- */
function McqBlock({
  n,
  stemHtml,
  options,
  value,
  onPick,
}: {
  n: number;
  stemHtml: string;
  options: Record<string, string>;
  value: string | undefined;
  onPick: (n: number, letter: string) => void;
}) {
  const done = !!value;
  return (
    <div className="mcq">
      <div className="mcq-stem">
        <div className={"mcq-num" + (done ? " done" : "")} id={`chip${n}`}>
          {n}
        </div>
        <p dangerouslySetInnerHTML={{ __html: stemHtml }} />
      </div>
      <div className="opts">
        {Object.entries(options).map(([letter, text]) => {
          const selected = value === letter;
          return (
            <label
              className={"opt" + (selected ? " selected" : "")}
              data-q={n}
              data-letter={letter}
              key={letter}
            >
              <input
                type="radio"
                name={`q${n}`}
                value={letter}
                checked={selected}
                onChange={() => onPick(n, letter)}
              />
              <span className="letter">{letter}</span>
              <span>{text}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PartHead({
  eyebrow,
  title,
  brief,
}: {
  eyebrow: string;
  title: string;
  brief: string;
}) {
  return (
    <div className="part-head">
      <span className="part-eyebrow">{eyebrow}</span>
      <h2 className="part-title serif">{title}</h2>
      <p className="part-brief">{brief}</p>
    </div>
  );
}

function ExtractCard({
  extract,
  answers,
  onChange,
}: {
  extract: OetListeningPartAExtract;
  answers: Record<string, string>;
  onChange: (n: number, value: string) => void;
}) {
  const byN = new Map(extract.questions.map((q) => [q.n, q]));
  return (
    <div className="extract-card">
      <div className="extract-tag">{extract.heading}</div>
      <p
        className="extract-brief"
        dangerouslySetInnerHTML={{ __html: extract.contextHtml }}
      />
      {extract.groups.map((group, gi) => (
        <div key={gi}>
          <div className="notes-h">{group.heading}</div>
          <ul className="notes">
            {group.questionNumbers.map((qn) => {
              const q = byN.get(qn);
              if (!q) return null;
              return (
                <NoteLi
                  key={qn}
                  q={q}
                  value={answers[String(qn)] ?? ""}
                  onChange={onChange}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PartCSub({ extract }: { extract: OetListeningPartCExtract }) {
  const html = extract.heading
    ? `${extract.heading} — ${extract.contextHtml}`
    : extract.contextHtml;
  return (
    <p
      className="extract-brief"
      style={{ fontWeight: 600, color: "var(--blue-deep)", marginBottom: "16px" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* --------- session audio player: auto-starts, plays ONCE, cannot rewind --------- */
function SessionAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const maxT = useRef(0);
  const [state, setState] = useState<"playing" | "ended" | "blocked">("playing");
  const [pct, setPct] = useState(0);

  // Auto-start on mount (fires right after the user's "Begin" gesture, so the
  // browser autoplay policy permits it). If the browser blocks it, fall back
  // to a one-tap play button.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => setState("playing")).catch(() => setState("blocked"));
    }
  }, []);

  const resume = () => {
    const a = audioRef.current;
    if (!a || state !== "blocked") return;
    const p = a.play();
    if (p && typeof p.then === "function") p.then(() => setState("playing")).catch(() => {});
  };

  // No-rewind guard: never allow currentTime to move backwards.
  const guardSeek = (a: HTMLAudioElement) => {
    if (a.currentTime < maxT.current - 0.35) a.currentTime = maxT.current;
  };

  const label =
    state === "playing"
      ? "Playing — the recording plays once and cannot be paused or rewound"
      : state === "ended"
        ? "Recording finished"
        : "Tap to start the recording — it plays once only";

  return (
    <div className={"audio-bar " + state}>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.currentTime > maxT.current) maxT.current = a.currentTime;
          setPct(a.duration ? Math.min(100, (a.currentTime / a.duration) * 100) : 0);
        }}
        onSeeking={(e) => guardSeek(e.currentTarget)}
        onSeeked={(e) => guardSeek(e.currentTarget)}
        onEnded={() => { setState("ended"); setPct(100); }}
        onError={() => setState("blocked")}
      />
      <button
        type="button"
        className="audio-play"
        onClick={resume}
        disabled={state !== "blocked"}
        aria-label={state === "blocked" ? "Play listening audio" : "Listening audio status"}
      >
        {state === "playing" ? (
          <span className="audio-eq" aria-hidden="true"><i /><i /><i /><i /></span>
        ) : state === "ended" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72c0 .78.85 1.26 1.53.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" /></svg>
        )}
      </button>
      <div className="audio-main">
        <div className="audio-label">
          <span className="audio-tag">Listening audio</span>
          {label}
        </div>
        <div className="audio-track"><div className="audio-fill" style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}

export function OetListeningExam({
  content,
  initialAnswers,
  onAnswersChange,
  onSubmit,
  submitting,
  audioUrl,
}: OetListeningExamProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => ({ ...initialAnswers })
  );
  const answersRef = useRef<Record<string, string>>(answers);
  const [started, setStarted] = useState(false);
  /** After "Begin", show the instructions briefing first, then the questions. */
  const [phase, setPhase] = useState<"briefing" | "questions">("briefing");
  const [currentStep, setCurrentStep] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const submittedRef = useRef(false);

  const totalMinutes = content.timing?.totalMinutes ?? 45;
  const [timeLeft, setTimeLeft] = useState(totalMinutes * 60);

  const STEP_COUNT = 5;

  /* ---------- derived question ranges ---------- */
  const meta = useMemo(() => {
    const extA = content.partA.extracts;
    const partANums = extA.flatMap((e) => e.questions.map((q) => q.n));
    const partBNums = content.partB.items.map((i) => i.n);
    const partCExt = content.partC.extracts;
    const partCNums = partCExt.flatMap((e) => e.questions.map((q) => q.n));
    const stepMeta = [
      `Part A · Extract 1 · Questions ${range(extA[0]?.questions.map((q) => q.n) ?? [])}`,
      `Part A · Extract 2 · Questions ${range(extA[1]?.questions.map((q) => q.n) ?? [])}`,
      `Part B · Questions ${range(partBNums)}`,
      `Part C · Extract 1 · Questions ${range(partCExt[0]?.questions.map((q) => q.n) ?? [])}`,
      `Part C · Extract 2 · Questions ${range(partCExt[1]?.questions.map((q) => q.n) ?? [])}`,
    ];
    return {
      aEyebrow: `Part A · Questions ${range(partANums)}`,
      bEyebrow: `Part B · Questions ${range(partBNums)}`,
      cEyebrow: `Part C · Questions ${range(partCNums)}`,
      stepMeta,
    };
  }, [content]);

  /* ---------- answered count ---------- */
  const answered = useMemo(() => {
    let c = 0;
    for (let q = 1; q <= TOTAL; q++) {
      const v = answers[String(q)];
      if (v && v.trim()) c++;
    }
    return c;
  }, [answers]);

  /* ---------- answer mutation ---------- */
  const setAnswer = (n: number, value: string) => {
    const next = { ...answersRef.current, [String(n)]: value };
    answersRef.current = next;
    setAnswers(next);
    onAnswersChange(next);
  };

  /* ---------- submit ---------- */
  const doSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setShowModal(false);
    onSubmit(answersRef.current);
  };

  const trySubmit = () => {
    if (submittedRef.current || submitting) return;
    setShowModal(true);
  };

  /* ---------- flow ---------- */
  // "Begin the test" → briefing screen; the session audio starts here (once).
  const startTest = () => {
    setStarted(true);
    setPhase("briefing");
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };
  // Leave the briefing and reveal the questions.
  const beginQuestions = () => {
    setPhase("questions");
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [started]);

  useEffect(() => {
    if (started && timeLeft <= 0 && !submittedRef.current) {
      doSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, started]);

  /* ---------- step nav ---------- */
  const gotoStep = (i: number) => {
    const clamped = Math.max(0, Math.min(i, STEP_COUNT - 1));
    setCurrentStep(clamped);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const nextStep = () => gotoStep(currentStep + 1);
  const prevStep = () => gotoStep(currentStep - 1);
  const isLast = currentStep === STEP_COUNT - 1;

  const displayTime = Math.max(0, timeLeft);
  const timerLow = displayTime <= LOW_SECONDS;
  const progressPct = (answered / TOTAL) * 100;

  const extA = content.partA.extracts;
  const extC = content.partC.extracts;

  const partBBrief = content.partB.instructions ?? DEFAULT_BRIEFS.B;
  const partCBrief = content.partC.instructions ?? DEFAULT_BRIEFS.C;
  const partABrief = content.partA.instructions ?? DEFAULT_BRIEFS.A;

  /* ---------- step contents ---------- */
  const steps = [
    // Step 0 — Part A head + extract 1
    <section className={"step" + (currentStep === 0 ? " active" : "")} data-step={0} key={0}>
      <PartHead eyebrow={meta.aEyebrow} title={PART_TITLES.A} brief={partABrief} />
      {extA[0] ? (
        <ExtractCard extract={extA[0]} answers={answers} onChange={setAnswer} />
      ) : null}
    </section>,
    // Step 1 — Part A extract 2 + end band
    <section className={"step" + (currentStep === 1 ? " active" : "")} data-step={1} key={1}>
      {extA[1] ? (
        <ExtractCard extract={extA[1]} answers={answers} onChange={setAnswer} />
      ) : null}
      <p className="end-band">That is the end of Part A. Now look at Part B.</p>
    </section>,
    // Step 2 — Part B
    <section className={"step" + (currentStep === 2 ? " active" : "")} data-step={2} key={2}>
      <PartHead eyebrow={meta.bEyebrow} title={PART_TITLES.B} brief={partBBrief} />
      {content.partB.items.map((item: OetListeningPartBItem) => (
        <McqBlock
          key={item.n}
          n={item.n}
          stemHtml={
            item.contextHtml ? `${item.contextHtml} ${item.prompt}` : item.prompt
          }
          options={item.options}
          value={answers[String(item.n)]}
          onPick={setAnswer}
        />
      ))}
      <p className="end-band">That is the end of Part B. Now look at Part C.</p>
    </section>,
    // Step 3 — Part C head + extract 1
    <section className={"step" + (currentStep === 3 ? " active" : "")} data-step={3} key={3}>
      <PartHead eyebrow={meta.cEyebrow} title={PART_TITLES.C} brief={partCBrief} />
      {extC[0] ? <PartCSub extract={extC[0]} /> : null}
      {(extC[0]?.questions ?? []).map((q: OetMcqQuestion) => (
        <McqBlock
          key={q.n}
          n={q.n}
          stemHtml={q.prompt}
          options={q.options}
          value={answers[String(q.n)]}
          onPick={setAnswer}
        />
      ))}
    </section>,
    // Step 4 — Part C extract 2 + end band
    <section className={"step" + (currentStep === 4 ? " active" : "")} data-step={4} key={4}>
      {extC[1] ? <PartCSub extract={extC[1]} /> : null}
      {(extC[1]?.questions ?? []).map((q: OetMcqQuestion) => (
        <McqBlock
          key={q.n}
          n={q.n}
          stemHtml={q.prompt}
          options={q.options}
          value={answers[String(q.n)]}
          onPick={setAnswer}
        />
      ))}
      <p className="end-band">That is the end of Part C.</p>
    </section>,
  ];

  return (
    <div className="oet-listening">
      {/* ================= COVER ================= */}
      <section id="cover" style={{ display: started ? "none" : undefined }}>
        <div>
          <div className="logo-badge">
            <img src="/images/logo-oet-hq.png" alt="OET HQ" className="brand-logo-img" />
          </div>
          <div className="cover-rule" />
          <div className="cover-eyebrow">Occupational English Test · Practice</div>
          <h1 className="cover-title serif">{content.title}</h1>
          <p className="cover-sub">
            {content.description ??
              "Complete Listening Sub-test · Parts A, B & C"}
          </p>
          <div className="cover-meta">
            <div className="meta-chip">
              <b>42</b> questions
            </div>
            <div className="meta-chip">
              <b>{totalMinutes}</b> minutes
            </div>
            <div className="meta-chip">
              Audio played <b>once only</b>
            </div>
            <div className="meta-chip">
              Score out of <b>500</b>
            </div>
          </div>
          <button className="btn-primary" onClick={startTest}>
            Begin the test
          </button>
        </div>
      </section>

      {/* ================= EXAM BAR ================= */}
      <header id="exambar" style={{ display: started ? "block" : "none" }}>
        <div className="inner">
          <div className="bar-logo">
            <img src="/images/logo-oet-hq.png" alt="OET HQ" className="bar-logo-img" />
          </div>
          <div className="bar-progress">
            <div className="label">
              <span>Progress</span>
              <span id="progText">{answered} / {TOTAL} answered</span>
            </div>
            <div className="track">
              <div
                className="fill"
                id="progFill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className={"bar-timer" + (timerLow ? " low" : "")} id="timer">
            {pad2(Math.floor(displayTime / 60))}:{pad2(displayTime % 60)}
          </div>
          <button
            className="btn-submit"
            onClick={trySubmit}
            disabled={submitting}
          >
            Submit answers
          </button>
        </div>
      </header>

      {/* ================= SESSION AUDIO ================= */}
      {started && audioUrl ? <SessionAudioPlayer src={audioUrl} /> : null}

      {/* ================= BRIEFING ================= */}
      {started && phase === "briefing" ? (
        <section id="briefing" className="briefing-wrap">
          <div className="briefing-card">
            <div className="briefing-eyebrow">Before you begin</div>
            <h2 className="briefing-title serif">How this listening test works</h2>
            <p className="briefing-lead">
              {audioUrl
                ? "Your recording is now playing and can be heard only once — it cannot be paused or rewound. Answer live as you listen."
                : "Answer live as you listen. The recording plays once only."}
            </p>
            <div className="briefing-parts">
              <div className="briefing-part">
                <span className="bp-badge">A</span>
                <div>
                  <div className="bp-h">Part A · Note completion</div>
                  <p>Two consultation extracts. <b>Type</b> the missing words into the notes for questions 1–24. Record the final, corrected version where a speaker changes their mind.</p>
                </div>
              </div>
              <div className="briefing-part">
                <span className="bp-badge">B</span>
                <div>
                  <div className="bp-h">Part B · Short workplace extracts</div>
                  <p>Six short extracts. <b>Select A, B or C</b> for questions 25–30 — the answer that fits best according to what you hear.</p>
                </div>
              </div>
              <div className="briefing-part">
                <span className="bp-badge">C</span>
                <div>
                  <div className="bp-h">Part C · Extended listening</div>
                  <p>Two longer extracts. <b>Select A, B or C</b> for questions 31–42.</p>
                </div>
              </div>
            </div>
            <div className="briefing-foot">
              <div className="briefing-note">
                When you finish, press <b>Submit answers</b> for your score out of 500 and grade prediction. The timer is already running.
              </div>
              <button className="btn-primary briefing-start" onClick={beginQuestions}>
                Start Part A&nbsp;→
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ================= TEST ================= */}
      <main id="test" style={{ display: started && phase === "questions" ? "block" : "none" }}>
        <div className="container" id="testBody">
          {steps}
          <div className="stepnav">
            <button
              className="nav-back"
              id="navBack"
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              ← Back
            </button>
            <div className="step-center">
              <div className="step-meta" id="stepMeta">
                Step {currentStep + 1} of {STEP_COUNT} — {meta.stepMeta[currentStep]}
              </div>
              <div className="step-dots" id="stepDots">
                {Array.from({ length: STEP_COUNT }).map((_, i) => (
                  <span
                    key={i}
                    className={
                      "dot" +
                      (i === currentStep ? " active" : "") +
                      (i < currentStep ? " done" : "")
                    }
                    data-d={i}
                  />
                ))}
              </div>
            </div>
            <button
              className={"nav-next" + (isLast ? " finish" : "")}
              id="navNext"
              onClick={isLast ? trySubmit : nextStep}
            >
              {isLast ? "Submit answers" : "Next →"}
            </button>
          </div>
        </div>
      </main>

      {/* ================= MODAL ================= */}
      <div
        id="modal"
        role="dialog"
        aria-modal="true"
        style={{ display: showModal ? "flex" : "none" }}
      >
        <div className="modal-card">
          <div className="modal-logo">
            <img src="/images/logo-oet-hq.png" alt="OET HQ" />
          </div>
          <h4 className="serif" id="modalTitle">
            Submit your answers?
          </h4>
          <p id="modalMsg">
            {answered < TOTAL
              ? `You have answered ${answered} of ${TOTAL} questions. Unanswered questions will be marked incorrect.`
              : `All ${TOTAL} questions answered. Ready to see your score?`}
          </p>
          <div className="modal-actions">
            <button
              className="btn-quiet"
              onClick={() => setShowModal(false)}
              disabled={submitting}
            >
              Keep working
            </button>
            <button
              className="btn-submit"
              onClick={doSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OetListeningExam;
