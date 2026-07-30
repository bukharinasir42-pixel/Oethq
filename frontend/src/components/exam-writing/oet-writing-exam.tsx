"use client";

/**
 * OetWritingExam — the premium OET Writing test surface. Case notes on the left,
 * a letter editor on the right, a single 45-minute countdown, and submit →
 * emails the letter to the profession's corrector and shows a confirmation with
 * the student's letter number + writing ID. Auto-submits at time-up.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { writingApi, type WritingCaseNote, type WritingSubmitResult } from "@/lib/writing-api";
import "./oet-writing-exam.css";

function fmt(s: number) {
  const m = Math.floor(Math.max(0, s) / 60);
  const x = Math.max(0, s) % 60;
  return `${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
}

export function OetWritingExam({ caseNote }: { caseNote: WritingCaseNote }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [letter, setLetter] = useState("");
  const [timeLeft, setTimeLeft] = useState(caseNote.timeLimitMin * 60);
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<WritingSubmitResult | null>(null);
  const submittedRef = useRef(false);
  const letterRef = useRef(letter);
  letterRef.current = letter;

  const words = useMemo(() => (letter.trim() ? letter.trim().split(/\s+/).filter(Boolean).length : 0), [letter]);

  const doSubmit = async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setModal(false);
    setSubmitting(true);
    try {
      const r = await writingApi.submit(caseNote.id, letterRef.current, auto);
      setResult(r);
      if (typeof window !== "undefined") window.scrollTo(0, 0);
    } catch (e) {
      submittedRef.current = false;
      alert(e instanceof Error ? e.message : "Could not submit your letter");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!started || result) return;
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [started, result]);

  useEffect(() => {
    if (started && !result && timeLeft <= 0 && !submittedRef.current) void doSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, started, result]);

  const timerCls = "w-timer" + (timeLeft <= 60 ? " danger" : timeLeft <= 300 ? " warn" : "");

  // ---------------- result ----------------
  if (result) {
    return (
      <div className="oet-writing">
        <div className="w-done-wrap">
          <div className="w-done">
            <div className="w-done-ico"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></div>
            <h1>Letter submitted for correction</h1>
            <p>Your letter has been sent to our correction team. You&apos;ll receive your marked feedback by email.</p>
            <div className="w-done-grid">
              <div><b>{result.studentCode}</b><span>Your writing ID</span></div>
              <div><b>#{result.letterNumber}</b><span>Letter number</span></div>
              <div><b>{result.wordCount}</b><span>Words</span></div>
            </div>
            <div className="w-done-actions">
              <button className="w-btn w-btn-primary" onClick={() => router.push("/portal/writing")}>Back to Writing library</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- cover ----------------
  if (!started) {
    return (
      <div className="oet-writing">
        <div className="w-cover-wrap">
          <div className="w-cover">
            <div className="w-cover-logo"><img src="/images/logo-oet-hq.png" alt="OET HQ" /></div>
            <div className="w-eyebrow">OET Writing · {caseNote.profession}</div>
            <h1>{caseNote.title}</h1>
            <p className="w-cover-sub">Read the case notes, then write your letter. You have {caseNote.timeLimitMin} minutes and the clock starts as soon as you begin.</p>
            <div className="w-cover-meta">
              <div className="w-chip"><b>{caseNote.timeLimitMin} min</b><span>Countdown</span></div>
              <div className="w-chip"><b>{caseNote.wordGuidance || "180–200"}</b><span>Words</span></div>
              <div className="w-chip"><b>Emailed</b><span>To your corrector</span></div>
            </div>
            <p className="w-cover-note">Once you submit — or the timer runs out — your letter is sent for correction and cannot be changed. Set aside {caseNote.timeLimitMin} uninterrupted minutes.</p>
            <button className="w-btn w-btn-primary w-cover-start" onClick={() => { setStarted(true); window.scrollTo(0, 0); }}>Begin the {caseNote.timeLimitMin}-minute test</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- exam ----------------
  return (
    <div className="oet-writing">
      <header className="w-topbar">
        <div className="w-brand">
          <div className="w-logo-chip"><img src="/images/logo-oet-hq.png" alt="OET HQ" /></div>
          <div className="w-titles"><span className="k">Writing Test</span><span className="t">Occupational English Test</span></div>
        </div>
        <div className="w-tb-right">
          <span className="w-wordpill"><b>{words}</b> words</span>
          <div className={timerCls}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg><span className="tv">{fmt(timeLeft)}</span></div>
          <button className="w-btn w-btn-primary w-submit" onClick={() => setModal(true)} disabled={submitting}>Submit letter</button>
        </div>
      </header>

      <div className="w-body">
        <div className="w-pane w-pane-notes">
          <div className="w-notes">
            <div className="w-eyebrow">Case notes</div>
            <h2>{caseNote.title}</h2>
            {caseNote.scenario ? <div className="w-scenario" dangerouslySetInnerHTML={{ __html: caseNote.scenario }} /> : null}
            <div className="w-notes-body" dangerouslySetInnerHTML={{ __html: caseNote.caseNotesHtml }} />
          </div>
        </div>
        <div className="w-pane w-pane-write">
          <div className="w-write">
            <div className="w-write-head">
              <div><div className="w-eyebrow">Your letter</div><p>Write {caseNote.wordGuidance || "180–200"} words. {caseNote.timeLimitMin} minutes total.</p></div>
              <span className="w-wordcount">{words} words</span>
            </div>
            <textarea
              className="w-editor"
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              placeholder="Dear …,&#10;&#10;I am writing to refer …"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {modal ? (
        <div className="w-overlay">
          <div className="w-modal">
            <div className="w-modal-logo"><img src="/images/logo-oet-hq.png" alt="OET HQ" /></div>
            <h3>Submit your letter?</h3>
            <p>This sends your letter for correction and ends the test. You cannot make changes after submitting.</p>
            <div className="w-modal-info">{words} words written{words < 100 ? " — that looks short for an OET letter." : ""}</div>
            <div className="w-modal-actions">
              <button className="w-btn w-btn-quiet" onClick={() => setModal(false)}>Keep writing</button>
              <button className="w-btn w-btn-primary" onClick={() => void doSubmit(false)} disabled={submitting}>{submitting ? "Submitting…" : "Submit for correction"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
