"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  OetReadingImport,
  OetReadingPartA,
  OetReadingPartCText,
  OetTextBlock,
  OetLetterMatchQuestion,
  OetFillBlankQuestion,
} from "@/lib/oet-test-schema";
import type { OetReadingExamProps } from "../oet-exam-types";
import {
  clearRegion, HL_REGION_ATTR, useCopyProtection, useHighlighting
} from "./exam-highlighting";
import "./oet-reading-exam.css";

/* ------------------------------------------------------------------ icons */

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2M9 2h6" />
  </svg>
);
const ClockPlainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4M9 2h6" />
  </svg>
);
const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </svg>
);
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flex: "0 0 auto" }}>
    <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);
const HighlighterIcon = () => (
  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l-4 4v4h4l4-4M13 7l4 4M15 5l4 4-8 8" />
  </svg>
);

/* ------------------------------------------------------------------ helpers */

const nonEmpty = (v: string | undefined): boolean => v !== undefined && String(v).trim() !== "";

const fmt = (s: number): string => {
  const m = Math.floor(s / 60);
  const x = s % 60;
  return String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0");
};

const qRange = (nums: number[]): string => {
  if (nums.length === 0) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? String(min) : `${min}–${max}`;
};

/* ---- passage HTML builders (static per content — fed to memoized panes) ---- */

/**
 * Render one text's blocks.
 *
 * Part A is a scanning task, and structure is what a student scans. A list of
 * four contraindications rendered as one paragraph of prose is measurably
 * harder to scan than the real paper, so headings, lists and callouts are
 * rendered as headings, lists and callouts. No wording is altered anywhere —
 * this only restores the shape the source document already had.
 */
function buildBlocksHtml(blocks: OetTextBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "p") return `<p>${b.html}</p>`;

      if (b.type === "heading") return `<h3 class="pa-sub">${b.text}</h3>`;

      if (b.type === "list") {
        const tag = b.ordered ? "ol" : "ul";
        const items = b.items.map((i) => `<li>${i}</li>`).join("");
        return `<${tag} class="pa-list${b.ordered ? " ord" : ""}">${items}</${tag}>`;
      }

      if (b.type === "note") {
        return `<div class="pa-note">${b.label ? `<span class="pa-note-label">${b.label}</span>` : ""}<div class="pa-note-body">${b.html}</div></div>`;
      }

      const head = b.head.map((h) => `<th>${h}</th>`).join("");
      const rows = b.rows
        .map(
          (r) =>
            `<tr>${r.map((c, ci) => `<td${ci === 0 ? ' class="rh"' : ""}>${c}</td>`).join("")}</tr>`
        )
        .join("");
      return `<div class="pa-table-wrap"><table class="pa-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    .join("");
}

/**
 * Part A passage HTML.
 *
 * `onlyIndex` renders a single text instead of all four — used on phones and
 * tablets, where the four texts are behind A/B/C/D tabs so the student is not
 * scrolling past three irrelevant texts to reach the one they need.
 */
function buildPartAHtml(partA: OetReadingPartA, onlyIndex: number | null = null): string {
  const source = onlyIndex == null ? partA.texts : partA.texts.slice(onlyIndex, onlyIndex + 1);
  const texts = source
    .map(
      (t) =>
        `<div class="abcd-block"><div class="abcd-head"><div class="lt">${t.letter}</div><div class="abcd-htext"><div class="lb">Text ${t.letter}</div>${
          t.title ? `<div class="pa-title">${t.title}</div>` : ""
        }</div></div>${buildBlocksHtml(t.blocks)}</div>`
    )
    .join("");
  const sub =
    onlyIndex == null
      ? `<div class="wc">Four texts · find the relevant information for each question</div>`
      : "";
  return `<div class="passage multi"><div class="eyebrow">Part A · Texts A–D</div><h1>${
    partA.topic || "Part A"
  }</h1>${sub}${texts}</div>`;
}

function buildPartCHtml(t: OetReadingPartCText, index: number): string {
  const range = qRange(t.questions.map((q) => q.n));
  const paras = t.paras
    .map((p) => `<p>${p}</p>`)
    .join("");
  const wc = t.wordCount ? `${t.wordCount} words · ` : "";
  return `<div class="passage"><div class="eyebrow">Part C · Text ${index + 1} · ${range}</div><h1>${t.title}</h1><div class="wc">${wc}read the passage, then answer on the right</div>${paras}</div>`;
}

/* ------------------------------------------------------------------ highlighting */

type PassageProps = { html: string; regionKey: string; paneId: string; paneClassName: string };

/**
 * A reading pane the student can mark up. Memoized on its (stable) props so
 * answer-state re-renders of the parent never touch this subtree — the <mark>
 * nodes injected by hand would not survive React reconciliation otherwise.
 *
 * The marking itself is handled centrally by useHighlighting on the exam root;
 * this only declares the region and offers the clear button.
 */
const HighlightablePassage = React.memo(function HighlightablePassage({
  html,
  regionKey,
  paneId,
  paneClassName,
}: PassageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={paneClassName} id={paneId}>
      <div className="hl-tools">
        <button
          type="button"
          className="hl-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => contentRef.current && clearRegion(contentRef.current)}
        >
          <HighlighterIcon /> Clear highlights
        </button>
      </div>
      <div
        ref={contentRef}
        {...{ [HL_REGION_ATTR]: regionKey }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
});

const HL_STYLE = `
.oet-reading mark.oet-hl{background:#fde68a;color:inherit;border-radius:2px;padding:0 1px;cursor:pointer;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.oet-reading .hl-tools{position:sticky;top:0;z-index:3;display:flex;justify-content:flex-end;padding:8px 12px 0;height:0;overflow:visible;pointer-events:none}
.oet-reading .hl-clear{pointer-events:auto;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--blue-2);background:var(--sky);border:1px solid var(--sky-2);padding:5px 10px;border-radius:8px;box-shadow:0 1px 3px rgba(13,42,94,.08)}
.oet-reading .hl-clear:hover{background:var(--sky-2)}
/* Marking is a drag, so the browser's own drag-to-move-text would fight it. */
.oet-reading [data-hl-region]{-webkit-user-drag:none}
`;

/* ------------------------------------------------------------------ modal */

type ModalState = {
  title: string;
  msg: React.ReactNode;
  warn?: React.ReactNode;
  confirm: string;
  cancel: string;
  hideCancel?: boolean;
  onConfirm: () => void;
};

type PartAGroup = {
  label: string;
  items: (OetLetterMatchQuestion | OetFillBlankQuestion)[];
};

type Stage = "intro" | "partA" | "bc";

/* ------------------------------------------------------------------ component */

/**
 * True on phones and tablets (the stacked two-pane layout). Desktop keeps the
 * side-by-side view, so the tabs and the drag handle stay out of its way.
 * Starts false and resolves on mount — the exam only renders client-side.
 */
function useIsNarrow(maxWidth = 960): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${maxWidth}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [maxWidth]);
  return narrow;
}

/** Drag handle between the stacked panes. Pointer events cover mouse and touch. */
function PaneResizer({ onResize }: { onResize: (clientY: number, container: HTMLElement) => void }) {
  return (
    <div
      className="pane-resizer"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Drag to resize the text and question panes"
      onPointerDown={(e) => {
        const handle = e.currentTarget;
        const container = handle.parentElement;
        if (!container) return;
        handle.setPointerCapture(e.pointerId);
        handle.classList.add("dragging");
        const move = (ev: PointerEvent) => onResize(ev.clientY, container);
        const up = () => {
          handle.classList.remove("dragging");
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
      }}
    >
      <span className="grip" aria-hidden />
    </div>
  );
}

export function OetReadingExam({
  content,
  initialAnswers,
  onAnswersChange,
  onSubmit,
  submitting,
  highlightKey = null,
}: OetReadingExamProps) {
  /**
   * The whole exam is one protected surface: text can be marked anywhere the
   * student reads, and can leave by none of the usual routes.
   */
  const examRef = useRef<HTMLDivElement>(null);
  useCopyProtection(examRef);
  const partAMinutes = content.timing.partAMinutes ?? 15;
  const partBCMinutes = content.timing.partBCMinutes ?? 45;
  const A_TIME = partAMinutes * 60;
  const BC_TIME = partBCMinutes * 60;

  const [answers, setAnswers] = useState<Record<string, string>>({ ...initialAnswers });
  const answersRef = useRef<Record<string, string>>({ ...initialAnswers });

  const [stage, setStage] = useState<Stage>("intro");
  const [bcTab, setBcTab] = useState<number>(0); // 0 Part B, 1 Part C text 1, 2 Part C text 2
  // Narrow screens only: which Part A text (A–D) is on show, and how the two
  // stacked panes divide the height. Percent of the split container.
  const isNarrow = useIsNarrow();
  const [paTab, setPaTab] = useState<number>(0);
  // Re-run whenever a pane mounts or unmounts: moving between Part A, Part B and
  // the two Part C texts swaps whole regions in and out, and each one that comes
  // back has to be restored from what the student had marked on it before.
  useHighlighting(examRef, highlightKey, [stage, bcTab, paTab, isNarrow]);
  const [splitPct, setSplitPct] = useState<number>(46);
  const resizeSplit = useCallback((clientY: number, container: HTMLElement) => {
    const box = container.getBoundingClientRect();
    if (box.height <= 0) return;
    const pct = ((clientY - box.top) / box.height) * 100;
    // Keep both panes usable — neither can be squeezed below a fifth.
    setSplitPct(Math.min(80, Math.max(20, pct)));
  }, []);
  const [aTimeLeft, setATimeLeft] = useState<number>(A_TIME);
  const [bcTimeLeft, setBcTimeLeft] = useState<number>(BC_TIME);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [aLocked, setALocked] = useState<boolean>(false);

  const submittedRef = useRef<boolean>(false);

  /* ---- answer commit ---- */
  const commit = (next: Record<string, string>) => {
    answersRef.current = next;
    setAnswers(next);
    onAnswersChange(next);
  };
  const setAnswer = (n: number, value: string) => {
    const key = String(n);
    const next = { ...answersRef.current };
    if (value.trim() === "") delete next[key];
    else next[key] = value;
    commit(next);
  };

  /* ---- derived question sets ---- */
  const partAQuestions = useMemo(
    () => [...content.partA.questions].sort((a, b) => a.n - b.n),
    [content]
  );
  const partANums = useMemo(() => partAQuestions.map((q) => q.n), [partAQuestions]);
  const partBItems = content.partB.items;
  const partBNums = useMemo(() => partBItems.map((i) => i.n), [partBItems]);
  const partCTexts = content.partC.texts;
  const c1Nums = useMemo(
    () => (partCTexts[0]?.questions ?? []).map((q) => q.n),
    [partCTexts]
  );
  const c2Nums = useMemo(
    () => (partCTexts[1]?.questions ?? []).map((q) => q.n),
    [partCTexts]
  );

  const partAGroups = useMemo<PartAGroup[]>(() => {
    const raw: { type: "match" | "fill"; items: (OetLetterMatchQuestion | OetFillBlankQuestion)[] }[] = [];
    for (const q of partAQuestions) {
      const t: "match" | "fill" = q.type === "letter_match" ? "match" : "fill";
      const last = raw[raw.length - 1];
      if (last && last.type === t) last.items.push(q);
      else raw.push({ type: t, items: [q] });
    }
    return raw.map((g) => {
      const from = g.items[0].n;
      const to = g.items[g.items.length - 1].n;
      const range = from === to ? `Question ${from}` : `Questions ${from}–${to}`;
      const label =
        g.type === "match"
          ? `${range} · Which text (A, B, C or D)?`
          : `${range} · Answer with a word or short phrase`;
      return { label, items: g.items };
    });
  }, [partAQuestions]);

  /* ---- passage HTML (static) ---- */
  const partAHtml = useMemo(
    () => buildPartAHtml(content.partA, isNarrow ? paTab : null),
    [content, isNarrow, paTab]
  );
  const partCHtml = useMemo(
    () => partCTexts.map((t, i) => buildPartCHtml(t, i)),
    [partCTexts]
  );

  /* ---- counts ---- */
  const countIn = (nums: number[]): number =>
    nums.reduce((acc, n) => acc + (nonEmpty(answers[String(n)]) ? 1 : 0), 0);
  const aCount = countIn(partANums);
  const bCount = countIn(partBNums);
  const c1Count = countIn(c1Nums);
  const c2Count = countIn(c2Nums);
  const bcTotalAnswered = bCount + c1Count + c2Count;
  const bcTotal = partBNums.length + c1Nums.length + c2Nums.length;

  /* ---- timer ticking ---- */
  useEffect(() => {
    if (stage !== "partA" && stage !== "bc") return;
    const id = window.setInterval(() => {
      if (stage === "partA") setATimeLeft((p) => Math.max(0, p - 1));
      else setBcTimeLeft((p) => Math.max(0, p - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  const goToBC = () => {
    setALocked(true);
    setStage("bc");
    setBcTab(0);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  const doSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(answersRef.current);
  };

  /* ---- timer expiry ---- */
  useEffect(() => {
    if (stage === "partA" && aTimeLeft <= 0 && !aLocked) {
      setModal({
        title: "Part A time is up",
        msg: "Your time for Part A has ended. Parts B and C will now begin with a fresh timer.",
        confirm: "Continue to Parts B & C",
        cancel: "Continue",
        hideCancel: true,
        onConfirm: goToBC,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aTimeLeft, stage, aLocked]);

  useEffect(() => {
    if (stage === "bc" && bcTimeLeft <= 0) doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bcTimeLeft, stage]);

  /* ---- stage transitions ---- */
  const startPartA = () => {
    setStage("partA");
    setALocked(false);
    setATimeLeft(A_TIME);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  const askFinishA = () => {
    const remaining = partANums.length - aCount;
    setModal({
      title: "Finish Part A?",
      msg: (
        <>
          Part A will close and you will move on to Parts B and C.{" "}
          <b>You cannot return to Part A.</b>
        </>
      ),
      warn:
        remaining > 0 ? (
          <>
            <WarnIcon /> {remaining} of {partANums.length} Part A questions still unanswered
          </>
        ) : undefined,
      confirm: "Finish Part A",
      cancel: "Keep working",
      onConfirm: goToBC,
    });
  };

  const askSubmit = () => {
    const unanswered = partANums.length - aCount + (bcTotal - bcTotalAnswered);
    setModal({
      title: "Submit your test?",
      msg: "This ends Parts B and C and marks the whole paper. Once you submit, you cannot change any answers.",
      warn:
        unanswered > 0 ? (
          <>
            <WarnIcon /> {unanswered} question{unanswered > 1 ? "s" : ""} unanswered across the paper
          </>
        ) : undefined,
      confirm: "Submit test",
      cancel: "Keep working",
      onConfirm: doSubmit,
    });
  };

  /* ---- timer paint ---- */
  const timerLeft = stage === "partA" ? aTimeLeft : stage === "bc" ? bcTimeLeft : null;
  const timerWarnAt = stage === "partA" ? 120 : 300;
  let timerCls = "timer";
  if (timerLeft === null) timerCls += " hidden";
  else if (timerLeft <= 30) timerCls += " danger";
  else if (timerLeft <= timerWarnAt) timerCls += " warn";

  const stagePill =
    stage === "partA" ? (
      <>
        <b>Part A</b> &middot; {partAMinutes} min
      </>
    ) : stage === "bc" ? (
      <>
        <b>Parts B &amp; C</b> &middot; {partBCMinutes} min
      </>
    ) : (
      <>Not started</>
    );

  /* ---- BC tab meta ---- */
  const bcTitle =
    bcTab === 0 ? (
      <>
        Part B <span>&middot;</span> Workplace extracts
      </>
    ) : (
      <>
        Part C <span>&middot;</span> {partCTexts[bcTab - 1]?.title.split("—")[0].trim()}
      </>
    );

  const tabs = [
    { i: 0, label: `Part B · ${qRange(partBNums)}`, done: partBNums.length > 0 && bCount === partBNums.length },
    { i: 1, label: "Part C · Text 1", done: c1Nums.length > 0 && c1Count === c1Nums.length },
    { i: 2, label: "Part C · Text 2", done: c2Nums.length > 0 && c2Count === c2Nums.length },
  ];

  /* ---------------------------------------------------------------- render */
  return (
    <div className="oet-reading" ref={examRef}>
      <style dangerouslySetInnerHTML={{ __html: HL_STYLE }} />
      <div id="app">
        {/* top bar */}
        <header className="topbar">
          <div className="brand">
            <div className="logo-chip">
              <img src="/images/logo-oet-hq.png" alt="OET HQ" />
            </div>
            <div className="sep" />
            <div className="titles">
              <span className="k">Reading Test</span>
              <span className="t">Occupational English Test</span>
            </div>
          </div>
          <div className="tb-right">
            <div className="stagepill" id="stagePill">
              <span id="stagePillText">{stagePill}</span>
            </div>
            <div className={timerCls} id="timer">
              <ClockIcon />
              <span className="tv" id="timerVal">
                {fmt(timerLeft ?? A_TIME)}
              </span>
            </div>
          </div>
        </header>

        {/* INTRO */}
        <section className={`screen${stage === "intro" ? " active" : ""}`} id="screenIntro">
          <div className="cover-wrap">
            <div className="cover">
              <div className="cover-head">
                <div className="cover-logo">
                  <img src="/images/logo-oet-hq.png" alt="OET HQ" />
                </div>
                <h1>{content.title || "Reading Test"}</h1>
                <p className="sub" id="coverSub">
                  Full paper &middot; Parts A, B &amp; C &middot; 42 questions
                </p>
              </div>
              <div className="cover-body">
                <div className="parts-grid">
                  <div className="part-card">
                    <span className="pc-badge">PART A</span>
                    <h3>Expeditious reading</h3>
                    <p>Four short texts on one clinical topic. Skim and scan for specific information.</p>
                    <div className="pc-time">
                      <ClockPlainIcon />
                      {partAMinutes} minutes &middot; {partANums.length} questions
                    </div>
                  </div>
                  <div className="part-card together">
                    <span className="pc-badge">PARTS B &amp; C</span>
                    <h3>Careful reading &middot; one shared {partBCMinutes}-minute timer</h3>
                    <div className="inner2" style={{ marginTop: 10 }}>
                      <p>
                        <b style={{ color: "var(--navy)" }}>Part B</b> &mdash; six workplace extracts, one question each ({partBNums.length}).
                      </p>
                      <p>
                        <b style={{ color: "var(--navy)" }}>Part C</b> &mdash; two long texts, eight questions each ({c1Nums.length + c2Nums.length}).
                      </p>
                    </div>
                    <div className="pc-time">
                      <ClockPlainIcon />
                      {partBCMinutes} minutes &middot; {bcTotal} questions &middot; move freely between B and C
                    </div>
                  </div>
                </div>
                <div className="scorebanner">
                  <div className="ic">
                    <ChartIcon />
                  </div>
                  <div className="tx">
                    All 42 marks are combined and scored with a <b>Rasch-based equating model</b> onto the{" "}
                    <b>OET 0&ndash;500 scale</b> with A / B / C+ grade bands, so the harder careful-reading items are
                    weighted against the faster Part A items automatically.
                  </div>
                </div>
                <div className="instr">
                  <h2>How the test runs</h2>
                  <ul>
                    <li>
                      <span className="dot">1</span>
                      <div>
                        <b>Part A first, on its own {partAMinutes}-minute timer.</b> When the time runs out, or when you
                        select <b>Finish Part A</b>, the paper moves on and you cannot return.
                      </div>
                    </li>
                    <li>
                      <span className="dot">2</span>
                      <div>
                        <b>Parts B and C share a single {partBCMinutes}-minute timer.</b> Use the tabs to move between
                        Part B and the two Part C texts in whatever order you prefer.
                      </div>
                    </li>
                    <li>
                      <span className="dot">3</span>
                      <div>
                        Part A answers are typed or selected; Parts B and C are multiple choice. Typed answers are
                        marked flexibly on meaning, not exact wording.
                      </div>
                    </li>
                    <li>
                      <span className="dot">4</span>
                      <div>
                        Each timer submits automatically at zero. Select <b>Submit test</b> after Part C to see your
                        scaled score, grade and full review.
                      </div>
                    </li>
                  </ul>
                </div>
                <div className="cover-cta">
                  <p className="cover-note">
                    Once you begin, Part A&rsquo;s timer starts immediately and cannot be paused. Set aside about an hour
                    to work without interruption.
                  </p>
                  <button className="btn btn-primary" id="startBtn" onClick={startPartA}>
                    Start Part A
                    <ArrowRight />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PART A */}
        <section className={`screen${stage === "partA" ? " active" : ""}`} id="screenA">
          <div className="subbar">
            <div className="part">
              <span className="badge">PART A</span>
              <span className="txt-title">
                {content.partA.topic} <span>&middot;</span> Texts A&ndash;D
              </span>
            </div>
            {/* Hidden on phones (see .subbar-note in the stylesheet): the same
                instruction is repeated in the question pane's header, and on a
                narrow screen it wrapped the sub-bar onto a third line. */}
            <div className="subbar-note">Answers must come only from Texts A&ndash;D</div>
          </div>
          {/* Narrow screens: A/B/C/D tabs pick which text is showing, and the
              handle below the text pane lets the student resize the two panes.
              Both are hidden on desktop, which keeps the side-by-side view. */}
          {isNarrow ? (
            <div className="pa-textbar" role="tablist" aria-label="Part A texts">
              {content.partA.texts.map((t, i) => (
                <button
                  key={t.letter}
                  type="button"
                  role="tab"
                  aria-selected={paTab === i}
                  className={`pa-texttab${paTab === i ? " active" : ""}`}
                  onClick={() => setPaTab(i)}
                >
                  Text {t.letter}
                </button>
              ))}
            </div>
          ) : null}
          <div className="body-split" style={isNarrow ? ({ "--pane-split": `${splitPct}%` } as React.CSSProperties) : undefined}>
            <HighlightablePassage
              html={partAHtml}
              regionKey="A-text"
              paneId="paneAText"
              paneClassName="pane pane-text"
            />
            <PaneResizer onResize={resizeSplit} />
            <div className="pane pane-q" id="paneAQ" data-hl-region="A-questions">
              <div className="qwrap">
                <div className="qhead">
                  <div className="k">Part A</div>
                  <div className="t">Questions {qRange(partANums)}</div>
                  <div className="d">
                    Take your answers only from Texts A&ndash;D. Spelling should be accurate.
                  </div>
                </div>
                {partAGroups.map((g, gi) => (
                  <React.Fragment key={gi}>
                    <div className="qgroup-label">
                      {g.label}
                      <span className="ln" />
                    </div>
                    {g.items.map((q) => {
                      const val = answers[String(q.n)];
                      const answered = nonEmpty(val);
                      return (
                        <div className={`qcard${answered ? " answered" : ""}`} key={q.n} data-qc={q.n}>
                          <div className="qnum">
                            <span className="b">{q.n}</span>
                            <div className="qtext" dangerouslySetInnerHTML={{ __html: q.prompt }} />
                          </div>
                          {q.type === "letter_match" ? (
                            <div className="letters">
                              {(["A", "B", "C", "D"] as const).map((L) => (
                                <button
                                  key={L}
                                  type="button"
                                  className={`letter-btn${val === L ? " sel" : ""}`}
                                  data-hl-answer
                                  onClick={() => setAnswer(q.n, L)}
                                >
                                  {L}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input
                              className="ans-input"
                              type="text"
                              autoComplete="off"
                              spellCheck={false}
                              placeholder="Type your answer"
                              value={val ?? ""}
                              onChange={(e) => setAnswer(q.n, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <footer className="footerbar">
            <div className="tally">
              <span>
                Part A answered <b id="aCount">{aCount}</b> / {partANums.length}
              </span>
            </div>
            <div className="footer-actions">
              <button className="btn btn-primary" id="finishABtn" onClick={askFinishA}>
                Finish Part A
                <ArrowRight />
              </button>
            </div>
          </footer>
        </section>

        {/* PARTS B & C */}
        <section className={`screen${stage === "bc" ? " active" : ""}`} id="screenBC">
          <div className="subbar">
            <div className="part">
              <span className="badge">PARTS B &amp; C</span>
              <span className="txt-title" id="bcTitle">
                {bcTitle}
              </span>
            </div>
            <div className="tabs" id="bcTabs">
              {tabs.map((t) => {
                const isActive = bcTab === t.i;
                const showDone = t.done && !isActive;
                return (
                  <button
                    key={t.i}
                    type="button"
                    className={`tab${isActive ? " active" : ""}${showDone ? " done" : ""}`}
                    onClick={() => setBcTab(t.i)}
                  >
                    <span className="n">{showDone ? "✓" : t.i === 0 ? "B" : t.i}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div id="bcContent">
            {bcTab === 0 ? (
              <div className="body-single">
                <div className="pb-wrap" data-hl-region="B">
                  <div className="qhead" style={{ maxWidth: 820, margin: "0 auto 4px" }}>
                    <div className="k">Part B</div>
                    <div className="t" style={{ fontSize: 21, fontWeight: 800, color: "var(--navy)" }}>
                      Questions {qRange(partBNums)}
                    </div>
                    <div className="d" style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                      Read each workplace extract and choose the answer (A, B or C) that fits best.
                    </div>
                  </div>
                  {partBItems.map((it) => {
                    const val = answers[String(it.n)];
                    const answered = nonEmpty(val);
                    return (
                      <div className={`pb-item${answered ? " answered" : ""}`} key={it.n} data-pb={it.n}>
                        <div className="pb-doc">
                          {it.kind ? <span className="doc-kind">{it.kind}</span> : null}
                          {it.docTitle ? <div className="doc-title">{it.docTitle}</div> : null}
                          <div className="doc-body" dangerouslySetInnerHTML={{ __html: it.docHtml }} />
                        </div>
                        <div className="pb-q">
                          <div className="pbq-head">
                            <span className="b">{it.n}</span>
                            <div className="pbq-q" dangerouslySetInnerHTML={{ __html: it.prompt }} />
                          </div>
                          <div className="opts">
                            {Object.keys(it.options).map((L) => (
                              <div
                                key={L}
                                className={`opt${val === L ? " sel" : ""}`}
                                data-hl-answer
                                onClick={() => setAnswer(it.n, L)}
                              >
                                <span className="mk">{L}</span>
                                <span className="ol" dangerouslySetInnerHTML={{ __html: it.options[L] }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              (() => {
                const ti = bcTab - 1;
                const T = partCTexts[ti];
                if (!T) return null;
                return (
                  <div className="body-split" style={isNarrow ? ({ "--pane-split": `${splitPct}%` } as React.CSSProperties) : undefined}>
                    <HighlightablePassage
                      html={partCHtml[ti]}
                      regionKey={`C${ti}-text`}
                      paneId={`paneCText${ti}`}
                      paneClassName="pane pane-text"
                    />
                    {/* Required, not optional: on narrow screens .body-split is a
                        three-row grid (text / handle / questions). Without this the
                        question pane drops into the handle's row and is 14px tall. */}
                    <PaneResizer onResize={resizeSplit} />
                    <div className="pane pane-q" data-hl-region={`C${ti}-questions`}>
                      <div className="qwrap">
                        <div className="qhead">
                          <div className="k">Part C &middot; Text {ti + 1}</div>
                          <div className="t">Questions {qRange(T.questions.map((q) => q.n))}</div>
                          <div className="d">Choose the answer (A, B, C or D) that best answers each question.</div>
                        </div>
                        {T.questions.map((q) => {
                          const val = answers[String(q.n)];
                          const answered = nonEmpty(val);
                          return (
                            <div className={`qcard${answered ? " answered" : ""}`} key={q.n} data-qc={q.n}>
                              <div className="qnum">
                                <span className="b">{q.n}</span>
                                <div className="qtext" dangerouslySetInnerHTML={{ __html: q.prompt }} />
                              </div>
                              <div className="opts">
                                {Object.keys(q.options).map((L) => (
                                  <div
                                    key={L}
                                    className={`opt${val === L ? " sel" : ""}`}
                                    data-hl-answer
                                    onClick={() => setAnswer(q.n, L)}
                                  >
                                    <span className="mk">{L}</span>
                                    <span className="ol" dangerouslySetInnerHTML={{ __html: q.options[L] }} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          <footer className="footerbar">
            <div className="tally">
              <span className={`seg${bCount === partBNums.length && partBNums.length > 0 ? " on" : ""}`} id="segB">
                <span className="dotp" /> Part B <b id="bCount">{bCount}</b>/{partBNums.length}
              </span>
              <span className={`seg${c1Count === c1Nums.length && c1Nums.length > 0 ? " on" : ""}`} id="segC1">
                <span className="dotp" /> Text 1 <b id="c1Count">{c1Count}</b>/{c1Nums.length}
              </span>
              <span className={`seg${c2Count === c2Nums.length && c2Nums.length > 0 ? " on" : ""}`} id="segC2">
                <span className="dotp" /> Text 2 <b id="c2Count">{c2Count}</b>/{c2Nums.length}
              </span>
              <span>
                &middot; total <b id="bcCount">{bcTotalAnswered}</b>/{bcTotal}
              </span>
            </div>
            <div className="footer-actions" id="bcActions">
              {bcTab > 0 ? (
                <button className="btn btn-ghost" onClick={() => setBcTab(bcTab - 1)}>
                  <ArrowLeft />
                  Back
                </button>
              ) : null}
              {bcTab < 2 ? (
                <button className="btn btn-primary" onClick={() => setBcTab(bcTab + 1)}>
                  {bcTab === 0 ? "Go to Part C" : "Next text"}
                  <ArrowRight />
                </button>
              ) : (
                <button className="btn btn-primary" id="submitBtn" onClick={askSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit test"}
                  {submitting ? null : <CheckIcon />}
                </button>
              )}
            </div>
          </footer>
        </section>
      </div>

      {/* MODAL */}
      <div className={`overlay${modal ? " show" : ""}`} id="overlay">
        {modal ? (
          <div className="modal">
            <div className="modal-logo" id="modalIc">
              <img src="/images/logo-oet-hq.png" alt="OET HQ" />
            </div>
            <h3 id="modalTitle">{modal.title}</h3>
            <p id="modalMsg">{modal.msg}</p>
            {modal.warn ? (
              <div className="warnrow" id="modalWarn" style={{ display: "flex" }}>
                {modal.warn}
              </div>
            ) : null}
            <div className="modal-actions">
              {modal.hideCancel ? null : (
                <button className="btn btn-ghost" id="modalCancel" onClick={() => setModal(null)}>
                  {modal.cancel}
                </button>
              )}
              <button
                className="btn btn-primary"
                id="modalConfirm"
                onClick={() => {
                  const cb = modal.onConfirm;
                  setModal(null);
                  cb();
                }}
              >
                {modal.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default OetReadingExam;
