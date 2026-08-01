"use client";

/**
 * WebsiteWhatsInside — homepage "What's inside OET HQ" accordion (client
 * `whats-inside.html` design, scoped `.wi-*`). Click a row's + to expand it
 * (single-open); rows and the footer reveal on scroll. Content is static for
 * now — connecting each item to what a plan unlocks is the next step.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import "./oethq-whats-inside.css";

type Item = { n: string; accent: string; title: string; kicker: string; icon: ReactNode; body: ReactNode };

const ITEMS: Item[] = [
  {
    n: "01", accent: "#2E7CFF", title: "CBLA-calibrated OET material", kicker: "Built to the 2026 difficulty index",
    icon: <svg viewBox="0 0 24 24"><path d="M3 17V7a2 2 0 0 1 2-2h5v14H5a2 2 0 0 1-2-2Z" /><path d="M21 17V7a2 2 0 0 0-2-2h-5v14h5a2 2 0 0 0 2-2Z" /><path d="M7 9h1M7 12h1M16 9h1M16 12h1" /></svg>,
    body: (<>
      <p>Every paper we produce is calibrated against the <b>latest 2026 difficulty index of the OET exam</b> — not a version of the test that existed three years ago. CBLA is the framework the exam board uses to keep difficulty consistent between sittings, and we build to the same standard.</p>
      <p>That means a 350 on our material means the same thing as a 350 on the real paper. Practising on easier material is how candidates walk in confident and walk out with a C.</p>
      <div className="wi-mini"><span>2026 index</span><span>Examiner-authored</span><span>Applied linguistics reviewed</span></div>
    </>)
  },
  {
    n: "02", accent: "#17C77C", title: "OET HQ past papers", kicker: "The benchmark that predicts your result",
    icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" /></svg>,
    body: (<>
      <p>These are not practice papers. They are the benchmark we use to decide whether you are ready to book.</p>
      <p><b>Clear the OET HQ past papers before your exam and you have a 90% chance of clearing the real one.</b> That is the entire reason we hold them back for the higher tiers — they only mean something if you sit them cold.</p>
      <div className="wi-stat"><b>90%</b><span>clear the real exam after clearing ours</span></div>
    </>)
  },
  {
    n: "03", accent: "#00B8D9", title: "Live skimming & scanning drills", kicker: "Reading Part A speed",
    icon: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /><path d="M8 11h6M11 8v6" /></svg>,
    body: (<>
      <p>Reading Part A gives you fifteen minutes for twenty questions across four texts. Comprehension is not the problem — <b>location speed</b> is.</p>
      <p>These are live drills, run daily, built purely to raise how fast you find the answer rather than how well you understand the passage. Speed is trainable. Most candidates have never trained it.</p>
      <div className="wi-mini"><span>Daily · live</span><span>Part A</span><span>Timed</span></div>
    </>)
  },
  {
    n: "04", accent: "#7C5CFF", title: "Daily live articles from official OET sources", kicker: "The same wells the exam draws from",
    icon: <svg viewBox="0 0 24 24"><path d="M4 4h13a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H5a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z" /><path d="M7 8h7M7 12h7M7 16h4" /></svg>,
    body: (<>
      <p>Reading Part C extracts are not written from nothing — they are adapted from a known set of professional and academic sources.</p>
      <p>Every day we take an article <b>from the same sources the exam takes its extracts from</b> and work through it live. You get used to the register, the sentence length and the argument style before you ever meet them under timed conditions.</p>
      <div className="wi-mini"><span>Daily · live</span><span>Part C register</span></div>
    </>)
  },
  {
    n: "05", accent: "#F26B3A", title: "Daily listening podcasts", kicker: "Listening Part C, before the exam",
    icon: <svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 0-7 7v4" /><path d="M19 14v-4a7 7 0 0 0-7-7" /><rect x="3" y="13" width="4" height="7" rx="2" /><rect x="17" y="13" width="4" height="7" rx="2" /><path d="M19 20a3 3 0 0 1-3 3h-3" /></svg>,
    body: (<>
      <p>Listening Part C is presentation audio — a speaker with an opinion, an attitude and a structure you have to follow in one pass.</p>
      <p>A new podcast every day, drawn <b>from the same sources the official exam uses for Part C</b>, so you train daily on the exact listening register you will meet on the day. Accent range, pace and argument shape all included.</p>
      <div className="wi-mini"><span>Daily</span><span>Part C</span><span>Single-play habit</span></div>
    </>)
  },
  {
    n: "06", accent: "#E5484D", title: "Reading & Listening cheat sheets", kicker: "Hacks you apply inside the exam",
    icon: <svg viewBox="0 0 24 24"><path d="m15.5 3.5 5 5L9 20H4v-5Z" /><path d="M13.5 5.5 18 10" /><path d="M3 3.5 4.5 5 6 3.5 4.5 2Z" /></svg>,
    body: (<>
      <p>These are not summary notes. They are <b>decision rules you apply live, mid-paper</b> — what to do when two options both look right, when to abandon a question, how to handle a distractor you have seen before.</p>
      <p>Candidates who learned to use them have moved from <b>250 to 280</b> without changing anything else about their English.</p>
      <div className="wi-stat"><b>250 → 280</b><span>typical movement from the cheat sheets alone</span></div>
    </>)
  },
  {
    n: "07", accent: "#00A3A3", title: "OET Writing corrections", kicker: "Marked to all six official criteria",
    icon: <svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
    body: (<>
      <p>Your referral letters come back marked <b>line by line against the six official OET Writing criteria</b> — Purpose, Content, Conciseness &amp; Clarity, Genre &amp; Style, Organisation &amp; Layout and Language. The same system the examiners use.</p>
      <p>Every correction shows your current score, your projected Grade B score, and the exact lines to change. Marked by a human, not a model.</p>
      <div className="wi-mini"><span>Purpose</span><span>Content</span><span>Conciseness</span><span>Genre &amp; Style</span><span>Layout</span><span>Language</span></div>
    </>)
  },
  {
    n: "08", accent: "#4C8DFF", title: "Scheduled fixed classes", kicker: "You pick the day, the time and the class",
    icon: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="m10 15 2 2 3-3" /></svg>,
    body: (<>
      <p>On signing up you choose your start date, your class time and which sessions you want to sit.</p>
      <p>A fixed timetable is the difference between studying and intending to study. Shift workers can build the schedule around their roster instead of the other way round.</p>
      <div className="wi-mini"><span>Pick your date</span><span>Pick your time</span><span>Pick your classes</span></div>
    </>)
  },
  {
    n: "09", accent: "#F5A524", title: "OET Score Guarantee", kicker: "Two conditions. One outcome.",
    icon: <svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.2 8.3 8 9 4.8-.7 8-4.5 8-9V6Z" /><path d="m9 12 2 2 4-4" /></svg>,
    body: (<>
      <p>Meet both conditions before you sit the real exam and you clear it 90% of the time:</p>
      <p><b>One —</b> clear the OET HQ Reading and Listening past papers.<br />
        <b>Two —</b> hold above 70% on your Pass Predictor.</p>
      <p>That is exactly why we tell candidates not to book until the data says so. The guarantee is not marketing; it is the rule we use to decide when you are ready.</p>
      <div className="wi-stat"><b>90%</b><span>clearance when both conditions are met</span></div>
    </>)
  }
];

export function WebsiteWhatsInside() {
  const [open, setOpen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  // Reveal on scroll — tracked in React state (via each element's data-reveal key)
  // so re-renders (e.g. opening a row) can't strip the reveal class off the DOM.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      setRevealed(new Set(targets.map((t) => t.dataset.reveal as string)));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      const hits: string[] = [];
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        hits.push((e.target as HTMLElement).dataset.reveal as string);
        io.unobserve(e.target);
      });
      if (hits.length) setRevealed((prev) => { const n = new Set(prev); hits.forEach((h) => n.add(h)); return n; });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <section className="wi-section" id="whats-inside">
      <div className="wi-wrap" ref={rootRef}>
        <div className="wi-head">
          <span className="wi-pill wi-lbl">What&apos;s inside OET HQ</span>
          <h2>Nine things you get. <em>All nine matter.</em></h2>
          <p>Tap any line to see exactly what it means and why it moves your score.</p>
        </div>

        <div className="wi-list">
          {ITEMS.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.n} data-reveal={`r${i}`} className={"wi-row" + (revealed.has(`r${i}`) ? " wi-in" : "") + (isOpen ? " wi-open" : "")} style={{ ["--accent" as string]: it.accent } as React.CSSProperties}>
                <button type="button" className="wi-bar" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                  <span className="wi-n">{it.n}</span>
                  <span className="wi-ic" aria-hidden>{it.icon}</span>
                  <span className="wi-ttl">
                    <h3>{it.title}</h3>
                    <span className="wi-kicker">{it.kicker}</span>
                  </span>
                  <span className="wi-tg" aria-hidden><i /><u /></span>
                </button>
                <div className="wi-panel"><div className="wi-panel-in"><div className="wi-panel-body">{it.body}</div></div></div>
              </div>
            );
          })}
        </div>

        <div className={"wi-foot" + (revealed.has("foot") ? " wi-in" : "")} data-reveal="foot">
          <p><b>All nine are inside the OET Complete Material.</b>
            <span>Single-skill courses carry the ones that apply to that skill.</span></p>
          <Link className="wi-btn" href="/#courses">See the courses <span aria-hidden>→</span></Link>
        </div>
      </div>
    </section>
  );
}
