"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const PROOF_ITEMS = [
  {
    initials: "SA",
    quote:
      '"I failed four times before this. The system changed how I read the exam — I passed and moved abroad."',
    meta: "Registered Nurse · Now in the UK"
  },
  {
    initials: "MK",
    quote:
      '"No shortcuts, just a system that works. The 2026-calibrated mocks felt exactly like the real thing."',
    meta: "Medical Doctor · Grade B, First Attempt"
  },
  {
    initials: "RF",
    quote: '"Skimming, inference, distractor elimination — skills nobody else taught. It finally clicked."',
    meta: "Pharmacist · Reading 380"
  }
] as const;

const DESTINATIONS = [
  "London",
  "Melbourne",
  "Dublin",
  "Manchester",
  "Sydney",
  "Auckland",
  "Toronto",
  "Dubai",
  "Glasgow",
  "Perth"
];

export function OethqAuthBrandPanel() {
  const [proofIndex, setProofIndex] = useState(0);
  const planeRef = useRef<SVGGElement>(null);
  const motionRef = useRef<SVGAnimateMotionElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const plane = planeRef.current;
    const motion = motionRef.current;
    if (!plane || !motion) return;

    const start = () => {
      plane.classList.add("go");
      try {
        motion.beginElement();
      } catch {
        // ignore
      }
    };

    if (reduced) {
      try {
        motion.setAttribute("dur", "0.01s");
        motion.beginElement();
      } catch {
        // ignore
      }
      plane.classList.add("go");
      return;
    }

    const t = window.setTimeout(start, 620);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || PROOF_ITEMS.length < 2) return;
    const id = window.setInterval(() => {
      setProofIndex((i) => (i + 1) % PROOF_ITEMS.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const orbs = document.querySelectorAll<HTMLElement>(".oet-hq-login .orb");
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      orbs.forEach((o) => {
        const d = Number(o.dataset.depth || 20);
        o.style.transform = `translate(${(e.clientX - cx) / d}px, ${(e.clientY - cy) / d}px)`;
      });
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  const tickerItems = [...DESTINATIONS, ...DESTINATIONS];

  return (
    <aside className="brand">
      <div className="orb orb-1" data-depth="18" />
      <div className="orb orb-2" data-depth="30" />

      <Link className="logo" href="/" aria-label="OET HQ home">
        <img src="/images/oethq/logo-login.png" alt="OET HQ — Your friends flew, now you!" />
      </Link>

      <div className="brand-center">
        <div className="eyebrow">OET Preparation · Candidate Portal</div>
        <h1>
          Your friends flew.
          <br />
          <em>Now you.</em>
        </h1>
        <p className="brand-sub">
          Sign in to continue your plan, timed practice, and readiness tracking — one engineered path from first
          lecture to exam-ready.
        </p>

        <div className="flight" aria-hidden="true">
          <svg viewBox="0 0 560 110" preserveAspectRatio="xMidYMid meet">
            <path
              id="fpath"
              className="fp-track"
              d="M8 88 C 120 84, 180 78, 260 62 C 350 44, 430 34, 548 16"
            />
            <path
              className="fp-progress"
              d="M8 88 C 120 84, 180 78, 260 62 C 350 44, 430 34, 548 16"
            />
            <circle className="fp-node n1" cx="8" cy="88" r="4.5" />
            <circle className="fp-node n2" cx="190" cy="76" r="4.5" />
            <circle className="fp-node n3" cx="365" cy="41" r="4.5" />
            <circle className="fp-node n4" cx="548" cy="16" r="4.5" />
            <text className="fp-label l1" x="8" y="106">
              Plan
            </text>
            <text className="fp-label l2" x="168" y="94">
              Practice
            </text>
            <text className="fp-label l3" x="340" y="60">
              2026 Mocks
            </text>
            <text className="fp-label l4" x="470" y="12">
              Exam-ready
            </text>
            <g className="fp-plane" id="fpPlane" ref={planeRef}>
              <path
                d="M0 0 L-11 4 L-8 0 L-11 -4 Z M-8 0 L-16 1.5 L-15 0 L-16 -1.5 Z"
                transform="scale(1.6)"
              />
              <animateMotion
                ref={motionRef as never}
                id="fpMotion"
                dur="3.6s"
                begin="indefinite"
                fill="freeze"
                rotate="auto"
                keyPoints="0;1"
                keyTimes="0;1"
                calcMode="spline"
                keySplines="0.45 0 0.2 1"
              >
                <mpath href="#fpath" />
              </animateMotion>
            </g>
          </svg>
        </div>
      </div>

      <div>
        <div className="proof">
          <div className="proof-quote">
            {PROOF_ITEMS.map((item, index) => (
              <div className={`proof-item${index === proofIndex ? " active" : ""}`} key={item.initials}>
                <div className="avatar">{item.initials}</div>
                <div>
                  <p>{item.quote}</p>
                  <small>{item.meta}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="proof-stats">
            <div className="stat">
              <b>40+</b>
              <span>Countries</span>
            </div>
            <div className="stat">
              <b>2026</b>
              <span>Calibrated Mocks</span>
            </div>
          </div>
        </div>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {tickerItems.map((place, i) => (
              <span key={`${place}-${i}`}>
                <i aria-hidden />
                {place}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
