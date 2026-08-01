"use client";

/**
 * PlansUpgradeModal — the single portal "upgrade" popup. Instead of sending the
 * student to the old Complete-Course clearance page, it shows EVERY plan in one
 * popup: the clicked skill's four course tiers first, then the other skills'
 * tiers, then the Complete Course's four tiers. Each card starts checkout
 * in-portal (product tiers → /checkout/product, Complete plans → /checkout?plan).
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";
import type { PlanDto } from "@/lib/types";
import type { SkillKey } from "@/hooks/use-ownership";

const SKILL_LABEL: Record<string, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing" };
const SKILL_ORDER: SkillKey[] = ["READING", "LISTENING", "WRITING"];
const cleanName = (n: string) => n.replace(/^OET\s+/, "");

export function PlansUpgradeModal({
  open, onOpenChange, focusSkill = null, title
}: { open: boolean; onOpenChange: (v: boolean) => void; focusSkill?: SkillKey | null; title?: string }) {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void Promise.all([
      productsApi.list().then((r) => r.products).catch(() => [] as CatalogueProduct[]),
      apiFetch<PlanDto[]>("/plans", { token: null }).catch(() => [] as PlanDto[])
    ]).then(([p, pl]) => { if (active) { setProducts(p); setPlans(pl); } });
    return () => { active = false; };
  }, [open]);

  const tiersBySkill = useMemo(() => {
    const map: Record<string, CatalogueProduct[]> = {};
    for (const s of SKILL_ORDER) {
      map[s] = products
        .filter((p) => p.tierRank > 0 && !p.retired && p.isPurchasable && p.includedSkills[0] === s)
        .sort((a, b) => a.tierRank - b.tierRank);
    }
    return map;
  }, [products]);

  // Skill sections: the clicked skill first, then the rest.
  const skillOrder = useMemo(() => {
    const rest = SKILL_ORDER.filter((s) => s !== focusSkill);
    return (focusSkill ? [focusSkill, ...rest] : SKILL_ORDER).filter((s) => (tiersBySkill[s]?.length ?? 0) > 0);
  }, [focusSkill, tiersBySkill]);

  const completePlans = useMemo(
    () => plans.filter((pl) => pl.tier !== "STARTER" && (pl.isActive ?? true) && Number(pl.price) > 0).sort((a, b) => Number(a.price) - Number(b.price)),
    [plans]
  );

  const buyProduct = async (slug: string) => {
    setBusy(slug);
    try {
      const res = await productsApi.checkout(slug);
      onOpenChange(false);
      router.push(res.checkoutUrl);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not start checkout. Please try again.");
    } finally { setBusy(null); }
  };

  const buyPlan = (planId: string) => { onOpenChange(false); router.push(`/checkout?plan=${planId}`); };

  const tierFacts = (p: CatalogueProduct): string => {
    if (p.includedSkills[0] === "WRITING") {
      return `${p.writingCorrections ?? 0} corrections · ${p.caseNoteLimit} case notes${p.passPredictor ? " · Pass Predictor" : ""}`;
    }
    return `${p.mockTestLimit} mocks · ${p.pastPaperLimit} past papers${p.passPredictor ? " · Pass Predictor" : ""}`;
  };

  const TierCard = ({ p }: { p: CatalogueProduct }) => (
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => void buyProduct(p.slug)}
      className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-primary/[0.04] disabled:opacity-60"
    >
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className="truncate text-sm font-bold text-foreground">{cleanName(p.name)}</span>
        <span className="shrink-0 text-sm font-extrabold text-primary">{p.priceLabel}</span>
      </span>
      <span className="text-[11px] leading-4 text-muted-foreground">{tierFacts(p)}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
        {busy === p.slug ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <>Choose <ArrowRight className="h-3 w-3" aria-hidden /></>}
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title ?? "Choose your plan"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Upgrade to any single-skill course tier, or go all-in with the Complete Material. You only pay the difference
          from what you already own.
        </p>

        {skillOrder.map((s) => (
          <section key={s} className="mt-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              OET {SKILL_LABEL[s]} Course{s === focusSkill ? " · your course" : ""}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {tiersBySkill[s].map((p) => <TierCard key={p.slug} p={p} />)}
            </div>
          </section>
        ))}

        {completePlans.length > 0 && (
          <section className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden /> OET Complete Material · all four skills
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {completePlans.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => buyPlan(pl.id)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-primary/25 bg-gradient-to-b from-primary/[0.06] to-transparent p-3 text-left transition hover:border-primary/60 hover:bg-primary/[0.08]"
                >
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-bold text-foreground">{cleanName(pl.name)}</span>
                    <span className="shrink-0 text-sm font-extrabold text-primary">${Number(pl.price)}</span>
                  </span>
                  <span className="text-[11px] leading-4 text-muted-foreground">
                    {pl.durationDays} days · R{pl.readingLimit}·L{pl.listeningLimit}·PP{pl.pastPaperLimit}·W{pl.writingLimit ?? 0}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary">Choose <ArrowRight className="h-3 w-3" aria-hidden /></span>
                </button>
              ))}
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
