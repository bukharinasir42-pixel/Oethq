"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { OetMcqQuestion, OetReadingImport, OetTextBlock } from "@/lib/oet-test-schema";
import type { OetResult } from "@/lib/oet-tests-api";
import {
  DIFFICULTY_LABEL,
  fetchExplanations,
  QUESTION_TYPE_LABEL,
  TRAP_LABEL,
  WALKTHROUGH_LABELS as L,
  type Explanation
} from "@/lib/explanations-api";

/**
 * oet-reading-walkthrough.tsx — the paper, worked through one question at a time.
 *
 * Opened from the results screen. The source sits on the left and the worked
 * explanation on the right, and the two are joined: the sentence the answer
 * rests on is highlighted IN the passage, so the student is looking at the text
 * while they read why it is the text.
 *
 * Three choices are deliberate and worth stating, because each of them was the
 * difference between a screen that gets read and one that gets scrolled past.
 *
 *  - **One question at a time, not a list.** A list invites scanning, and
 *    scanning is the habit this screen exists to break. Moving costs a
 *    keystroke, and the rail keeps the whole paper in view without putting it
 *    all on the page at once.
 *  - **Wrong answers first, by default.** A candidate who scored 34 does not
 *    need 42 explanations, they need eight. The toggle is there for the ones
 *    who want the rest, and for the guesses that happened to land.
 *  - **The failing component is quoted, not described.** "Option B is wrong
 *    because it overstates" teaches nothing. "Option B fails on *proves*"
 *    points at the word, and the word is the lesson.
 */

type Part = "A" | "B" | "C";
type Status = "correct" | "wrong" | "skip";

type Item = {
  n: number;
  part: Part;
  prompt: string;
  options?: Record<string, string>;
  /** The correct answer as it should be displayed to the student. */
  correct: string;
  /** The bare option key for an MCQ, so the right card can be marked. */
  correctKey?: string;
  given: string | null;
  status: Status;
  /** Index of the Part C text this question belongs to. */
  textIndex?: number;
  explanation?: Explanation;
};

/* ------------------------------------------------------------------ passage */

/** The exam's own block semantics, so the passage reads identically here. */
function blocksToHtml(blocks: OetTextBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "p") return `<p>${b.html}</p>`;
      if (b.type === "heading") return `<h3 class="pa-sub">${b.text}</h3>`;
      if (b.type === "list") {
        const tag = b.ordered ? "ol" : "ul";
        return `<${tag} class="pa-list${b.ordered ? " ord" : ""}">${b.items
          .map((i) => `<li>${i}</li>`)
          .join("")}</${tag}>`;
      }
      if (b.type === "note") {
        return `<div class="pa-note">${
          b.label ? `<span class="pa-note-label">${b.label}</span>` : ""
        }<div class="pa-note-body">${b.html}</div></div>`;
      }
      const head = b.head.map((h) => `<th>${h}</th>`).join("");
      const rows = b.rows
        .map(
          (r) =>
            `<tr>${r.map((cell, ci) => `<td${ci === 0 ? ' class="rh"' : ""}>${cell}</td>`).join("")}</tr>`
        )
        .join("");
      return `<div class="pa-table-wrap"><table class="pa-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    .join("");
}

/* --------------------------------------------------------------- highlights */

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
 * One quote, split on its ellipses.
 *
 * A quote may skip a clause it does not rely on. Each side is located
 * separately so the student sees two marks with the skipped clause plain
 * between them, which is more honest than marking the whole span.
 */
function fragmentsOf(quote: string): string[] {
  return quote
    .split(/…|\.\.\./)
    .map((f) => f.trim().replace(/^[,;:.\-\s]+|[,;:\-\s]+$/g, ""))
    .filter((f) => f.length >= 14);
}

/**
 * Find one fragment in the rendered passage and wrap it.
 *
 * Works over the DOM's text rather than the HTML source, because the quote was
 * taken from what the student reads, not from the markup around it — a sentence
 * spanning a `<b>` would never match a raw string search.
 *
 * Returns false when it cannot be found. The caller then shows the quote in a
 * box and says so, because being told to look at a highlight that is not there
 * is worse than being given no highlight at all.
 */
function markFragment(root: HTMLElement, fragment: string): boolean {
  const needle = loose(fragment);
  if (!needle) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let full = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
    full += (node as Text).data;
  }

  // Normalise the haystack while keeping, for every character kept, the index it
  // came from. Reconstructing that mapping afterwards by walking the two strings
  // in step is what breaks: the rendered passage begins with the whitespace of
  // the markup, a trim silently shifts every index by that amount, and the
  // highlight lands on the wrong words or on nothing at all.
  const map: number[] = [];
  let hay = "";
  let prevSpace = false;
  for (let i = 0; i < full.length; i++) {
    const raw = full[i];
    const isSpace = /\s/.test(raw);
    if (isSpace && prevSpace) continue;
    prevSpace = isSpace;
    let ch = raw;
    if (ch === "‘" || ch === "’") ch = "'";
    else if (ch === "“" || ch === "”") ch = '"';
    else if (ch === "–" || ch === "—") ch = "-";
    else if (isSpace) ch = " ";
    hay += ch.toLowerCase();
    map.push(i);
  }

  const start = hay.indexOf(needle);
  if (start === -1) return false;

  const realStart = map[start];
  const realEnd = map[start + needle.length - 1] + 1;

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

  const range = document.createRange();
  range.setStart(startNode, Math.max(0, startOffset));
  range.setEnd(endNode, Math.min(endNode.data.length, endOffset));
  const mark = document.createElement("mark");
  mark.className = "xhl";
  try {
    range.surroundContents(mark);
    return true;
  } catch {
    // surroundContents throws when the range crosses element boundaries
    // unevenly (a sentence half inside a <b>). Wrap the extracted content.
    try {
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      return true;
    } catch {
      return false;
    }
  }
}

/* ---------------------------------------------------------------- component */

export function OetReadingWalkthrough({
  result,
  onBack
}: {
  result: OetResult;
  onBack: () => void;
}) {
  const content = result.content as OetReadingImport;
  const [explanations, setExplanations] = useState<Map<number, Explanation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [onlyWrong, setOnlyWrong] = useState(true);

  const sourceRef = useRef<HTMLDivElement | null>(null);
  const expRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

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

  /* ------------------------------------------------------------- questions */

  const all = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const given = (n: number) => result.answers[String(n)] ?? null;
    const statusOf = (n: number): Status => {
      const a = given(n);
      if (a === null || String(a).trim() === "") return "skip";
      return result.perQuestion[n] ? "correct" : "wrong";
    };

    for (const q of content.partA.questions) {
      out.push({
        n: q.n,
        part: "A",
        prompt: q.prompt,
        correct: q.type === "letter_match" ? `Text ${q.answer}` : q.answer.display,
        correctKey: q.type === "letter_match" ? String(q.answer) : undefined,
        given: given(q.n),
        status: statusOf(q.n),
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
        correctKey: it.answer,
        given: given(it.n),
        status: statusOf(it.n),
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
          correctKey: q.answer,
          given: given(q.n),
          status: statusOf(q.n),
          textIndex: ti,
          explanation: explanations.get(q.n)
        });
      }
    });
    return out;
  }, [content, result.answers, result.perQuestion, explanations]);

  const wrongCount = useMemo(() => all.filter((q) => q.status !== "correct").length, [all]);

  /**
   * The questions being walked.
   *
   * Filtering to the wrong ones is the default, but a paper answered perfectly
   * would leave an empty screen, so a clean sheet falls back to all of them
   * rather than congratulating the student into a blank page.
   */
  const shown = useMemo(() => {
    if (!onlyWrong || wrongCount === 0) return all;
    return all.filter((q) => q.status !== "correct");
  }, [all, onlyWrong, wrongCount]);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, shown.length - 1)));
  }, [shown.length]);

  const active = shown[index] ?? shown[0];

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(shown.length - 1, i + delta)));
      expRef.current?.scrollTo({ top: 0 });
    },
    [shown.length]
  );

  const jumpTo = useCallback(
    (n: number) => {
      const i = shown.findIndex((q) => q.n === n);
      if (i === -1) return;
      setIndex(i);
      expRef.current?.scrollTo({ top: 0 });
    },
    [shown]
  );

  // Arrow keys move between questions. This screen is read for twenty minutes
  // at a stretch; reaching for the mouse forty times is friction that shows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Keep the active dot in view as the student moves through a long paper.
  useEffect(() => {
    railRef.current?.querySelector(".xdot.here")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active?.n]);

  /* --------------------------------------------------------------- source */

  const quotes = useMemo(() => active?.explanation?.evidenceQuotes ?? [], [active]);

  /** Which of the four Part A texts the answer is actually in. */
  const relevantLetters = useMemo(() => {
    const set = new Set<string>();
    for (const q of quotes) {
      const m = /^Text\s+([A-D])/i.exec(q.loc ?? "");
      if (m) set.add(m[1].toUpperCase());
    }
    if (active?.explanation?.evidenceLetter) set.add(active.explanation.evidenceLetter);
    return set;
  }, [quotes, active]);

  const sourceHtml = useMemo(() => {
    if (!active) return "";
    if (active.part === "A") {
      return content.partA.texts
        .map((t) => {
          const dim = relevantLetters.size > 0 && !relevantLetters.has(t.letter);
          return `<div class="xabcd${dim ? " dim" : ""}"><div class="lt">${t.letter}</div>${
            t.title ? `<div class="xabcd-title">${t.title}</div>` : ""
          }${blocksToHtml(t.blocks)}</div>`;
        })
        .join("");
    }
    if (active.part === "B") {
      const item = content.partB.items.find((i) => i.n === active.n);
      if (!item) return "";
      return `<div class="xdocmeta"><span class="dk">${item.kind ?? "Extract"}</span>${
        item.docTitle ? `<span class="dt">${item.docTitle}</span>` : ""
      }</div>${item.docHtml}`;
    }
    const text = content.partC.texts[active.textIndex ?? 0];
    if (!text) return "";
    return `<h1 class="xsrc-title">${text.title}</h1>${text.paras
      .map((p, i) => `<p><span class="xpara">¶${i + 1}</span>${p}</p>`)
      .join("")}`;
  }, [active, content, relevantLetters]);

  /**
   * The source with the evidence already marked.
   *
   * Marked in a detached node and handed to React as finished HTML, rather than
   * marked in place after render. Marking the live DOM works right up until the
   * next render writes the container again and silently removes it, and the
   * failure is invisible: the student is simply told to look at a highlight
   * that is not there. Doing it here makes the marks part of what React renders,
   * so nothing can undo them.
   */
  const { html: markedHtml, missed } = useMemo(() => {
    if (typeof document === "undefined" || quotes.length === 0) {
      return { html: sourceHtml, missed: [] as string[] };
    }
    const holder = document.createElement("div");
    holder.innerHTML = sourceHtml;
    const notFound: string[] = [];
    for (const q of quotes) {
      for (const frag of fragmentsOf(q.quote)) {
        if (!markFragment(holder, frag)) notFound.push(frag);
      }
    }
    return { html: holder.innerHTML, missed: notFound };
  }, [sourceHtml, quotes]);

  // Bring the first mark into view once it is on the page.
  useLayoutEffect(() => {
    sourceRef.current?.querySelector("mark.xhl")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [markedHtml]);

  /* ---------------------------------------------------------------- render */

  if (!active) {
    return (
      <div className="oet-walk">
        <style dangerouslySetInnerHTML={{ __html: WALK_CSS }} />
        <div className="xempty">
          <p>There is nothing to walk through for this paper yet.</p>
          <button className="xexit" onClick={onBack}>
            Back to your score
          </button>
        </div>
      </div>
    );
  }

  const ex = active.explanation;
  const verdictLabel =
    active.status === "correct" ? "You got this right" : active.status === "skip" ? "You left this blank" : "You got this wrong";

  return (
    <div className="oet-walk">
      <style dangerouslySetInnerHTML={{ __html: WALK_CSS }} />

      {/* ------------------------------------------------- control bar */}
      <div className="xtop">
        <div className="xtop-r1">
          <span className="xpart">Part {active.part}</span>
          <span className="xcount">
            Question {active.n} <span>· {index + 1} of {shown.length}</span>
          </span>
          <span className={`xverdict ${active.status}`}>{verdictLabel}</span>
          <span className="sp" />
          <button
            className={`xtoggle${onlyWrong && wrongCount > 0 ? " on" : ""}`}
            onClick={() => setOnlyWrong((v) => !v)}
            disabled={wrongCount === 0}
            title={wrongCount === 0 ? "You did not drop a mark on this paper." : undefined}
          >
            <span className="dot" />
            {onlyWrong && wrongCount > 0 ? "Showing only my mistakes" : `Showing all ${all.length} questions`}
          </button>
          <div className="xnav">
            <button className="xnavbtn" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous question">
              ‹
            </button>
            <button
              className="xnavbtn"
              onClick={() => go(1)}
              disabled={index >= shown.length - 1}
              aria-label="Next question"
            >
              ›
            </button>
          </div>
          <button className="xexit" onClick={onBack}>
            Close
          </button>
        </div>

        {/* ------------------------------------------------------- rail */}
        <div className="xrail" ref={railRef}>
          {(["A", "B", "C"] as Part[]).map((p) => {
            const group = all.filter((q) => q.part === p);
            if (group.length === 0) return null;
            return (
              <div className="grp" key={p}>
                <span className="gl">PART {p}</span>
                {group.map((q) => {
                  const inShown = shown.some((s) => s.n === q.n);
                  return (
                    <button
                      key={q.n}
                      className={`xdot ${q.status}${q.n === active.n ? " here" : ""}${inShown ? "" : " muted"}`}
                      onClick={() => (inShown ? jumpTo(q.n) : (setOnlyWrong(false), setTimeout(() => jumpTo(q.n), 0)))}
                      title={`Question ${q.n}`}
                    >
                      {q.n}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------- the split */}
      <div className="xsplit">
        <section className="xpane xpane-src" aria-label="Source text">
          <div className="xsrc">
            <div className="eyebrow">
              {active.part === "A"
                ? "Part A · Texts A to D"
                : active.part === "B"
                  ? `Part B · Extract ${active.n}`
                  : `Part C · Text ${(active.textIndex ?? 0) + 1}`}
            </div>
            {quotes.length > 0 ? (
              <div className="srchint">
                {missed.length === 0
                  ? L.hint
                  : L.hintMissed}
              </div>
            ) : null}
            <div ref={sourceRef} dangerouslySetInnerHTML={{ __html: markedHtml }} />
          </div>
        </section>

        <section className="xpane xpane-exp" aria-label="Explanation" ref={expRef}>
          <div className="xexp">
            {/* --------------------------------------- the question itself */}
            <div className="xqbox">
              <div className="xqn">
                {active.part === "B" ? "Part B · Question" : "Question"} {active.n}
              </div>
              <div className="xq" dangerouslySetInnerHTML={{ __html: active.prompt }} />
              {ex ? (
                <div className="xmeta">
                  {ex.typeLabel ? (
                    <span className="xtag">{ex.typeLabel}</span>
                  ) : ex.questionType ? (
                    <span className="xtag">{QUESTION_TYPE_LABEL[ex.questionType] ?? ex.questionType}</span>
                  ) : null}
                  {ex.difficulty ? (
                    <span className={`xtag diff ${ex.difficulty.toLowerCase()}`}>
                      {DIFFICULTY_LABEL[ex.difficulty] ?? ex.difficulty}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="xrow">
                <span className={`xans you-${active.status[0]}`}>
                  <span className="lb">{active.options ? L.yourAnswer : L.youWrote}</span>
                  {active.status === "skip" ? L.notAnswered : active.given}
                </span>
                {active.status !== "correct" ? (
                  <span className="xans key">
                    <span className="lb">{active.options ? L.correct : L.accepted}</span>
                    {active.correct}
                  </span>
                ) : null}
              </div>
            </div>

            {!ex ? (
              <div className="xcallout note">
                {loading
                  ? "Loading the explanation…"
                  : "No explanation has been published for this question yet."}
              </div>
            ) : (
              <>
                {/* The reading mode this item wanted. Naming it is what makes
                    the lesson at the bottom transferable rather than local. */}
                {ex.skillLabel ? (
                  <div className="xblock">
                    <h4>{L.skill}</h4>
                    <div className="xprose" dangerouslySetInnerHTML={{ __html: ex.skillLabel }} />
                  </div>
                ) : null}

                {ex.stemFocus ? (
                  <div className="xblock">
                    <h4>{L.stem}</h4>
                    <div className="xprose" dangerouslySetInnerHTML={{ __html: ex.stemFocus }} />
                  </div>
                ) : null}

                {/* Evidence before reasoning, always. The student is meant to
                    look at the text and then read why, not the other way round. */}
                {ex.evidenceQuotes.length > 0 ? (
                  <div className="xblock">
                    <h4>{L.evidence}</h4>
                    {ex.evidenceQuotes.map((q, i) => (
                      <div className="xev" key={i}>
                        <div className="loc">
                          {q.loc ?? "In the text"}
                          <span>{missed.length === 0 ? L.highlighted : L.quotedHere}</span>
                        </div>
                        <div className="qt">{q.quote}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* The paraphrase mapping. The commonest failure at this level
                    is not missing the sentence, it is not recognising that the
                    sentence found IS the stem in the examiner's other words. */}
                {ex.bridge && ex.bridge.length > 0 ? (
                  <div className="xblock">
                    <h4>{L.bridge}</h4>
                    <div className="xbridge">
                      {ex.bridge.map((b, i) => (
                        <span className="xbr" key={i}>
                          <span className="s">{b.stem}</span>
                          <span className="a">→</span>
                          <span className="t">{b.text}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="xblock">
                  <h4>{L.reasoning}</h4>
                  <div className="xprose" dangerouslySetInnerHTML={{ __html: ex.reasoning }} />
                </div>

                {ex.options && active.options ? (
                  <div className="xblock">
                    <h4>{L.options}</h4>
                    {Object.keys(active.options).map((key) => {
                      const o = ex.options?.[key];
                      if (!o) return null;
                      const picked = active.given === key;
                      return (
                        <div
                          key={key}
                          className={`xopt ${o.verdict}${picked && o.verdict !== "correct" ? " picked" : ""}`}
                        >
                          <div className="xopt-h">
                            <div className="xopt-mk">{key}</div>
                            <div
                              className="xopt-t"
                              dangerouslySetInnerHTML={{
                                __html: `${active.options?.[key] ?? ""}${
                                  picked ? `<span class="yl">← ${L.youChose}</span>` : ""
                                }`
                              }}
                            />
                          </div>
                          <div className={`xfail ${o.verdict}`}>
                            {o.verdict !== "correct" ? (
                              <div className="dt2">
                                {o.verdict === "partial" ? "Half right, half wrong" : "Wrong answer"}
                                {o.trap ? <span className="tn">{TRAP_LABEL[o.trap] ?? o.trap}</span> : null}
                              </div>
                            ) : null}
                            {o.fails ? (
                              <div className="fc">
                                {L.fails} <em>{o.fails}</em>
                              </div>
                            ) : null}
                            <div className="fw" dangerouslySetInnerHTML={{ __html: o.why }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Short-answer items have no options, so the near misses are
                    enumerated instead. Most dropped marks here are answers that
                    were nearly right, and nearly right scores nothing. */}
                {ex.commonWrong && ex.commonWrong.length > 0 ? (
                  <div className="xblock">
                    <h4>{L.commonWrong}</h4>
                    {ex.commonWrong.map((c, i) => (
                      <div className="xopt distractor" key={i}>
                        <div className="xopt-h">
                          <div className="xopt-mk">✗</div>
                          <div className="xopt-t">
                            <b>{c.wrote}</b>
                          </div>
                        </div>
                        <div className="xfail distractor">
                          <div className="fw" dangerouslySetInnerHTML={{ __html: c.why }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {ex.trapNote ? (
                  <div className="xblock">
                    <h4>{L.trap}</h4>
                    <div className="xcallout trap" dangerouslySetInnerHTML={{ __html: ex.trapNote }} />
                  </div>
                ) : null}

                {/* The counterfactual. It shows the distractor was not nonsense,
                    it answered a different question, which is the single idea
                    that stops a candidate distrusting their own reading. */}
                {ex.counterfactual ? (
                  <div className="xblock">
                    <h4>{L.counterfactual}</h4>
                    <div className="xcallout counter" dangerouslySetInnerHTML={{ __html: ex.counterfactual }} />
                  </div>
                ) : null}

                {/* Last, always. The item teaches the rule; the rule does not
                    introduce the item. */}
                {ex.lesson ? (
                  <div className="xblock">
                    <h4>{L.lesson}</h4>
                    <div className="xcallout lesson" dangerouslySetInnerHTML={{ __html: ex.lesson }} />
                  </div>
                ) : null}

                {ex.note ? (
                  <div className="xcallout note">
                    <b>Note.</b> <span dangerouslySetInnerHTML={{ __html: ex.note }} />
                  </div>
                ) : null}
              </>
            )}

            {index >= shown.length - 1 ? (
              <div className="xend">
                <b>That is the last one.</b>
                <p>
                  {onlyWrong && wrongCount > 0
                    ? "You have been through every question you got wrong. Switch to all questions above to check the ones you got right, in case you guessed."
                    : "You have been through the whole paper."}
                </p>
                <button className="xexit" onClick={onBack}>
                  Back to your score
                </button>
              </div>
            ) : null}

            <div className="xkey">
              Use <kbd>←</kbd> <kbd>→</kbd> to move between questions
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const WALK_CSS = `
.oet-walk{
  --navy:#0D2A5E;--ink:#0B1B36;--blue:#1E8FE1;--blue-2:#0B63B0;--sky:#EAF3FC;--sky-2:#DDEBFA;
  --paper:#fff;--wash:#F3F7FC;--line:#DCE6F2;--line-strong:#C6D6E9;--muted:#5A6B85;--muted-2:#8496AE;
  --wrong:#C23B4B;--wrong-bg:#FDF2F3;--wrong-line:#F1C9CE;
  --right:#128A5B;--right-bg:#EDF8F2;--right-line:#BFE5D2;
  --skip:#C9781A;--skip-bg:#FDF6EC;--skip-line:#EFD9BB;
  --ev:#0B63B0;--ev-bg:#EEF6FD;--ev-line:#C9E2F7;--hl:#FFF1B8;--hl-line:#E8C64A;
  background:var(--wash);min-height:100vh;color:var(--ink);
  font:400 15px/1.5 'Plus Jakarta Sans',system-ui,-apple-system,sans-serif}
.oet-walk *{box-sizing:border-box}
.oet-walk button{font:inherit;cursor:pointer;border:none;background:none;color:inherit}
.xempty{display:grid;place-items:center;gap:14px;min-height:60vh;text-align:center;color:var(--muted)}

/* control bar */
.xtop{position:sticky;top:0;z-index:30;background:var(--paper);border-bottom:1px solid var(--line);box-shadow:0 2px 14px rgba(13,42,94,.06)}
.xtop-r1{display:flex;align-items:center;gap:12px;padding:12px 22px 10px;flex-wrap:wrap}
.xpart{display:inline-flex;align-items:center;font:800 11px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#fff;background:var(--navy);padding:7px 13px;border-radius:7px;white-space:nowrap}
.xcount{font:700 14px/1 system-ui,sans-serif;color:var(--navy);white-space:nowrap}
.xcount span{color:var(--muted-2);font-weight:600}
.xverdict{display:inline-flex;align-items:center;font:800 12.5px/1 system-ui,sans-serif;padding:7px 13px;border-radius:999px}
.xverdict.wrong{background:var(--wrong-bg);color:var(--wrong);border:1px solid var(--wrong-line)}
.xverdict.correct{background:var(--right-bg);color:var(--right);border:1px solid var(--right-line)}
.xverdict.skip{background:var(--skip-bg);color:var(--skip);border:1px solid var(--skip-line)}
.xtop .sp{flex:1 1 auto}
.xtoggle{display:inline-flex;align-items:center;gap:9px;font:700 13px/1 system-ui,sans-serif;color:var(--muted);border:1px solid var(--line-strong);border-radius:999px;padding:8px 15px;white-space:nowrap;transition:all .15s}
.xtoggle:hover:not(:disabled){border-color:var(--blue);color:var(--blue-2)}
.xtoggle:disabled{opacity:.45;cursor:default}
.xtoggle.on{background:var(--wrong);border-color:var(--wrong);color:#fff}
.xtoggle .dot{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.55}
.xtoggle.on .dot{opacity:1}
.xnav{display:flex;gap:8px}
.xnavbtn{width:38px;height:38px;border-radius:11px;border:1px solid var(--line-strong);background:#fff;display:grid;place-items:center;color:var(--navy);font-size:22px;line-height:1;transition:all .15s}
.xnavbtn:hover:not(:disabled){background:var(--navy);border-color:var(--navy);color:#fff}
.xnavbtn:disabled{opacity:.32;cursor:default}
.xexit{font:700 13px/1 system-ui,sans-serif;color:var(--muted);padding:9px 15px;border-radius:10px;border:1px solid var(--line-strong)}
.xexit:hover{color:var(--navy);border-color:var(--navy)}

/* rail */
.xrail{display:flex;align-items:center;gap:3px;padding:0 22px 11px;overflow-x:auto}
.xrail .grp{display:flex;align-items:center;gap:3px}
.xrail .gl{font:800 10px/1 system-ui,sans-serif;letter-spacing:.1em;color:var(--muted-2);margin:0 8px 0 6px;white-space:nowrap}
.xdot{flex:0 0 auto;width:27px;height:24px;border-radius:6px;font:800 11px/1 system-ui,sans-serif;display:grid;place-items:center;border:1px solid transparent;transition:transform .12s}
.xdot.correct{background:var(--right-bg);color:var(--right);border-color:var(--right-line)}
.xdot.wrong{background:var(--wrong-bg);color:var(--wrong);border-color:var(--wrong-line)}
.xdot.skip{background:var(--skip-bg);color:var(--skip);border-color:var(--skip-line)}
.xdot.here{outline:2px solid var(--navy);outline-offset:1px;transform:scale(1.12)}
.xdot.muted{opacity:.32}
.xdot:hover{transform:scale(1.15)}

/* split */
.xsplit{display:grid;grid-template-columns:1fr 1fr}
.xpane{overflow-y:auto;max-height:calc(100vh - 112px);min-height:calc(100vh - 112px)}
.xpane-src{border-right:1px solid var(--line);background:var(--paper)}
.xpane-exp{background:var(--wash)}

/* source */
.xsrc{padding:30px 38px 60px;max-width:760px;margin:0 auto}
.xsrc .eyebrow{font:800 11px/1 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--blue-2);margin-bottom:12px}
.xsrc-title{font:700 24px/1.22 Georgia,'Source Serif 4',serif;margin:0 0 18px}
.xsrc p{font:400 16.5px/1.75 Georgia,'Source Serif 4',serif;color:#233451;margin:0 0 15px}
.xsrc .xpara{display:inline-block;min-width:26px;font:700 12px/1 system-ui,sans-serif;color:var(--muted-2);vertical-align:top;padding-top:5px}
.xsrc .srchint{font:700 12px/1.45 system-ui,sans-serif;color:var(--ev);background:var(--ev-bg);border:1px solid var(--ev-line);border-radius:9px;padding:10px 14px;margin-bottom:20px}
.xabcd{border:1px solid var(--line);border-radius:13px;padding:18px 22px;margin-bottom:14px;transition:opacity .2s}
.xabcd.dim{opacity:.4}
.xabcd .lt{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:7px;background:var(--navy);color:#fff;font:800 13px/1 system-ui,sans-serif;margin-bottom:10px}
.xabcd.dim .lt{background:var(--muted-2)}
.xabcd-title{font:700 15px/1.3 system-ui,sans-serif;color:var(--navy);margin-bottom:8px}
.xabcd p{font-size:15.5px;line-height:1.68;margin-bottom:10px}
.xabcd p:last-child{margin-bottom:0}
.xsrc .xdocmeta{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.xsrc .dk{font:800 10.5px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--blue-2);padding:5px 10px;border-radius:6px}
.xsrc .dt{font:800 15px/1.3 system-ui,sans-serif;color:var(--navy)}
.oet-walk mark.xhl{background:var(--hl);box-shadow:inset 0 -2px 0 var(--hl-line);border-radius:3px;padding:1px 2px;color:inherit}

/* Part A structure carried over from the exam so the passage reads the same. */
.xsrc .pa-sub{font:700 14px/1.35 system-ui,sans-serif;color:var(--navy);margin:16px 0 8px;letter-spacing:.01em}
.xsrc .pa-list{margin:0 0 12px;padding-left:20px}
.xsrc .pa-list li{font:400 15.5px/1.62 Georgia,serif;color:#233451;margin-bottom:5px}
.xsrc .pa-list:not(.ord){list-style:square}
.xsrc .pa-note{background:var(--sky);border:1px solid var(--sky-2);border-radius:9px;padding:11px 14px;margin:0 0 12px}
.xsrc .pa-note-label{display:block;font:800 10px/1 system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--blue-2);margin-bottom:5px}
.xsrc .pa-table-wrap{overflow-x:auto;margin:0 0 14px}
.xsrc .pa-table{border-collapse:collapse;width:100%;font:400 14px/1.5 system-ui,sans-serif}
.xsrc .pa-table th,.xsrc .pa-table td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
.xsrc .pa-table th{background:var(--sky);font-weight:700;color:var(--navy)}
.xsrc .pa-table td.rh{font-weight:600;color:var(--navy);background:#FBFCFE}

/* explanation */
.xexp{padding:28px 36px 70px;max-width:780px;margin:0 auto}
.xqbox{background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:20px 22px;box-shadow:0 1px 2px rgba(13,42,94,.06),0 8px 24px rgba(13,42,94,.06)}
.xqn{font:800 11px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);margin-bottom:7px}
.xq{font:700 17px/1.5 system-ui,sans-serif;color:var(--ink)}
.xmeta{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
.xtag{font:700 11px/1.35 system-ui,sans-serif;padding:4px 9px;border-radius:6px;background:var(--sky);color:var(--blue-2);border:1px solid var(--sky-2)}
.xtag.diff.c1{background:var(--right-bg);color:var(--right);border-color:var(--right-line)}
.xtag.diff.c2{background:#FBF3E4;color:#8A6A16;border-color:#EFDFBC}
.xtag.diff.c3{background:var(--wrong-bg);color:var(--wrong);border-color:var(--wrong-line)}
.xrow{display:flex;gap:9px;flex-wrap:wrap;margin-top:15px;padding-top:15px;border-top:1px solid var(--line)}
.xans{font:700 13px/1.4 system-ui,sans-serif;padding:8px 14px;border-radius:10px;display:inline-flex;align-items:baseline;gap:8px}
.xans .lb{font:800 10px/1 system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;opacity:.72}
.xans.you-w{background:var(--wrong-bg);color:var(--wrong);border:1px solid var(--wrong-line)}
.xans.you-c{background:var(--right-bg);color:var(--right);border:1px solid var(--right-line)}
.xans.you-s{background:var(--skip-bg);color:var(--skip);border:1px solid var(--skip-line)}
.xans.key{background:var(--right-bg);color:var(--right);border:1px solid var(--right-line)}

.xblock{margin-top:24px}
.xblock > h4{font:800 11px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:var(--navy);margin:0 0 10px}
.xprose{font:400 14.5px/1.7 system-ui,sans-serif;color:#2C3E5C}
.xprose b,.xprose strong{color:var(--navy);font-weight:700}

.xev{background:var(--ev-bg);border:1px solid var(--ev-line);border-radius:11px;padding:13px 16px;margin-bottom:8px}
.xev .loc{font:800 10.5px/1 system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--ev);margin-bottom:6px}
.xev .loc span{font-weight:600;letter-spacing:0;text-transform:none;opacity:.65;margin-left:6px}
.xev .loc span::before{content:"· "}
.xev .qt{font:400 14.5px/1.6 Georgia,'Source Serif 4',serif;color:#123A63}

.xbridge{display:flex;flex-wrap:wrap;gap:8px}
.xbr{display:inline-flex;align-items:center;gap:9px;background:#FBFCFE;border:1px solid var(--line);border-radius:9px;padding:7px 12px;font-size:13px}
.xbr .s{color:var(--navy);font-weight:700}
.xbr .a{color:var(--muted-2)}
.xbr .t{color:var(--blue-2);font-weight:600}

.xopt{border:1px solid var(--line);border-radius:11px;padding:14px 16px;margin-bottom:9px;background:#fff}
.xopt.correct{background:var(--right-bg);border-color:var(--right-line)}
.xopt.partial{background:#FDF8EF;border-color:var(--skip-line)}
.xopt.picked{background:var(--wrong-bg);border-color:var(--wrong-line)}
.xopt-h{display:flex;align-items:flex-start;gap:11px}
.xopt-mk{flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font:800 13px/1 system-ui,sans-serif;background:var(--line);color:var(--muted)}
.xopt.correct .xopt-mk{background:var(--right);color:#fff}
.xopt.partial .xopt-mk{background:var(--skip);color:#fff}
.xopt.picked .xopt-mk{background:var(--wrong);color:#fff}
.xopt-t{flex:1 1 auto;font:400 14px/1.55 system-ui,sans-serif;color:#2C3E5C}
.xopt-t .yl{font:800 10.5px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--wrong);margin-left:7px;white-space:nowrap}
.xfail{margin-top:11px;padding-top:11px;border-top:1px dashed var(--line-strong)}
.xfail.correct{border-top-color:var(--right-line)}
.xfail .dt2{display:inline-flex;align-items:center;gap:7px;font:800 11px/1 system-ui,sans-serif;padding:4px 9px;border-radius:6px;background:var(--wrong-bg);color:var(--wrong);border:1px solid var(--wrong-line);margin-bottom:8px}
.xopt.partial .xfail .dt2{background:var(--skip-bg);color:var(--skip);border-color:var(--skip-line)}
.xfail .dt2 .tn{font-weight:600;opacity:.8}
.xfail .dt2 .tn::before{content:"· "}
.xfail .fc{font:700 13px/1.5 system-ui,sans-serif;color:var(--wrong);margin-bottom:7px}
.xopt.partial .xfail .fc{color:var(--skip)}
.xfail .fc em{font-style:normal;background:var(--wrong-bg);padding:2px 6px;border-radius:5px;font-family:Georgia,serif}
.xopt.partial .xfail .fc em{background:var(--skip-bg)}
.xfail .fw{font:400 14px/1.62 system-ui,sans-serif;color:#4A5A73}
.xfail.correct .fw{color:#136B4A}

.xcallout{border-radius:11px;padding:14px 17px;font:400 14px/1.62 system-ui,sans-serif}
.xcallout.trap{background:var(--skip-bg);border:1px solid var(--skip-line);color:#7A4A10}
.xcallout.counter{background:#F6F3FC;border:1px solid #E2DBF3;color:#4A3C7E}
.xcallout.lesson{background:var(--sky);border:1px solid var(--sky-2);color:#123A63}
.xcallout.note{background:#F5F5F7;border:1px solid #E2E2E8;color:#4A4A56;margin-top:20px}

.xend{margin-top:30px;background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:26px;text-align:center}
.xend b{display:block;font:800 17px/1.3 system-ui,sans-serif;color:var(--navy);margin-bottom:6px}
.xend p{font:400 13.5px/1.6 system-ui,sans-serif;color:var(--muted);margin:0 0 16px}
.xkey{font:400 11.5px/1.5 system-ui,sans-serif;color:var(--muted-2);text-align:center;margin-top:22px}
.xkey kbd{font-family:ui-monospace,monospace;background:#fff;border:1px solid var(--line-strong);border-bottom-width:2px;border-radius:5px;padding:1px 6px;font-size:11px;color:var(--muted)}

@media(max-width:1000px){
  .xsplit{grid-template-columns:1fr}
  .xpane{max-height:none;min-height:0}
  .xpane-src{border-right:none;border-bottom:1px solid var(--line);max-height:46vh;overflow-y:auto}
  .xsrc,.xexp{padding:22px 18px 40px}
  .xtop-r1{padding:10px 14px 8px;gap:9px}
  .xrail{padding:0 14px 10px}
  .xcount span{display:none}
}
@media (prefers-reduced-motion:reduce){.oet-walk *{transition:none!important}}
`;
