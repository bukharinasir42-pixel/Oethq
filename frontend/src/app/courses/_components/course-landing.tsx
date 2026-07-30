"use client";

/**
 * CourseLanding — premium landing page for a standalone course. Renders editorial
 * copy from courses-catalogue.ts and live price/status from the /products catalogue.
 * The Enrol CTA runs the real journey: login (if needed) -> product checkout.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BookOpen, Check, ChevronDown, Clock, Headphones, Layers, ShieldCheck
} from "lucide-react";
import { COURSE_LANDING } from "@/lib/courses-catalogue";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";
import { getToken } from "@/lib/api";

function HeroIcon({ slug }: { slug: string }) {
  const cls = "h-7 w-7";
  if (slug === "reading") return <BookOpen className={cls} aria-hidden />;
  if (slug === "listening") return <Headphones className={cls} aria-hidden />;
  return <Layers className={cls} aria-hidden />;
}

export function CourseLanding({ slug }: { slug: string }) {
  const copy = COURSE_LANDING[slug];
  const router = useRouter();
  const [product, setProduct] = useState<CatalogueProduct | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    productsApi.list().then((r) => {
      if (!active) return;
      setCatalogue(r.products);
      setProduct(r.products.find((p) => p.slug === slug) ?? null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [slug]);

  const enrol = useCallback(async () => {
    if (!product || !product.isPurchasable) return;
    const landing = `/courses/${slug}`;
    if (!getToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(landing + "?enrol=1")}`);
      return;
    }
    setBusy(true); setError("");
    try {
      const res = await productsApi.checkout(slug);
      router.push(res.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout. Please try again.");
      setBusy(false);
    }
  }, [product, slug, router]);

  // Auto-continue enrolment after returning from login (?enrol=1).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("enrol") === "1" && product?.isPurchasable && getToken()) {
      void enrol();
    }
  }, [product, enrol]);

  if (!copy) return null;

  const priceLabel = product?.priceLabel ?? "";
  const durationDays = product?.durationDays ?? null;
  const purchasable = Boolean(product?.isPurchasable);
  const crossSell = copy.crossSell
    .map((s) => catalogue.find((p) => p.slug === s))
    .filter((p): p is CatalogueProduct => Boolean(p));

  return (
    <div className="oethq-rest bg-[#f7faff]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#f2f7ff]">
        <div className="mx-auto grid max-w-[1140px] items-center gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe6fb] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#2563EB]">
              <HeroIcon slug={slug} /> {copy.eyebrow}
            </span>
            <h1 className="mt-4 font-display text-[32px] font-extrabold leading-[1.08] tracking-tight text-[#0B1B3F] sm:text-[44px]">
              {copy.heroTitle}
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#43536b]">{copy.heroSubtitle}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enrol}
                disabled={!purchasable || busy}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-[#3d8bf3] to-[#1f66d0] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(47,127,240,.6)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Starting…" : purchasable ? "Enrol now" : "Enrolment opening soon"}
                {purchasable && !busy && <ArrowRight className="h-4 w-4" aria-hidden />}
              </button>
              <a href="#included" className="inline-flex items-center gap-1.5 rounded-xl border border-[#d9e3f4] bg-white px-5 py-3 text-sm font-semibold text-[#22335C] hover:border-[#b9d0f2]">
                See what&apos;s included
              </a>
            </div>
            {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
          </div>

          {/* Price card */}
          <div className="rounded-2xl border border-[#e4eaf6] bg-white p-6 shadow-[0_20px_48px_-24px_rgba(13,42,90,.3)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748F]">{copy.eyebrow}</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-display text-4xl font-extrabold text-[#0B1B3F]">{priceLabel || "—"}</span>
              {durationDays ? <span className="pb-1 text-sm text-[#64748F]">/ {durationDays}-day access</span> : null}
            </div>
            <ul className="mt-5 space-y-2.5">
              {copy.inclusionGroups.flatMap((g) => g.items).slice(0, 6).map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm text-[#22335C]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" aria-hidden /> {it}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={enrol}
              disabled={!purchasable || busy}
              className="mt-6 w-full rounded-xl bg-[#0B1B3F] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#132a52] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {purchasable ? "Enrol now" : "Opening soon"}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#64748F]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure checkout · instant access
            </p>
          </div>
        </div>
      </section>

      {/* PROBLEM + PROMISE */}
      <section className="mx-auto max-w-[1140px] px-5 py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[#e4eaf6] bg-white p-7">
            <h2 className="font-display text-xl font-bold text-[#0B1B3F]">{copy.problemTitle}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#43536b]">{copy.problem}</p>
          </div>
          <div className="rounded-2xl border border-[#1e5aa8]/20 bg-gradient-to-br from-[#0A3060] to-[#1465C8] p-7 text-white">
            <h2 className="font-display text-xl font-bold">{copy.promiseTitle}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/85">{copy.promise}</p>
          </div>
        </div>
      </section>

      {/* WHO FOR */}
      <section className="mx-auto max-w-[1140px] px-5 pb-4">
        <h2 className="text-center font-display text-[26px] font-extrabold text-[#0B1B3F]">{copy.whoForTitle}</h2>
        <div className="mx-auto mt-6 grid max-w-[980px] gap-4 sm:grid-cols-3">
          {copy.whoFor.map((w, i) => (
            <div key={i} className="rounded-2xl border border-[#e4eaf6] bg-white p-5 text-sm leading-relaxed text-[#22335C]">
              {w}
            </div>
          ))}
        </div>
      </section>

      {/* INCLUDED */}
      <section id="included" className="mx-auto max-w-[1140px] scroll-mt-24 px-5 py-14">
        <div className="mx-auto max-w-[680px] text-center">
          <h2 className="font-display text-[26px] font-extrabold text-[#0B1B3F]">What&apos;s included</h2>
          <p className="mt-2 text-[15px] text-[#43536b]">{copy.accessNote}</p>
        </div>
        <div className={`mx-auto mt-8 grid max-w-[900px] gap-5 ${copy.inclusionGroups.length > 1 ? "md:grid-cols-2" : ""}`}>
          {copy.inclusionGroups.map((g) => (
            <div key={g.heading} className="rounded-2xl border border-[#e4eaf6] bg-white p-6">
              <div className="mb-3 flex items-center gap-2">
                {g.heading.toLowerCase().includes("read") ? <BookOpen className="h-5 w-5 text-[#2563EB]" aria-hidden /> : <Headphones className="h-5 w-5 text-[#2563EB]" aria-hidden />}
                <h3 className="font-display text-lg font-bold text-[#0B1B3F]">{g.heading}</h3>
              </div>
              <ul className="space-y-2.5">
                {g.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-[#22335C]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" aria-hidden /> {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {durationDays ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[#64748F]">
            <Clock className="h-4 w-4" aria-hidden /> {durationDays}-day access from enrolment
          </p>
        ) : null}
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[820px] px-5 py-8">
        <h2 className="text-center font-display text-[26px] font-extrabold text-[#0B1B3F]">Frequently asked questions</h2>
        <div className="mt-6 space-y-3">
          {copy.faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-[#e4eaf6] bg-white px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#0B1B3F]">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-[#64748F] transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#43536b]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CROSS-SELL */}
      {crossSell.length > 0 && (
        <section className="mx-auto max-w-[1140px] px-5 py-14">
          <h2 className="text-center font-display text-[22px] font-extrabold text-[#0B1B3F]">Other ways to prepare</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {crossSell.map((p) => {
              const href = p.category === "COMPLETE" ? "/courses" : (p.landingRoute ?? "/courses");
              return (
                <Link key={p.slug} href={href} className="group flex flex-col rounded-2xl border border-[#e4eaf6] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c9dcfb] hover:shadow-[0_16px_34px_-18px_rgba(13,42,90,.26)]">
                  <p className="font-display text-base font-bold text-[#0B1B3F]">{p.name}</p>
                  <p className="mt-1 flex-1 text-[13px] leading-relaxed text-[#43536b]">{p.shortDescription}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB]">
                    {p.category === "COMPLETE" ? "See packages" : "View course"} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="mx-auto max-w-[1140px] px-5 pb-20">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-r from-[#0A3060] to-[#1465C8] px-6 py-12 text-center text-white">
          <h2 className="font-display text-[26px] font-extrabold sm:text-[30px]">{copy.heroTitle}</h2>
          <p className="max-w-xl text-white/85">{copy.promise}</p>
          <button
            type="button"
            onClick={enrol}
            disabled={!purchasable || busy}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-bold text-[#0B1B3F] transition hover:bg-[#eaf2fc] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {purchasable ? `Enrol now — ${priceLabel}` : "Enrolment opening soon"}
            {purchasable && <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </section>
    </div>
  );
}
