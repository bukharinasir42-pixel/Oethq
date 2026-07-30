"use client";

/**
 * /checkout/product?purchase=<id> — secure checkout for a standalone course.
 * Shows the order summary and completes the purchase (which grants the
 * entitlement), then sends the customer to their dashboard. Stripe is not
 * configured locally, so completion uses the staging path — swap for a real
 * Stripe redirect in startCheckout when keys are added.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { productsApi } from "@/lib/products-api";
import { getToken } from "@/lib/api";

type PurchaseView = { id: string; status: string; amount: number; currency: string; isUpgrade?: boolean; listPrice?: number; credit?: number; product: { name: string; slug: string; durationDays: number | null; includedSkills: string[]; priceLabel: string } };

const money = (n: number, ccy = "USD") => `${ccy === "USD" ? "$" : ccy + " "}${Number.isInteger(n) ? n : n.toFixed(2)}`;

function ProductCheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const purchaseId = params.get("purchase");
  const [purchase, setPurchase] = useState<PurchaseView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/auth/login?returnTo=${encodeURIComponent(`/checkout/product?purchase=${purchaseId ?? ""}`)}`);
      return;
    }
    if (!purchaseId) { setLoading(false); setError("Missing purchase reference."); return; }
    let active = true;
    productsApi.getPurchase(purchaseId)
      .then((p) => { if (active) { setPurchase(p as PurchaseView); setDone(p.status === "COMPLETED"); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load your order."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [purchaseId, router]);

  const complete = async () => {
    if (!purchaseId) return;
    setBusy(true); setError("");
    try {
      const res = await productsApi.resolve(purchaseId, "COMPLETED");
      if (res.ok) { setDone(true); setTimeout(() => router.push("/portal?enrolled=1"), 900); }
      else setError("Payment could not be completed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete checkout.");
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <div className="rounded-3xl border border-[#e4eaf6] bg-white p-8 shadow-[0_20px_48px_-24px_rgba(13,42,90,.28)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">Secure checkout</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-[#0B1B3F]">Confirm your enrolment</h1>

        {loading ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-[#64748F]"><Loader2 className="h-4 w-4 animate-spin" /> Loading your order…</p>
        ) : error && !purchase ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        ) : purchase ? (
          <>
            <div className="mt-6 rounded-2xl border border-[#eef2f9] bg-[#f7faff] p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold text-[#0B1B3F]">{purchase.product.name}</span>
                <span className="font-display text-lg font-bold text-[#0B1B3F]">{money(purchase.amount, purchase.currency)}</span>
              </div>
              <p className="mt-1 text-sm text-[#64748F]">
                {purchase.product.durationDays ? `${purchase.product.durationDays}-day access · ` : ""}
                {purchase.product.includedSkills.map((s) => s[0] + s.slice(1).toLowerCase()).join(" + ")}
              </p>
              {purchase.isUpgrade && purchase.credit ? (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                  <b>Upgrade pricing.</b> Full price {money(purchase.listPrice ?? 0, purchase.currency)} − {money(purchase.credit, purchase.currency)}
                  {" "}already paid = you pay only <b>{money(purchase.amount, purchase.currency)}</b>.
                </div>
              ) : null}
            </div>

            {done ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <Check className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
                <p className="mt-2 font-semibold text-emerald-800">Enrolment complete</p>
                <p className="mt-1 text-sm text-emerald-700">Taking you to your dashboard…</p>
                <Link href="/portal" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline">
                  Go to dashboard <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={complete}
                  disabled={busy}
                  className="mt-6 w-full rounded-xl bg-gradient-to-b from-[#3d8bf3] to-[#1f66d0] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(47,127,240,.6)] transition hover:brightness-105 disabled:opacity-60"
                >
                  {busy ? "Processing…" : `Pay ${money(purchase.amount, purchase.currency)} & enrol`}
                </button>
                {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#64748F]">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure checkout · your existing courses stay in your account
                </p>
              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

export default function ProductCheckoutPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-5 py-16 text-sm text-[#64748F]">Loading…</main>}>
      <ProductCheckoutInner />
    </Suspense>
  );
}
