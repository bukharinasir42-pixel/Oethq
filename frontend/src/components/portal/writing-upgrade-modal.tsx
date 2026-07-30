"use client";

/**
 * WritingUpgradeModal — popup shown from the portal Writing page when a student
 * has no writing corrections left. Lists the standalone correction packs (2/6/12)
 * and the tiered Writing Course, and starts an in-portal product checkout so the
 * student never leaves the portal onto a page that could redirect them away.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, PenLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";

export function WritingUpgradeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    productsApi.list().then((r) => { if (active) setProducts(r.products); }).catch(() => undefined);
    return () => { active = false; };
  }, [open]);

  // Correction packs (ADDON) first, ordered by letters; then the Writing Course tiers.
  const packs = products
    .filter((p) => p.status === "ACTIVE" && p.isPurchasable && !p.retired && p.includedSkills.includes("WRITING") && (p.writingCorrections ?? 0) > 0 && p.tierRank === 0)
    .sort((a, b) => (a.writingCorrections ?? 0) - (b.writingCorrections ?? 0));
  const tiers = products
    .filter((p) => p.status === "ACTIVE" && p.isPurchasable && !p.retired && p.includedSkills.includes("WRITING") && p.tierRank > 0)
    .sort((a, b) => a.tierRank - b.tierRank);

  const buy = async (slug: string) => {
    setBusy(slug);
    try {
      const res = await productsApi.checkout(slug);
      onOpenChange(false);
      router.push(res.checkoutUrl);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not start checkout. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ p, sub }: { p: CatalogueProduct; sub: string }) => (
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => void buy(p.slug)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.04] disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
        <span className="block text-xs text-muted-foreground">{p.priceLabel} · {sub}</span>
      </span>
      {busy === p.slug ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden /> : <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" aria-hidden /> Get more writing corrections
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Add more human-marked corrections. Buy a correction pack for marking only, or move up to a Writing Course
          tier for the drills, cheat sheets and Pass Predictor as well.
        </p>

        {packs.length > 0 && (
          <div className="mt-2">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Correction packs</p>
            <div className="space-y-2">
              {packs.map((p) => <Row key={p.slug} p={p} sub={`${p.writingCorrections} letters marked`} />)}
            </div>
          </div>
        )}

        {tiers.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Writing Course</p>
            <div className="space-y-2">
              {tiers.map((p) => <Row key={p.slug} p={p} sub={`${p.writingCorrections} corrections + course`} />)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
