"use client";

/**
 * SkillCourseLanding — the tiered single-skill course landing (Reading / Listening
 * / Writing). Each page offers four price tiers (Foundation / Momentum / Precision
 * / Mega). The client HTML design is injected as scoped HTML from
 * ./bodies/course-<skill>.ts; the dynamic surface is wired in React:
 *   • the four plan + comparison CTAs ← the four live tier products, in DOM order
 *   • live tier prices ← the catalogue (admin-editable), injected into the cards
 *   • CTA click ← real login-if-needed → product checkout flow
 * All CSS lives under `.scl` (see skill-course.css) so nothing leaks into the
 * shared site frame (OethqPageFrame nav/footer).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";
import { getToken } from "@/lib/api";
import { courseReadingBody } from "./bodies/course-reading";
import { courseListeningBody } from "./bodies/course-listening";
import { courseWritingBody } from "./bodies/course-writing";
import "./skill-course.css";

type SkillSlug = "reading" | "listening" | "writing";

const BODY: Record<SkillSlug, string> = {
  reading: courseReadingBody,
  listening: courseListeningBody,
  writing: courseWritingBody,
};
const SKILL_ENUM: Record<SkillSlug, string> = {
  reading: "READING",
  listening: "LISTENING",
  writing: "WRITING",
};

export function SkillCourseLanding({ skill }: { skill: SkillSlug }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);

  useEffect(() => {
    let active = true;
    productsApi.list()
      .then((r) => { if (active) setProducts(r.products); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // The four tiers of THIS course, ordered Foundation → Mega.
  const tiers = useMemo(() => {
    const wanted = SKILL_ENUM[skill];
    return products
      .filter((p) => p.tierRank > 0 && p.includedSkills[0] === wanted && !p.retired)
      .sort((a, b) => a.tierRank - b.tierRank);
  }, [products, skill]);

  const enrol = useCallback(async (targetSlug: string) => {
    const landing = `/courses/${skill}`;
    if (!getToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(`${landing}?enrol=${targetSlug}`)}`);
      return;
    }
    try {
      const res = await productsApi.checkout(targetSlug);
      router.push(res.checkoutUrl);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not start checkout. Please try again.");
    }
  }, [router, skill]);

  // Tag the CTAs (4 plan cards + 4 comparison rows, in DOM order) with their tier
  // slug and inject the live tier prices into the cards / comparison / picker.
  useEffect(() => {
    const root = ref.current;
    if (!root || tiers.length < 4) return;

    const ctas = Array.from(root.querySelectorAll<HTMLAnchorElement>("a.btn-block"));
    ctas.forEach((a, i) => { a.dataset.tier = tiers[i % 4]?.slug ?? ""; });

    const setText = (sel: string, fmt: (t: CatalogueProduct) => string) => {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(sel));
      nodes.slice(0, 4).forEach((n, i) => { if (tiers[i]) n.textContent = fmt(tiers[i]); });
    };
    setText(".plans .plan .price .amt", (t) => String(t.price ?? ""));
    setText("table.compare thead .col-price", (t) => `US$${t.price ?? ""}`);
    setText(".mob-picker button b", (t) => `$${t.price ?? ""}`);

    const min = Math.min(...tiers.map((t) => Number(t.price ?? Infinity)).filter(Number.isFinite));
    const sticky = root.querySelector<HTMLElement>(".sticky-buy .sb-txt b");
    if (sticky && Number.isFinite(min)) sticky.textContent = `From US$${min}`;
  }, [tiers]);

  // Delegate CTA clicks to the real enrolment flow.
  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("a[data-tier]");
    if (!el) return;
    const target = el.dataset.tier;
    if (!target) return;
    e.preventDefault();
    void enrol(target);
  }, [enrol]);

  // Auto-continue enrolment after returning from login (?enrol=<slug>).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("enrol");
    if (t && getToken() && tiers.some((x) => x.slug === t)) void enrol(t);
  }, [tiers, enrol]);

  // Mobile comparison picker (single-column on phones) + listening waveform.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // waveform (listening only)
    const wv = root.querySelector<HTMLElement>("#wv");
    if (wv && !wv.childElementCount) {
      const h = [9, 16, 24, 13, 28, 19, 11, 22, 30, 17, 8, 20, 26, 14, 23, 10, 18, 27, 12, 21, 15, 25, 9, 19, 29, 13, 17, 11, 24, 16, 20, 8, 22, 14, 26, 18];
      h.forEach((v, i) => { const b = document.createElement("i"); b.style.height = `${v}px`; if (i < 11) b.className = "on"; wv.appendChild(b); });
    }

    // comparison picker
    const picker = root.querySelector<HTMLElement>(".mob-picker");
    const table = root.querySelector<HTMLTableElement>("table.compare");
    if (!picker || !table) return;
    const show = (col: string) => {
      picker.querySelectorAll<HTMLElement>("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.col === col ? "true" : "false"));
      table.querySelectorAll<HTMLElement>("[data-col]").forEach((c) => { c.style.display = c.dataset.col === col ? "" : "none"; });
    };
    const apply = () => {
      const a = picker.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (window.matchMedia("(max-width:720px)").matches) show(a ? a.dataset.col ?? "3" : "3");
      else table.querySelectorAll<HTMLElement>("[data-col]").forEach((c) => { c.style.display = ""; });
    };
    const onPick = (e: Event) => { const b = (e.target as HTMLElement).closest<HTMLElement>("button"); if (b?.dataset.col) show(b.dataset.col); };
    picker.addEventListener("click", onPick);
    window.addEventListener("resize", apply);
    apply();
    return () => { picker.removeEventListener("click", onPick); window.removeEventListener("resize", apply); };
  }, [tiers, skill]);

  return (
    <div className="scl" ref={ref} onClick={onClick} dangerouslySetInnerHTML={{ __html: BODY[skill] }} />
  );
}
