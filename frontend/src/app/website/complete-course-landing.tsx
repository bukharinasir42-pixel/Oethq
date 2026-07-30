"use client";

/**
 * CompleteCourseLanding — the OET Complete Course plans page (client
 * complete-course.html), injected as scoped HTML under `.ccp`. Prices/copy are
 * static per the design; the tier CTAs are wired in React to the real flow:
 *   • paid tiers → /checkout?plan=<live plan id> (mapped by tier)
 *   • Free tier  → the free-trial signup (portal?selectTier=STARTER)
 * The big "full comparison" table is collapsed behind a toggle (keeps the page
 * short) and opens on click — or when a "Compare" link is used. `embedded`
 * renders only the plan cards + comparison (for the homepage "clearance" slot).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import type { PlanDto } from "@/lib/types";
import { CC_HERO, CC_PLANS, CC_DAY45, CC_COMPARE, CC_PROOF, CC_FAQ, CC_CTA } from "./complete-course-body";
import "./complete-course.css";
import "./complete-course-overrides.css";

// DOM order of the plan CTAs (free-strip + 4 plan cards / compare columns).
const TIERS = ["FREE", "FOUNDATION", "ACCELERATOR", "MASTERY", "CUSTOM"] as const;

export function CompleteCourseLanding({ embedded = false, anchorId }: { embedded?: boolean; anchorId?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [planIds, setPlanIds] = useState<Record<string, string>>({});
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<PlanDto[]>("/plans", { token: null })
      .then((rows) => {
        if (!active) return;
        const m: Record<string, string> = {};
        (rows ?? []).forEach((p) => { if (p.tier) m[p.tier] = p.id; });
        setPlanIds(m);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const pre = useMemo(() => (embedded ? CC_PLANS : CC_HERO + CC_PLANS + CC_DAY45), [embedded]);
  const post = useMemo(() => (embedded ? "" : CC_PROOF + CC_FAQ + CC_CTA), [embedded]);

  const go = useCallback((tier: string) => {
    if (tier === "FREE") {
      const dest = "/portal?selectTier=STARTER";
      router.push(getToken() ? dest : `/auth/register?returnTo=${encodeURIComponent(dest)}`);
      return;
    }
    const id = planIds[tier];
    router.push(id ? `/checkout?plan=${id}` : "/#pricing");
  }, [planIds, router]);

  // Tag the design's CTAs (which carry no plan info) with a data-plan by DOM order.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const planBtns = Array.from(root.querySelectorAll<HTMLElement>(".free-strip a.btn-block, .plans .plan a.btn-block"));
    planBtns.forEach((el, i) => { if (TIERS[i]) el.dataset.plan = TIERS[i]; });
    const heroBtn = root.querySelector<HTMLElement>(".hero .hero-actions a.btn-primary");
    if (heroBtn) heroBtn.dataset.plan = "FREE";
    const cmpBtns = Array.from(root.querySelectorAll<HTMLElement>("table.compare tbody tr:last-child a.btn"));
    cmpBtns.forEach((el, i) => { if (TIERS[i]) el.dataset.plan = TIERS[i]; });
  }, [pre, post, showCompare]);

  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    // "Compare side by side" / "See what refreshes" links open the comparison.
    const cmpLink = t.closest<HTMLAnchorElement>('a[href$="#compare"]');
    if (cmpLink) {
      e.preventDefault();
      setShowCompare(true);
      requestAnimationFrame(() => ref.current?.querySelector("#compare")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    const el = t.closest<HTMLElement>("[data-plan]");
    if (!el) return;
    e.preventDefault();
    go(el.dataset.plan as string);
  }, [go]);

  // Comparison table: mobile single-column picker (re-implements the design's script).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const picker = root.querySelector<HTMLElement>(".mob-picker");
    const table = root.querySelector<HTMLElement>("table.compare");
    if (!picker || !table) return;
    const show = (col: string) => {
      picker.querySelectorAll<HTMLElement>("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.col === col ? "true" : "false"));
      table.querySelectorAll<HTMLElement>("[data-col]").forEach((c) => { c.style.display = c.dataset.col === col ? "" : "none"; });
    };
    const apply = () => {
      const active = picker.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (window.matchMedia("(max-width:720px)").matches) show(active ? (active.dataset.col as string) : "3");
      else table.querySelectorAll<HTMLElement>("[data-col]").forEach((c) => { c.style.display = ""; });
    };
    const onPick = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("button");
      if (b && b.dataset.col) show(b.dataset.col);
    };
    picker.addEventListener("click", onPick);
    window.addEventListener("resize", apply);
    apply();
    return () => { picker.removeEventListener("click", onPick); window.removeEventListener("resize", apply); };
  }, [showCompare]);

  return (
    <div id={anchorId} className="ccp" ref={ref} onClick={onClick}>
      <div dangerouslySetInnerHTML={{ __html: pre }} />
      <div style={{ display: "flex", justifyContent: "center", padding: "14px 22px 2px" }}>
        <button
          type="button"
          aria-expanded={showCompare}
          onClick={() => setShowCompare((v) => !v)}
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14.5,
            color: "#1F6BFF", background: "#fff", border: "1px solid #DFE7F3", borderRadius: 12,
            padding: "13px 24px", cursor: "pointer", boxShadow: "0 1px 2px rgba(7,22,48,.06),0 6px 18px rgba(7,22,48,.06)"
          }}
        >
          {showCompare ? "Hide the full comparison ▲" : "See the full comparison — every line, side by side ▼"}
        </button>
      </div>
      {showCompare ? <div dangerouslySetInnerHTML={{ __html: CC_COMPARE }} /> : null}
      {post ? <div dangerouslySetInnerHTML={{ __html: post }} /> : null}
    </div>
  );
}
