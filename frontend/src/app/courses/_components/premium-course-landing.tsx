"use client";

/**
 * PremiumCourseLanding — the premium OET HQ standalone-course landing page.
 * The visual design (hero, OET HQ volume band, exercise library, comparison
 * table, live-cohort block, pillars, final CTA) is injected as scoped HTML from
 * ./bodies/<slug>.ts; the dynamic surface is wired in React:
 *   • {{PRICE}} / {{DUR}} tokens ← live product price + access window
 *   • [data-enrol] CTAs ← real login-if-needed → product checkout flow
 * All CSS lives under `.pcl` (see premium-course.css) so nothing leaks into the
 * shared site frame (OethqPageFrame nav/footer).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";
import { getToken } from "@/lib/api";
import { readingBody } from "./bodies/reading";
import { listeningBody } from "./bodies/listening";
import { readingListeningBody } from "./bodies/reading-listening";
import "./premium-course.css";

const BODY: Record<string, string> = {
  reading: readingBody,
  listening: listeningBody,
  "reading-listening": readingListeningBody,
};
const FALLBACK_PRICE: Record<string, string> = {
  reading: "$99",
  listening: "$99",
  "reading-listening": "$149",
};

export function PremiumCourseLanding({ slug }: { slug: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [product, setProduct] = useState<CatalogueProduct | null>(null);

  useEffect(() => {
    let active = true;
    productsApi.list()
      .then((r) => { if (active) setProduct(r.products.find((p) => p.slug === slug) ?? null); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [slug]);

  const enrol = useCallback(async (target: string) => {
    const landing = `/courses/${target}`;
    if (!getToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(landing + "?enrol=1")}`);
      return;
    }
    try {
      const res = await productsApi.checkout(target);
      router.push(res.checkoutUrl);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not start checkout. Please try again.");
    }
  }, [router]);

  // Delegate clicks on any [data-enrol] CTA to the real enrolment flow.
  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-enrol]");
    if (!el) return;
    e.preventDefault();
    const target = el.getAttribute("data-enrol");
    if (target) void enrol(target);
  }, [enrol]);

  // Auto-continue enrolment after returning from login (?enrol=1).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("enrol") === "1" && getToken() && (product?.isPurchasable ?? true)) {
      void enrol(slug);
    }
  }, [product, slug, enrol]);

  // Count-up the [data-to] volume figures when they scroll into view.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-to]"));
    if (!targets.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((el) => { el.textContent = el.dataset.to ?? el.textContent; });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        io.unobserve(el);
        const to = Number(el.dataset.to || 0);
        const dur = 1200;
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min((t - t0) / dur, 1);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        el.textContent = "0";
        requestAnimationFrame(step);
      });
    }, { threshold: 0.3 });
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [product, slug]);

  const priceLabel = product?.priceLabel || FALLBACK_PRICE[slug] || "";
  const dur = product?.durationDays ?? 60;
  const html = (BODY[slug] ?? "")
    .split("{{PRICE}}").join(priceLabel)
    .split("{{DUR}}").join(String(dur));

  return (
    <div className="pcl" ref={ref} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
