"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ComparePlanInput = {
  tier: "FREE" | "FOUNDATION" | "ACCELERATOR" | "MASTERY";
  priceAmount: string | null;
  durationDays: number;
  pastPaperLimit: number;
  readingLimit: number;
  listeningLimit: number;
  featured?: boolean;
};

const COLUMN_LABEL: Record<ComparePlanInput["tier"], string> = {
  FREE: "Free",
  FOUNDATION: "Foundation",
  ACCELERATOR: "Precision",
  MASTERY: "Elite"
};

const CheckIcon = () => (
  <span className="check">
    <svg viewBox="0 0 24 24">
      <path d="M4 12l5 5L20 7" />
    </svg>
  </span>
);

function formatDurationLabel(days: number) {
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? "1 month" : `${months} months`;
  }
  return `${days} days`;
}

function priceSubline(plan: ComparePlanInput) {
  if (plan.tier === "FREE" || plan.priceAmount === null) {
    return `$0 · ${plan.durationDays}-day trial`;
  }
  return `US$${plan.priceAmount} · ${formatDurationLabel(plan.durationDays)}`;
}

function NumCell({ value, featured }: { value: number; featured?: boolean }) {
  if (!value) {
    return <td className={cn("dash", featured && "feat-col")}>—</td>;
  }
  return <td className={cn("num", featured && "feat-col")}>{value}</td>;
}

function CheckCell({ included, featured }: { included: boolean; featured?: boolean }) {
  if (!included) {
    return <td className={cn("dash", featured && "feat-col")}>—</td>;
  }
  return (
    <td className={featured ? "feat-col" : undefined}>
      <CheckIcon />
    </td>
  );
}

function TextCell({ children, featured }: { children: ReactNode; featured?: boolean }) {
  return (
    <td className={featured ? "feat-col" : undefined} style={{ fontSize: "12.5px", color: "var(--muted)" }}>
      {children}
    </td>
  );
}

function PillCell({ label, featured }: { label: string; featured?: boolean }) {
  return (
    <td className={featured ? "feat-col" : undefined}>
      <span className="pill">{label}</span>
    </td>
  );
}

/** Qualitative rows not returned by GET /plans — still tier-based. */
const QUALITATIVE = {
  readingLecture: ["text", "check", "check", "check"] as const,
  otherLectures: ["dash", "check", "check", "check"] as const,
  vocabPdf: ["dash", "check", "check", "check"] as const,
  cheatSheets: ["dash", "dash", "check", "check"] as const,
  examSim: ["dash", "basic", "full", "full"] as const,
  proctored: ["dash", "dash", "check", "check"] as const,
  writing: [0, 3, 7, 15] as const,
  whatsapp: ["dash", "dash", "check", "check"] as const,
  analytics: ["dash", "dash", "check", "check"] as const
};

type QualKind = "dash" | "check" | "text" | "basic" | "full";

function QualCell({ kind, featured }: { kind: QualKind; featured?: boolean }) {
  if (kind === "dash") return <td className={cn("dash", featured && "feat-col")}>—</td>;
  if (kind === "check") return <CheckCell included featured={featured} />;
  if (kind === "basic") return <TextCell featured={featured}>Basic</TextCell>;
  if (kind === "full") return <PillCell label="Full Exam" featured={featured} />;
  return <TextCell featured={featured}>1 lecture</TextCell>;
}

const TIER_ORDER = ["FREE", "FOUNDATION", "ACCELERATOR", "MASTERY"] as const;

type Props = {
  plans?: ComparePlanInput[];
};

export function OethqCompareFeatures({ plans = [] }: Props) {
  const [open, setOpen] = useState(false);

  const ordered: ComparePlanInput[] =
    plans.length > 0
      ? TIER_ORDER.map((tier) => plans.find((p) => p.tier === tier)).filter(
          (p): p is ComparePlanInput => Boolean(p)
        )
      : TIER_ORDER.map((tier) => ({
          tier,
          priceAmount: tier === "FREE" ? null : "0",
          durationDays: tier === "FREE" ? 5 : 60,
          pastPaperLimit: 0,
          readingLimit: 0,
          listeningLimit: 0,
          featured: tier === "ACCELERATOR"
        }));

  const colSpan = ordered.length + 1;

  const qualIndex = (tier: ComparePlanInput["tier"]) => TIER_ORDER.indexOf(tier);

  return (
    <>
      <button
        type="button"
        className="compare-toggle"
        aria-expanded={open}
        aria-controls="compare"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide full comparison" : "Compare all features"}
        <svg viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div id="compare" className={open ? "open" : undefined}>
        <div className="table-scroll">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Features</th>
                  {ordered.map((plan) => (
                    <th key={plan.tier} className={plan.featured ? "feat-col" : undefined}>
                      {COLUMN_LABEL[plan.tier]}
                      <span
                        className="p"
                        style={plan.featured ? { color: "var(--blue)" } : undefined}
                      >
                        {priceSubline(plan)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="group-row">
                  <td colSpan={colSpan}>OET HQ Past Papers</td>
                </tr>
                <tr>
                  <td>OET HQ Reading past papers</td>
                  {ordered.map((plan) => (
                    <NumCell key={`${plan.tier}-pp-r`} value={plan.pastPaperLimit} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>OET HQ Listening past papers</td>
                  {ordered.map((plan) => (
                    <NumCell key={`${plan.tier}-pp-l`} value={plan.pastPaperLimit} featured={plan.featured} />
                  ))}
                </tr>

                <tr className="group-row">
                  <td colSpan={colSpan}>Expert-Led Lectures</td>
                </tr>
                <tr>
                  <td>Recorded Reading lectures</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-lec-r`} kind={QUALITATIVE.readingLecture[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Recorded Listening lectures</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-lec-l`} kind={QUALITATIVE.otherLectures[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Recorded Writing lectures</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-lec-w`} kind={QUALITATIVE.otherLectures[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Recorded Speaking lectures</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-lec-s`} kind={QUALITATIVE.otherLectures[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>

                <tr className="group-row">
                  <td colSpan={colSpan}>Downloadable Resources</td>
                </tr>
                <tr>
                  <td>Reading vocabulary PDF</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-vocab-r`} kind={QUALITATIVE.vocabPdf[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Listening Part A vocabulary PDF</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-vocab-l`} kind={QUALITATIVE.vocabPdf[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Reading B &amp; C cheat sheets</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-cheat-r`} kind={QUALITATIVE.cheatSheets[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Listening B &amp; C cheat sheets</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-cheat-l`} kind={QUALITATIVE.cheatSheets[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>

                <tr className="group-row">
                  <td colSpan={colSpan}>Practice &amp; Simulation</td>
                </tr>
                <tr>
                  <td>Reading mock tests</td>
                  {ordered.map((plan) => (
                    <NumCell key={`${plan.tier}-mock-r`} value={plan.readingLimit} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Listening mock tests</td>
                  {ordered.map((plan) => (
                    <NumCell key={`${plan.tier}-mock-l`} value={plan.listeningLimit} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Exam simulation</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-sim`} kind={QUALITATIVE.examSim[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Proctored practice system</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-proc`} kind={QUALITATIVE.proctored[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>

                <tr className="group-row">
                  <td colSpan={colSpan}>Writing Support</td>
                </tr>
                <tr>
                  <td>Writing corrections</td>
                  {ordered.map((plan) => (
                    <NumCell key={`${plan.tier}-write`} value={QUALITATIVE.writing[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>

                <tr className="group-row">
                  <td colSpan={colSpan}>Community &amp; Accountability</td>
                </tr>
                <tr>
                  <td>WhatsApp accountability group by Dr. Nasir</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-wa`} kind={QUALITATIVE.whatsapp[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>

                <tr className="group-row">
                  <td colSpan={colSpan}>Score Intelligence</td>
                </tr>
                <tr>
                  <td>Performance analytics dashboard</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-an1`} kind={QUALITATIVE.analytics[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Weak-area identification system</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-an2`} kind={QUALITATIVE.analytics[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Clearance prediction score</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-an3`} kind={QUALITATIVE.analytics[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
                <tr>
                  <td>Priority support</td>
                  {ordered.map((plan) => (
                    <QualCell key={`${plan.tier}-an4`} kind={QUALITATIVE.analytics[qualIndex(plan.tier)]} featured={plan.featured} />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
