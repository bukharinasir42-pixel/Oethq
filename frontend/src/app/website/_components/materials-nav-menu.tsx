"use client";

/**
 * MaterialsNavMenu — "Materials" dropdown for the website header.
 *
 * For candidates who do not want a taught course and only want papers to sit:
 * OET Reading Material and OET Listening Material. Both point at the existing
 * single-skill landing pages (/courses/reading, /courses/listening), which are
 * now presented as Material rather than Course. Nothing about what a buyer
 * unlocks changes — the tiers on those pages already decide that.
 *
 * Interaction mirrors CoursesNavMenu so the two behave identically: hover-open
 * with a close-intent delay on desktop, click/Esc/outside-click to close, and
 * the same markup collapsing into the burger on mobile.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Headphones } from "lucide-react";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

const ITEMS = [
  {
    name: "OET Reading Material",
    skill: "READING",
    route: "/courses/reading",
    desc: "Part A speed and spelling, Part C opinion and attitude — sat exactly as on exam day.",
    mocks: "4–15",
    papers: "1–10",
    Icon: BookOpen
  },
  {
    name: "OET Listening Material",
    skill: "LISTENING",
    route: "/courses/listening",
    desc: "Every audio plays once, no pause and no rewind — the real Listening pressure.",
    mocks: "4–15",
    papers: "1–10",
    Icon: Headphones
  }
] as const;

export function MaterialsNavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    productsApi.list().then((r) => { if (active) setProducts(r.products); }).catch(() => undefined);
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

  /** Cheapest live tier for a skill — the same "from" price the Courses menu shows. */
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
          <span className="hp-mat-eyebrow">Practice papers only</span>
          <p className="hp-mat-lede">
            No lectures, no drills — just exam-format papers on the official OET interface.
          </p>
        </div>

        <ul className="hp-cmenu-list hp-mat-list">
          {ITEMS.map(({ name, skill, route, desc, mocks, papers, Icon }) => (
            <li key={name} role="none">
              <Link href={route} className="hp-mat-card" role="menuitem" onClick={navigate}>
                <span className="hp-mat-top">
                  <span className="hp-mat-ic" aria-hidden><Icon /></span>
                  <span className="hp-mat-title">{name}</span>
                  <span className="hp-mat-price">from {money(tierMin(skill, 39))}</span>
                </span>
                <span className="hp-mat-desc">{desc}</span>
                <span className="hp-mat-stats">
                  <span className="hp-mat-stat"><b>{mocks}</b> mock tests</span>
                  <span className="hp-mat-dot" aria-hidden />
                  <span className="hp-mat-stat"><b>{papers}</b> OET HQ past papers</span>
                  <span className="hp-mat-go" aria-hidden>→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="hp-mat-foot">Four tiers on each page — pick the volume you need.</p>
      </div>
    </div>
  );
}
