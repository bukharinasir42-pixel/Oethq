"use client";

/**
 * StandaloneCoursePricing — admin editor for standalone/add-on course prices
 * (Reading, Listening, Reading+Listening, Writing, Speaking). Complete Course
 * tiers are priced on the Plans grid. Prices flow live to the catalogue/checkout.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { productsApi, type CatalogueProduct } from "@/lib/products-api";

type Draft = {
  price: string; durationDays: string; isPurchasable: boolean; writingCorrections: string;
  mockTestLimit: string; pastPaperLimit: string; caseNoteLimit: string; passPredictor: boolean;
};

export function StandaloneCoursePricing() {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.list();
      const rows = res.products.filter((p) => p.category !== "COMPLETE");
      setProducts(rows);
      setDrafts(
        Object.fromEntries(
          rows.map((p) => [p.slug, {
            price: p.price != null ? String(p.price) : "",
            durationDays: p.durationDays != null ? String(p.durationDays) : "",
            isPurchasable: p.isPurchasable,
            writingCorrections: String(p.writingCorrections ?? 0),
            mockTestLimit: String(p.mockTestLimit ?? 0),
            pastPaperLimit: String(p.pastPaperLimit ?? 0),
            caseNoteLimit: String(p.caseNoteLimit ?? 0),
            passPredictor: p.passPredictor ?? false
          }])
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (p: CatalogueProduct) => {
    const d = drafts[p.slug];
    if (!d) return;
    const isTier = p.tierRank > 0;
    const isWritingRow = (p.writingCorrections ?? 0) > 0 || /writing/.test(p.slug);
    setSavingSlug(p.slug);
    try {
      await productsApi.adminUpdate(p.slug, {
        price: d.price.trim() === "" ? null : Number(d.price),
        durationDays: d.durationDays.trim() === "" ? null : Number(d.durationDays),
        isPurchasable: d.isPurchasable,
        ...(isWritingRow ? { writingCorrections: Math.max(0, parseInt(d.writingCorrections, 10) || 0) } : {}),
        ...(isTier ? {
          mockTestLimit: Math.max(0, parseInt(d.mockTestLimit, 10) || 0),
          pastPaperLimit: Math.max(0, parseInt(d.pastPaperLimit, 10) || 0),
          caseNoteLimit: Math.max(0, parseInt(d.caseNoteLimit, 10) || 0),
          passPredictor: d.passPredictor
        } : {})
      });
      toast.success(`Saved ${p.name}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingSlug(null);
    }
  };

  const setDraft = (slug: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Tag className="h-4 w-4" /> Standalone course pricing</CardTitle>
        <CardDescription>
          Prices update the catalogue, landing pages and checkout live. Upgrades automatically charge only the
          difference (target price − what the student already paid). Leave price empty for &quot;coming soon&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading courses…</p>
        ) : (
          <div className="space-y-2">
            {products.map((p) => {
              const d = drafts[p.slug];
              if (!d) return null;
              const isTier = p.tierRank > 0;
              const isWriting = (p.writingCorrections ?? 0) > 0 || /writing/.test(p.slug);
              const dirty = String(p.price ?? "") !== d.price
                || String(p.durationDays ?? "") !== d.durationDays
                || p.isPurchasable !== d.isPurchasable
                || (isWriting && String(p.writingCorrections ?? 0) !== d.writingCorrections)
                || (isTier && (
                  String(p.mockTestLimit ?? 0) !== d.mockTestLimit
                  || String(p.pastPaperLimit ?? 0) !== d.pastPaperLimit
                  || String(p.caseNoteLimit ?? 0) !== d.caseNoteLimit
                  || (p.passPredictor ?? false) !== d.passPredictor));
              const TIER_NAME = ["", "Foundation", "Momentum", "Precision", "Mega"];
              return (
                <div key={p.slug} className="flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.slug} · {p.includedSkills.map((s) => s[0] + s.slice(1).toLowerCase()).join(", ") || "—"}{isTier ? ` · Tier ${p.tierRank} ${TIER_NAME[p.tierRank] ?? ""}` : ""}</p>
                  </div>
                  <div className="w-24">
                    <Label className="text-[11px]">Price ({p.currency})</Label>
                    <Input inputMode="decimal" value={d.price} onChange={(e) => setDraft(p.slug, { price: e.target.value })} placeholder="—" />
                  </div>
                  <div className="w-20">
                    <Label className="text-[11px]">Days</Label>
                    <Input inputMode="numeric" value={d.durationDays} onChange={(e) => setDraft(p.slug, { durationDays: e.target.value })} placeholder="60" />
                  </div>
                  {isTier && !isWriting ? (
                    <div className="w-20">
                      <Label className="text-[11px]">Mocks</Label>
                      <Input inputMode="numeric" value={d.mockTestLimit} onChange={(e) => setDraft(p.slug, { mockTestLimit: e.target.value })} placeholder="0" />
                    </div>
                  ) : null}
                  {isTier ? (
                    <div className="w-20">
                      <Label className="text-[11px]">Papers</Label>
                      <Input inputMode="numeric" value={d.pastPaperLimit} onChange={(e) => setDraft(p.slug, { pastPaperLimit: e.target.value })} placeholder="0" />
                    </div>
                  ) : null}
                  {isWriting ? (
                    <div className="w-20">
                      <Label className="text-[11px]">Corrections</Label>
                      <Input inputMode="numeric" value={d.writingCorrections} onChange={(e) => setDraft(p.slug, { writingCorrections: e.target.value })} placeholder="0" />
                    </div>
                  ) : null}
                  {isTier && isWriting ? (
                    <div className="w-20">
                      <Label className="text-[11px]">Case notes</Label>
                      <Input inputMode="numeric" value={d.caseNoteLimit} onChange={(e) => setDraft(p.slug, { caseNoteLimit: e.target.value })} placeholder="0" />
                    </div>
                  ) : null}
                  {isTier ? (
                    <label className="flex items-center gap-1.5 pb-2 text-xs" title="Pass Predictor tracker unlocked at this tier">
                      <input type="checkbox" checked={d.passPredictor} onChange={(e) => setDraft(p.slug, { passPredictor: e.target.checked })} />
                      Predictor
                    </label>
                  ) : null}
                  <label className="flex items-center gap-1.5 pb-2 text-xs">
                    <input type="checkbox" checked={d.isPurchasable} onChange={(e) => setDraft(p.slug, { isPurchasable: e.target.checked })} />
                    Purchasable
                  </label>
                  <Badge variant="outline" className="mb-1.5">{p.status}</Badge>
                  <Button type="button" size="sm" disabled={!dirty || savingSlug === p.slug} onClick={() => void save(p)} className="mb-0.5 cursor-pointer">
                    {savingSlug === p.slug ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
