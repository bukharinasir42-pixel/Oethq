"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  OetMcqQuestion,
  OetReadingImport,
  OetTextBlock
} from "@/lib/oet-test-schema";
import type { OetResult } from "@/lib/oet-tests-api";
import {
  DIFFICULTY_LABEL,
  fetchExplanations,
  QUESTION_TYPE_LABEL,
  TRAP_LABEL,
  type Explanation
} from "@/lib/explanations-api";

/**
 * oet-reading-review.tsx — the paper, explained, side by side.
 *
 * The screen a student opens after submitting. The passage sits on the left and
 * the question with its explanation on the right, and the two are linked: the
 * sentence the answer came from is highlighted IN the passage, and selecting a
 * question scrolls the passage to it.
 *
 * That link is the whole point. A student who is only told "the answer is B"
 * learns that they got it wrong. A student who is shown the sentence they
 * should have found, and why the option they chose was true but did not answer
 * the question, learns to find it next time.
 *
 * Everything renders from the result payload that was already being fetched —
 * the full paper with its answer key — plus the approved explanations. There is
 * no second copy of the paper anywhere.
 */

const INK = "#0B2E4F";
const BRAND = "#12508A";
const LINE = "#DCE6F1";

type Part = "A" | "B" | "C";

type ReviewQuestion = {
  n: number;
  part: Part;
  prompt: string;
  options?: Record<string, string>;
  /** The canonical correct answer, as displayed. */
  correct: string;
  /** What the student put. */
  given: string | null;
  isCorrect: boolean;
  /** Index of the Part C text, so the right passage can be shown. */
  textIndex?: number;
  explanation?: Explanation;
};

/** Reuse the exam's own block renderer semantics so the passage looks identical. */
function blocksToHtml(blocks: OetTextBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "p") return `<p>${b.html}</p>`;
      if (b.type === "heading") return `<h3 class="pa-sub">${b.text}</h3>`;
      if (b.type === "list") {
        const tag = b.ordered ? "ol" : "ul";
        return `<${tag} class="pa-list${b.ordered ? " ord" : ""}">${b.items.map((i) => `<li>${i}</li>`).join("")}</${tag}>`;
      }
      if (b.type === "note") {
        return `<div class="pa-note">${b.label ? `<span class="pa-note-label">${b.label}</span>` : ""}<div class="pa-note-body">${b.html}</div></div>`;
      }
      const head = b.head.map((h) => `<th>${h}</th>`).join("");
      const rows = b.rows
        .map((r) => `<tr>${r.map((cell, ci) => `<td${ci === 0 ? ' class="rh"' : ""}>${cell}</td>`).join("")}</tr>`)
        .join("");
      return `<div class="pa-table-wrap"><table class="pa-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    .join("");
}

/** Normalised for matching: quote style and whitespace vary harmlessly. */
function loose(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Find the evidence sentence in the rendered passage and wrap it.
 *
 * Works over the DOM's text rather than the HTML source, because the evidence
 * was quoted from what the student reads, not from the markup around it — a
 * sentence spanning a `<b>` would never match a raw string search.
 *
 * Returns false when the quote cannot be found, and the caller then shows the
 * evidence as a quotation instead. A silent miss would be the worst outcome:
 * the student would be told to look at a highlight that is not there.
 */
function highlightEvidence(root: HTMLElement, evidence: string): boolean {
  root.querySelectorAll("mark.ev").forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });

  const needle = loose(evidence);
  if (!needle) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let full = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
    full += (node as Text).data;
  }

  const start = loose(full).indexOf(needle);
  if (start === -1) return false;

  // Map the position in the normalised string back to the real one. Normalising
  // only ever collapses whitespace, so walking both in step is exact.
  let realStart = -1;
  let realEnd = -1;
  let seen = 0;
  let prevSpace = false;
  for (let i = 0; i < full.length; i++) {
    const ch = full[i];
    const isSpace = /\s/.test(ch);
    if (isSpace && prevSpace) continue;
    if (seen === start && realStart === -1) realStart = i;
    seen++;
    prevSpace = isSpace;
    if (seen === start + needle.length) {
      realEnd = i + 1;
      break;
    }
  }
  if (realStart === -1) return false;
  if (realEnd === -1) realEnd = full.length;

  // Wrap the range across however many text nodes it spans.
  let offset = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  for (const node of nodes) {
    const len = node.data.length;
    if (!startNode && offset + len > realStart) {
      startNode = node;
      startOffset = realStart - offset;
    }
    if (!endNode && offset + len >= realEnd) {
      endNode = node;
      endOffset = realEnd - offset;
      break;
    }
    offset += len;
  }
  if (!startNode || !endNode) return false;

  try {
    const range = document.createRange();
    range.setStart(startNode, Math.max(0, startOffset));
    range.setEnd(endNode, Math.min(endNode.data.length, endOffset));
    const mark = document.createElement("mark");
    mark.className = "ev";
    range.surroundContents(mark);
    return true;
  } catch {
    // surroundContents throws when the range crosses element boundaries
    // unevenly (a sentence half inside a <b>). Fall back to per-node wrapping.
    try {
      const range = document.createRange();
      range.setStart(startNode, Math.max(0, startOffset));
      range.setEnd(endNode, Math.min(endNode.data.length, endOffset));
      const frag = range.extractContents();
      const mark = document.createElement("mark");
      mark.className = "ev";
      mark.appendChild(frag);
      range.insertNode(mark);
      return true;
    } catch {
      return false;
    }
  }
}

export function OetReadingReview({
  result,
  onBack
}: {
  result: OetResult;
  onBack: () => void;
}) {
  const content = result.content as OetReadingImport;
  const [explanations, setExplanations] = useState<Map<number, Explanation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [part, setPart] = useState<Part>("A");
  const [activeN, setActiveN] = useState<number | null>(null);
  const [evidenceFound, setEvidenceFound] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [mobilePane, setMobilePane] = useState<"text" | "questions">("questions");

  const passageRef = useRef<HTMLDivElement | null>(null);
  const questionRefs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1000px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let live = true;
    void fetchExplanations(result.testId).then((rows) => {
      if (!live) return;
      setExplanations(new Map(rows.map((r) => [r.questionNumber, r])));
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [result.testId]);

  // ------------------------------------------------------------- questions

  const questions = useMemo<ReviewQuestion[]>(() => {
    const out: ReviewQuestion[] = [];
    const given = (n: number) => result.answers[String(n)] ?? null;
    const ok = (n: number) => Boolean(result.perQuestion[n]);

    for (const q of content.partA.questions) {
      out.push({
        n: q.n,
        part: "A",
        prompt: q.prompt,
        correct: q.type === "letter_match" ? `Text ${q.answer}` : q.answer.display,
        given: given(q.n),
        isCorrect: ok(q.n),
        explanation: explanations.get(q.n)
      });
    }
    for (const it of content.partB.items) {
      out.push({
        n: it.n,
        part: "B",
        prompt: it.prompt,
        options: it.options,
        correct: it.answer,
        given: given(it.n),
        isCorrect: ok(it.n),
        explanation: explanations.get(it.n)
      });
    }
    content.partC.texts.forEach((t, ti) => {
      for (const q of t.questions as OetMcqQuestion[]) {
        out.push({
          n: q.n,
          part: "C",
          prompt: q.prompt,
          options: q.options,
          correct: q.answer,
          given: given(q.n),
          isCorrect: ok(q.n),
          textIndex: ti,
          explanation: explanations.get(q.n)
        });
      }
    });
    return out;
  }, [content, result.answers, result.perQuestion, explanations]);

  const inPart = useMemo(() => questions.filter((q) => q.part === part), [questions, part]);
  const active = useMemo(() => questions.find((q) => q.n === activeN) ?? inPart[0], [questions, activeN, inPart]);

  useEffect(() => {
    if (inPart.length > 0 && !inPart.some((q) => q.n === activeN)) setActiveN(inPart[0].n);
  }, [inPart, activeN]);

  // --------------------------------------------------------------- passage

  const passageHtml = useMemo(() => {
    if (!active) return "";
    if (active.part === "A") {
      return content.partA.texts
        .map(
          (t) =>
            `<div class="abcd-block" data-letter="${t.letter}"><div class="abcd-head"><div class="lt">${t.letter}</div><div class="abcd-htext"><div class="lb">Text ${t.letter}</div>${
              t.title ? `<div class="pa-title">${t.title}</div>` : ""
            }</div></div>${blocksToHtml(t.blocks)}</div>`
        )
        .join("");
    }
    if (active.part === "B") {
      const item = content.partB.items.find((i) => i.n === active.n);
      if (!item) return "";
      return `<div class="rv-doc"><div class="rv-doc-head">${item.kind ?? "Extract"}${
        item.docTitle ? ` · ${item.docTitle}` : ""
      }</div>${item.docHtml}</div>`;
    }
    const text = content.partC.texts[active.textIndex ?? 0];
    if (!text) return "";
    return `<div class="rv-doc"><div class="rv-doc-head">${text.title}</div>${text.paras
      .map((p) => `<p>${p}</p>`)
      .join("")}</div>`;
  }, [active, content]);

  // Re-apply the highlight after every render that changes the passage or the
  // selected question. A layout effect so the student never sees the unmarked
  // passage flash before the mark lands.
  useLayoutEffect(() => {
    const root = passageRef.current;
    if (!root) return;
    const ev = active?.explanation?.evidence;
    if (!ev) {
      setEvidenceFound(true);
      return;
    }
    const found = highlightEvidence(root, ev);
    setEvidenceFound(found);
    if (found) {
      const mark = root.querySelector("mark.ev");
      mark?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [passageHtml, active]);

  const selectQuestion = useCallback(
    (n: number) => {
      setActiveN(n);
      if (narrow) setMobilePane("text");
    },
    [narrow]
  );

  const answeredLabel = (q: ReviewQuestion) => {
    if (!q.given) return "You left this blank";
    if (q.options) return `You chose ${q.given}`;
    return `You wrote “${q.given}”`;
  };

  const counts = useMemo(
    () => ({
      A: questions.filter((q) => q.part === "A").length,
      B: questions.filter((q) => q.part === "B").length,
      C: questions.filter((q) => q.part === "C").length
    }),
    [questions]
  );

  const withExplanations = questions.filter((q) => q.explanation).length;

  return (
    <div className="oet-reading rv-root">
      <style dangerouslySetInnerHTML={{ __html: REVIEW_CSS }} />

      <header className="rv-top">
        <button type="button" className="rv-back" onClick={onBack}>
          ← Back to your score
        </button>
        <div className="rv-title">
          <span className="rv-eyebrow">Answer explanations</span>
          <h1>{result.title}</h1>
        </div>
        <div className="rv-score">
          <span className="rv-score-n">{result.correct}</span>
          <span className="rv-score-d">/ {result.total}</span>
        </div>
      </header>

      <nav className="rv-parts" role="tablist" aria-label="Parts">
        {(["A", "B", "C"] as Part[]).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={part === p}
            className={`rv-part${part === p ? " on" : ""}`}
            onClick={() => setPart(p)}
          >
            Part {p}
            <span className="rv-part-n">{counts[p]}</span>
          </button>
        ))}
        {narrow ? (
          <div className="rv-pane-switch">
            <button className={mobilePane === "text" ? "on" : ""} onClick={() => setMobilePane("text")}>
              Text
            </button>
            <button className={mobilePane === "questions" ? "on" : ""} onClick={() => setMobilePane("questions")}>
              Questions
            </button>
          </div>
        ) : null}
      </nav>

      {!loading && withExplanations === 0 ? (
        <div className="rv-empty-banner">
          This paper does not have explanations yet. You can still review every question, your answer and
          the correct answer below.
        </div>
      ) : null}

      <div className={`rv-split${narrow ? ` narrow pane-${mobilePane}` : ""}`}>
        {/* --------------------------------------------------------- passage */}
        <section className="rv-pane rv-text" aria-label="Passage">
          <div className="passage" ref={passageRef} dangerouslySetInnerHTML={{ __html: passageHtml }} />
        </section>

        {/* ------------------------------------------------------- questions */}
        <section className="rv-pane rv-qs" aria-label="Questions and explanations">
          {inPart.map((q) => {
            const isActive = active?.n === q.n;
            const ex = q.explanation;
            return (
              <article
                key={q.n}
                ref={(el) => {
                  if (el) questionRefs.current.set(q.n, el);
                }}
                className={`rv-card${isActive ? " on" : ""}${q.isCorrect ? " ok" : " no"}`}
                onClick={() => selectQuestion(q.n)}
              >
                <header className="rv-card-top">
                  <span className={`rv-n ${q.isCorrect ? "ok" : "no"}`}>{q.n}</span>
                  <div className="rv-prompt" dangerouslySetInnerHTML={{ __html: q.prompt }} />
                  <span className={`rv-verdict ${q.isCorrect ? "ok" : "no"}`}>
                    {q.isCorrect ? "Correct" : "Wrong"}
                  </span>
                </header>

                <div className="rv-answers">
                  <span className="rv-ans correct">
                    <b>Answer</b> {q.correct}
                  </span>
                  {!q.isCorrect ? <span className="rv-ans given">{answeredLabel(q)}</span> : null}
                </div>

                {isActive && ex ? (
                  <div className="rv-ex">
                    {/* Chips first: what kind of question this was and how hard
                        it was. A candidate who dropped a C1 mark needs to know
                        it was an affordable one, plainly. */}
                    <div className="rv-chips">
                      {ex.questionType ? (
                        <span className="rv-skill">{QUESTION_TYPE_LABEL[ex.questionType] ?? ex.questionType}</span>
                      ) : ex.skillTag ? (
                        <span className="rv-skill">{ex.skillTag}</span>
                      ) : null}
                      {ex.difficulty ? (
                        <span className={`rv-diff ${ex.difficulty.toLowerCase()}`}>
                          {DIFFICULTY_LABEL[ex.difficulty]}
                        </span>
                      ) : null}
                    </div>

                    {/* The stem, restated with the operative word stressed.
                        Answering what is asked rather than what is written is
                        the whole discipline, so it leads. */}
                    {ex.stemFocus ? <p className="rv-stem">{ex.stemFocus}</p> : null}

                    <div className="rv-ev">
                      <span className="rv-ev-label">
                        Where it comes from
                        {ex.evidenceLetter ? ` · Text ${ex.evidenceLetter}` : ""}
                      </span>
                      <blockquote>{ex.evidence}</blockquote>
                      <span className="rv-ev-hint">
                        {evidenceFound
                          ? "Highlighted in the text on the left."
                          : "Shown here — this sentence could not be located automatically in the text."}
                      </span>
                    </div>

                    <p className="rv-why">{ex.reasoning}</p>

                    {ex.options && q.options ? (
                      <ul className="rv-opts">
                        {Object.keys(q.options).map((key) => {
                          const verdict = ex.options?.[key];
                          if (!verdict) return null;
                          return (
                            <li key={key} className={`rv-opt ${verdict.verdict}`}>
                              <span className="rv-opt-key">{key}</span>
                              <span className="rv-opt-body">
                                <span className="rv-opt-tag">
                                  {verdict.verdict === "correct"
                                    ? "Correct"
                                    : verdict.verdict === "partial"
                                      ? "Partial distractor"
                                      : "Distractor"}
                                  {verdict.trap && verdict.verdict !== "correct" ? (
                                    <span className="rv-trap">{TRAP_LABEL[verdict.trap]}</span>
                                  ) : null}
                                </span>
                                <span className="rv-opt-why">{verdict.why}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    {/* The counterfactual: what question this distractor WOULD
                        have answered. It shows the option was not nonsense. */}
                    {ex.counterfactual ? (
                      <p className="rv-counter">
                        <span className="rv-counter-label">Had the question asked something else</span>
                        {ex.counterfactual}
                      </p>
                    ) : null}

                    {/* The transferable rule, last. The item teaches the rule;
                        the rule does not introduce the item. */}
                    {ex.lesson ? (
                      <p className="rv-lesson">
                        <span className="rv-lesson-label">Take this forward</span>
                        {ex.lesson}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {isActive && !ex && !loading ? (
                  <p className="rv-noex">No explanation has been published for this question yet.</p>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}

const REVIEW_CSS = `
.rv-root{--rv-ink:${INK};--rv-brand:${BRAND};--rv-line:${LINE};background:#F4F7FB;min-height:100vh}
.rv-top{display:flex;align-items:center;gap:16px;padding:14px 20px;background:linear-gradient(135deg,${INK},${BRAND});color:#fff;position:sticky;top:0;z-index:20}
.rv-back{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:9px;padding:8px 13px;font:600 12.5px/1 system-ui,sans-serif;cursor:pointer}
.rv-title{flex:1;min-width:0}
.rv-eyebrow{display:block;font:700 10px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;opacity:.75;margin-bottom:4px}
.rv-title h1{margin:0;font:700 17px/1.25 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv-score{display:flex;align-items:baseline;gap:4px;background:rgba(255,255,255,.13);border-radius:10px;padding:7px 13px}
.rv-score-n{font:800 20px/1 system-ui,sans-serif}
.rv-score-d{font:600 12px/1 system-ui,sans-serif;opacity:.8}

.rv-parts{display:flex;align-items:center;gap:8px;padding:11px 20px;background:#fff;border-bottom:1px solid var(--rv-line);position:sticky;top:60px;z-index:19}
.rv-part{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--rv-line);color:#40566E;border-radius:999px;padding:7px 14px;font:600 13px/1 system-ui,sans-serif;cursor:pointer}
.rv-part.on{background:var(--rv-brand);border-color:var(--rv-brand);color:#fff}
.rv-part-n{font:700 10.5px/1 system-ui,sans-serif;opacity:.7}
.rv-pane-switch{margin-left:auto;display:inline-flex;border:1px solid var(--rv-line);border-radius:9px;overflow:hidden}
.rv-pane-switch button{background:#fff;border:0;padding:7px 13px;font:600 12px/1 system-ui,sans-serif;color:#40566E;cursor:pointer}
.rv-pane-switch button.on{background:var(--rv-brand);color:#fff}

.rv-empty-banner{margin:12px 20px 0;padding:11px 14px;border:1px solid #F2D9A7;background:#FEF8EC;border-radius:10px;font:500 12.5px/1.5 system-ui,sans-serif;color:#7A5A17}

.rv-split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:16px;padding:16px 20px 40px;align-items:start}
.rv-pane{background:#fff;border:1px solid var(--rv-line);border-radius:14px;box-shadow:0 1px 3px rgba(11,46,79,.05)}
.rv-text{position:sticky;top:118px;max-height:calc(100vh - 138px);overflow-y:auto;padding:20px 22px}
.rv-qs{padding:12px;display:flex;flex-direction:column;gap:10px}

.rv-doc-head{font:800 10.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--rv-brand);margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--rv-line)}
.rv-text p{margin:0 0 11px;line-height:1.68}

/* The evidence highlight. Deliberately unmistakable — it is the single thing
   the student is being pointed at. */
.rv-text mark.ev{background:linear-gradient(180deg,transparent 52%,#FFE08A 52%);border-radius:2px;padding:1px 0;box-shadow:0 0 0 3px rgba(255,224,138,.32)}

.rv-card{border:1px solid var(--rv-line);border-radius:12px;padding:12px 13px;background:#fff;cursor:pointer;transition:border-color .12s,box-shadow .12s}
.rv-card:hover{border-color:#BFD3E8}
.rv-card.on{border-color:var(--rv-brand);box-shadow:0 0 0 3px rgba(18,80,138,.1)}
.rv-card.no{background:#FFFCFC}
.rv-card-top{display:flex;align-items:flex-start;gap:10px}
.rv-n{flex:0 0 26px;height:26px;border-radius:8px;display:grid;place-items:center;font:800 12px/1 system-ui,sans-serif;color:#fff}
.rv-n.ok{background:#0F9D58}.rv-n.no{background:#C0392B}
.rv-prompt{flex:1;font:600 13.5px/1.5 system-ui,sans-serif;color:#16283D}
.rv-verdict{font:700 10px/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;padding:5px 8px;border-radius:6px;white-space:nowrap}
.rv-verdict.ok{background:#E7F6ED;color:#0B7A43}.rv-verdict.no{background:#FCEBE9;color:#A32A1D}

.rv-answers{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
.rv-ans{font:600 11.5px/1 system-ui,sans-serif;padding:6px 9px;border-radius:7px}
.rv-ans.correct{background:#E7F6ED;color:#0B7A43}
.rv-ans.given{background:#F1F4F8;color:#5A6E85}

.rv-ex{margin-top:12px;padding-top:12px;border-top:1px dashed var(--rv-line)}
.rv-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.rv-skill{display:inline-block;font:700 9.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--rv-brand);background:#EAF2FA;border-radius:999px;padding:5px 9px}
.rv-diff{display:inline-block;font:700 9.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:5px 9px}
.rv-diff.c1{background:#E7F6ED;color:#0B7A43}
.rv-diff.c2{background:#FEF6E7;color:#8A6A16}
.rv-diff.c3{background:#FCEBE9;color:#A32A1D}
.rv-stem{margin:0 0 10px;font:600 12.5px/1.55 system-ui,sans-serif;color:#16283D}
.rv-trap{display:inline-block;margin-left:7px;font:700 9px/1 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;background:rgba(0,0,0,.06);border-radius:4px;padding:3px 6px;color:#4A5E75}
.rv-counter{margin:11px 0 0;padding:10px 12px;border-radius:9px;background:#F3F7FB;border:1px solid #DCE6F1;font:400 12.3px/1.6 system-ui,sans-serif;color:#33465F}
.rv-counter-label{display:block;font:800 9.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--rv-brand);margin-bottom:5px}
.rv-lesson{margin:9px 0 0;padding:10px 12px;border-radius:9px;background:#0B2E4F;color:#fff;font:500 12.5px/1.6 system-ui,sans-serif}
.rv-lesson-label{display:block;font:800 9.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin-bottom:5px}
.rv-ev{background:#FFFBF0;border:1px solid #F4E3BC;border-left:3px solid #E8B93B;border-radius:9px;padding:10px 12px;margin-bottom:10px}
.rv-ev-label{display:block;font:800 9.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8A6A16;margin-bottom:6px}
.rv-ev blockquote{margin:0;font:italic 13px/1.6 Georgia,serif;color:#3A2F14}
.rv-ev-hint{display:block;margin-top:6px;font:500 10.5px/1.4 system-ui,sans-serif;color:#96794A}
.rv-why{margin:0 0 10px;font:400 13px/1.65 system-ui,sans-serif;color:#2A3F57}

.rv-opts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.rv-opt{display:flex;gap:9px;padding:9px 10px;border-radius:9px;border:1px solid var(--rv-line);background:#FBFCFE}
.rv-opt.correct{border-color:#B7E3C8;background:#F2FBF5}
.rv-opt.partial{border-color:#F2D9A7;background:#FEF8EC}
.rv-opt.distractor{border-color:#E6E9EE;background:#FAFBFC}
.rv-opt-key{flex:0 0 22px;height:22px;border-radius:6px;display:grid;place-items:center;font:800 11px/1 system-ui,sans-serif;background:#E9EEF5;color:#40566E}
.rv-opt.correct .rv-opt-key{background:#0F9D58;color:#fff}
.rv-opt.partial .rv-opt-key{background:#E8B93B;color:#3A2F14}
.rv-opt-body{flex:1;min-width:0}
.rv-opt-tag{display:block;font:800 9.5px/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;margin-bottom:3px;color:#5A6E85}
.rv-opt.correct .rv-opt-tag{color:#0B7A43}
.rv-opt.partial .rv-opt-tag{color:#8A6A16}
.rv-opt-why{font:400 12.2px/1.55 system-ui,sans-serif;color:#3A4E63}
.rv-noex{margin:10px 0 0;font:500 12px/1.5 system-ui,sans-serif;color:#7A8DA3}

@media (max-width:1000px){
  .rv-split{grid-template-columns:1fr;padding:12px 12px 32px}
  .rv-split.narrow.pane-text .rv-qs{display:none}
  .rv-split.narrow.pane-questions .rv-text{display:none}
  .rv-text{position:static;max-height:none}
  .rv-parts{top:58px}
}
`;
