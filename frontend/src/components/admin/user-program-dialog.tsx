"use client";

/**
 * UserProgramDialog — admin upgrade/downgrade a student's program by granting or
 * revoking standalone course entitlements. Reflects instantly in their portal.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Minus, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { productsApi, type CatalogueProduct, type Ownership } from "@/lib/products-api";

export function UserProgramDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [ownership, setOwnership] = useState<Ownership | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, own] = await Promise.all([productsApi.list(), productsApi.adminUserEntitlements(userId)]);
      setProducts(cat.products.filter((p) => p.category === "STANDALONE"));
      setOwnership(own);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const ownsKey = (key: string) => ownership?.entitlementKeys.includes(key) ?? false;

  const grant = async (p: CatalogueProduct) => {
    setBusy(p.slug);
    const days = customDays.trim() ? Math.max(1, parseInt(customDays, 10) || 0) : undefined;
    const grantedDays = days ?? p.durationDays ?? null;
    try {
      setOwnership(await productsApi.adminGrant(userId, p.slug, days));
      toast.success(`Granted ${p.name}${grantedDays ? ` · ${grantedDays} days` : ""}`);
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };
  const endDateOf = (key: string) => ownership?.owned.find((o) => o.entitlementKey === key)?.endDate ?? null;
  const fmtEnd = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);
  const revoke = async (p: CatalogueProduct) => {
    setBusy(p.slug);
    try { setOwnership(await productsApi.adminRevoke(userId, p.entitlementKey)); toast.success(`Revoked ${p.name}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Program
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage program — {userName}</DialogTitle>
          <DialogDescription>Grant or revoke course access. Each grant lasts the course&apos;s own duration (a full course, not a 7-day trial) unless you set a custom length below. The Complete Material is managed via their subscription/plan.</DialogDescription>
        </DialogHeader>

        {ownership && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <span className="font-semibold text-foreground">Owned skills: </span>
            {ownership.ownedSkills.length ? ownership.ownedSkills.map((s) => s[0] + s.slice(1).toLowerCase()).join(", ") : "none"}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
          <label htmlFor="grant-days" className="text-xs font-semibold text-foreground">Access length</label>
          <input
            id="grant-days"
            inputMode="numeric"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="course default"
            className="h-8 w-28 rounded-md border border-border bg-background px-2 text-sm"
          />
          <span className="text-[11px] text-muted-foreground">days — leave blank to use each course&apos;s own duration.</span>
        </div>

        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2">
            {products.map((p) => {
              const owned = ownsKey(p.entitlementKey);
              return (
                <div key={p.slug} className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.includedSkills.map((s) => s[0] + s.slice(1).toLowerCase()).join(" + ")} · {p.priceLabel} · {p.durationDays ? `${p.durationDays} days` : "no expiry"}
                      {owned && fmtEnd(endDateOf(p.entitlementKey)) ? ` · ends ${fmtEnd(endDateOf(p.entitlementKey))}` : ""}
                    </p>
                  </div>
                  {owned ? (
                    <>
                      <Badge className="bg-emerald-100 text-emerald-700"><Check className="mr-1 h-3 w-3" /> Owned</Badge>
                      <Button type="button" size="sm" variant="ghost" disabled={busy === p.slug} onClick={() => void revoke(p)} className="text-rose-600 hover:text-rose-700">
                        {busy === p.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="mr-1 h-3.5 w-3.5" />} Revoke
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" disabled={busy === p.slug} onClick={() => void grant(p)} className="cursor-pointer">
                      {busy === p.slug ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />} Grant
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
