"use client";

/**
 * CoursesNavMenu — "skill-first" Courses dropdown for the website header.
 * A compact panel: pick a skill (Reading / Listening / Writing / Speaking) and
 * the courses that cover it light up while the rest dim. The Complete Course sits
 * on top as a persistent flagship; the three Writing-correction packages collapse
 * into one "Writing Corrections · from $X" entry (the tiers live on its landing).
 *
 * Desktop: hover-open with close-intent delay + click/focus; Esc + outside-click
 * close it. Mobile: same markup renders as a tap-expand accordion in the burger.
 * Prices/routes come from the live /products + /plans catalogue.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Headphones, Lock, Mic, PenLine } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";
import type { PlanDto } from "@/lib/types";

type SkillKey = "READING" | "LISTENING" | "WRITING" | "SPEAKING";

const SKILLS: { key: SkillKey; label: string; Icon: typeof BookOpen }[] = [
  { key: "READING", label: "Reading", Icon: BookOpen },
  { key: "LISTENING", label: "Listening", Icon: Headphones },
  { key: "WRITING", label: "Writing", Icon: PenLine },
  { key: "SPEAKING", label: "Speaking", Icon: Mic }
];

type FocusedItem = {
  name: string;
  skills: SkillKey[];
  route: string | null;
  price: number | null;
  fromPrice?: boolean;
  soon?: boolean;
  Icon: typeof BookOpen;
};

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function CoursesNavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [activeSkill, setActiveSkill] = useState<SkillKey | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    productsApi.list().then((r) => { if (active) setProducts(r.products); }).catch(() => undefined);
    apiFetch<PlanDto[]>("/plans", { token: null }).then((r) => { if (active) setPlans(r); }).catch(() => undefined);
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
  const navigate = () => { setOpen(false); setActiveSkill(null); onNavigate?.(); };

  // ---- dynamic prices/routes ----
  const bySlug = (slug: string) => products.find((p) => p.slug === slug);
  const priceOf = (slug: string, fb: number) => {
    const p = bySlug(slug);
    return p && p.price != null ? Number(p.price) : fb;
  };
  const paidPlanPrices = plans
    .filter((pl) => pl.tier !== "STARTER" && (pl.isActive ?? true))
    .map((pl) => Number(pl.price)).filter((n) => n > 0);
  const completeFrom = paidPlanPrices.length ? Math.min(...paidPlanPrices) : 249;
  const complete = bySlug("complete");
  // Single-skill courses now have four price tiers (Foundation → Mega).
  const tierMin = (skillEnum: string, fb: number) => {
    const prices = products
      .filter((p) => p.tierRank > 0 && p.includedSkills[0] === skillEnum && !p.retired && p.price != null)
      .map((p) => Number(p.price)).filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : fb;
  };
  const speaking = bySlug("speaking-role-plays");

  const focused: FocusedItem[] = [
    { name: "OET Reading", skills: ["READING"], route: "/courses/reading", price: tierMin("READING", 39), fromPrice: true, Icon: BookOpen },
    { name: "OET Listening", skills: ["LISTENING"], route: "/courses/listening", price: tierMin("LISTENING", 39), fromPrice: true, Icon: Headphones },
    { name: "OET Writing", skills: ["WRITING"], route: "/courses/writing", price: tierMin("WRITING", 39), fromPrice: true, Icon: PenLine },
    { name: "Speaking Role Plays", skills: ["SPEAKING"], route: null, price: null, soon: (speaking?.status ?? "COMING_SOON") !== "ACTIVE", Icon: Mic }
  ];

  const dimmed = (skills: SkillKey[]) => activeSkill != null && !skills.includes(activeSkill);
  const hot = (skills: SkillKey[]) => activeSkill != null && skills.includes(activeSkill);

  return (
    <div className="hp-courses" ref={wrapRef} onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        className="hp-courses-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Courses
        <ChevronDown className={`hp-courses-chev${open ? " up" : ""}`} aria-hidden />
      </button>

      <div
        className={`hp-courses-panel${open ? " open" : ""}`}
        role="menu"
        aria-label="Courses"
        onMouseLeave={() => setActiveSkill(null)}
      >
        {/* Skill picker */}
        <div className="hp-cmenu-pickrow">
          <span className="hp-cmenu-picklbl">Which skill do you need?</span>
          <div className="hp-cmenu-pills" role="group" aria-label="Filter by skill">
            {SKILLS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={`hp-cmenu-pill${activeSkill === key ? " active" : ""}`}
                title={label}
                aria-pressed={activeSkill === key}
                onMouseEnter={() => setActiveSkill(key)}
                onClick={() => setActiveSkill((s) => (s === key ? null : key))}
              >
                <Icon aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Flagship — covers every skill, always lit */}
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

        <div className="hp-cmenu-divider"><span>Focused courses</span></div>

        <ul className="hp-cmenu-list">
          {focused.map((f) => {
            const locked = f.soon || !f.route;
            const cls = `hp-cmenu-item${locked ? " locked" : ""}${dimmed(f.skills) ? " dim" : ""}${hot(f.skills) ? " hot" : ""}`;
            const Icon = f.Icon;
            const inner = (
              <>
                <span className="hp-cmenu-ic-wrap" aria-hidden><Icon className="hp-cmenu-ic" /></span>
                <span className="hp-cmenu-item-name">
                  {f.name}
                  {locked && <span className="hp-cmenu-soon">Coming soon</span>}
                </span>
                {locked ? (
                  <Lock className="hp-cmenu-lock" aria-hidden />
                ) : (
                  <span className="hp-cmenu-tail">
                    {f.price != null && <span className="hp-cmenu-price">{f.fromPrice ? "from " : ""}{money(f.price)}</span>}
                    <span className="hp-cmenu-arrow" aria-hidden>→</span>
                  </span>
                )}
              </>
            );
            return (
              <li key={f.name} role="none">
                {locked ? (
                  <span className={cls} role="menuitem" aria-disabled="true">{inner}</span>
                ) : (
                  <Link href={f.route as string} className={cls} role="menuitem" onClick={navigate}>{inner}</Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
