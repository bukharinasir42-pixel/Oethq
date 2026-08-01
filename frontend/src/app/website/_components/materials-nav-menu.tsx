"use client";

/**
 * MaterialsNavMenu — the single "Materials" dropdown for the website header.
 *
 * Replaces the old Courses + Materials pair. They listed the same products under
 * near-identical names, which gave a visitor two doors to the same three pages
 * and no way to tell them apart. One menu now carries everything: the flagship
 * OET Complete Material, then a card per skill.
 *
 * Each card shows the product name with "Course" as a small kicker — Material is
 * the name, course is what it is. Nothing about what a buyer unlocks changes;
 * the tiers on each landing page still decide that, and every tier includes the
 * scheduled cohort lectures.
 *
 * Prices are live from the catalogue — the flagship shows the cheapest paid
 * plan, each skill card the cheapest of its four tiers — so admin price edits
 * flow through without a deploy.
 *
 * Interaction is the one the old Courses menu used, so the header behaves as it
 * always did: hover-open with a close-intent delay on desktop, click/Esc/outside
 * click to close, and the same markup collapsing into the burger on mobile.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Headphones, Mic, PenLine } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";
import type { PlanDto } from "@/lib/types";

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

type Item = {
  name: string;
  /** Small kicker under the name. */
  kicker: string;
  skill: string;
  /** null = coming soon, rendered unclickable. */
  route: string | null;
  desc: string;
  /** Volume line — Writing and Speaking are not paper-based, so they omit it. */
  stats?: { mocks: string; papers: string };
  Icon: typeof BookOpen;
};

const ITEMS: Item[] = [
  {
    name: "OET Reading Material",
    kicker: "Course",
    skill: "READING",
    route: "/courses/reading",
    desc: "Part A speed and spelling, Part C opinion and attitude — sat exactly as on exam day.",
    stats: { mocks: "4–15", papers: "1–10" },
    Icon: BookOpen
  },
  {
    name: "OET Listening Material",
    kicker: "Course",
    skill: "LISTENING",
    route: "/courses/listening",
    desc: "Every audio plays once, no pause and no rewind — the real Listening pressure.",
    stats: { mocks: "4–15", papers: "1–10" },
    Icon: Headphones
  },
  {
    name: "OET Writing Corrections",
    kicker: "Course",
    skill: "WRITING",
    route: "/courses/writing",
    desc: "Your letters marked by a human against all six criteria, with the exact line to change.",
    Icon: PenLine
  },
  {
    name: "OET Speaking Role Plays",
    kicker: "Coming soon",
    skill: "SPEAKING",
    route: null,
    desc: "Role plays with the interlocutor cards and timing used on exam day.",
    Icon: Mic
  }
];

export function MaterialsNavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    productsApi.list().then((r) => { if (active) setProducts(r.products); }).catch(() => undefined);
    apiFetch<PlanDto[]>("/plans").then((r) => { if (active) setPlans(r); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const openNow = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const closeSoon = () => { closeTimer.current = setTimeout(() => setOpen(false), 140); };
  const navigate = () => { setOpen(false); onNavigate?.(); };

  const complete = products.find((p) => p.slug === "complete");
  /** Cheapest paid plan — the flagship's "from" price. */
  const completeFrom = (() => {
    const prices = plans
      .filter((pl) => pl.tier !== "STARTER" && (pl.isActive ?? true))
      .map((pl) => Number(pl.price))
      .filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : 249;
  })();
  /** Cheapest live tier for a skill. */
  const tierMin = (skill: string, fb: number) => {
    const prices = products
      .filter((p) => p.tierRank > 0 && p.includedSkills[0] === skill && !p.retired && p.price != null)
      .map((p) => Number(p.price))
      .filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : fb;
  };

  return (
    <div className="hp-courses" ref={wrapRef} onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        className="hp-courses-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Materials
        <ChevronDown className={`hp-courses-chev${open ? " up" : ""}`} aria-hidden />
      </button>

      <div className={`hp-courses-panel hp-mat-panel${open ? " open" : ""}`} role="menu" aria-label="Materials">
        <div className="hp-mat-head">
          <span className="hp-mat-eyebrow">One skill, or all four</span>
          <p className="hp-mat-lede">
            Cohort lectures, drills and exam-format papers — all on the official OET interface.
          </p>
        </div>

        {/* Flagship — every skill, always lit. */}
        <Link
          href={complete?.landingRoute || "/courses"}
          className="hp-cmenu-complete"
          role="menuitem"
          onClick={navigate}
        >
          <span className="hp-cmenu-complete-tag">Most complete · all four skills</span>
          <span className="hp-cmenu-complete-row">
            <span className="hp-cmenu-complete-title">{complete?.name || "OET Complete Material"}</span>
            <span className="hp-cmenu-complete-price">from {money(completeFrom)}</span>
          </span>
          <span className="hp-cmenu-complete-desc">Lectures, past papers, corrections &amp; the clearance-readiness score.</span>
        </Link>

        <div className="hp-cmenu-divider"><span>By skill</span></div>

        <ul className="hp-cmenu-list hp-mat-list">
          {ITEMS.map(({ name, kicker, skill, route, desc, stats, Icon }) => {
            const soon = route == null;
            const inner = (
              <>
                <span className="hp-mat-top">
                  <span className="hp-mat-ic" aria-hidden><Icon /></span>
                  <span className="hp-mat-name">
                    <span className="hp-mat-title">{name}</span>
                    <span className="hp-mat-kicker">{kicker}</span>
                  </span>
                  {!soon ? <span className="hp-mat-price">from {money(tierMin(skill, 39))}</span> : null}
                </span>
                <span className="hp-mat-desc">{desc}</span>
                {stats ? (
                  <span className="hp-mat-stats">
                    <span className="hp-mat-stat"><b>{stats.mocks}</b> mock tests</span>
                    <span className="hp-mat-dot" aria-hidden />
                    <span className="hp-mat-stat"><b>{stats.papers}</b> OET HQ past papers</span>
                    <span className="hp-mat-go" aria-hidden>→</span>
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={name} role="none">
                {soon ? (
                  <span className="hp-mat-card hp-mat-card--soon" aria-disabled="true">{inner}</span>
                ) : (
                  <Link href={route} className="hp-mat-card" role="menuitem" onClick={navigate}>{inner}</Link>
                )}
              </li>
            );
          })}
        </ul>

        <p className="hp-mat-foot">Four tiers on each page — pick the volume you need.</p>
      </div>
    </div>
  );
}
