"use client";

/**
 * ManageAccessDialog — upgrade / downgrade one candidate's access.
 *
 * A student's access comes from two independent places and the dialog treats
 * them separately, because changing one must not silently change the other:
 *
 *   • the Complete Course PLAN, held as a subscription (Foundation Sprint →
 *     Total Clearance), and
 *   • single-skill COURSES, held as entitlements (Reading Mega, Listening
 *     Precision, …), which have their own per-product access window.
 *
 * Every action is immediate. Changing a plan does not bounce an already-active
 * student back to "activate your account", and ending a plan leaves their
 * individual courses untouched — that is the "downgrade to courses only" move.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productsApi, type CatalogueProduct, type Ownership } from "@/lib/products-api";
import type { PlanDto, SubscribedUserDto } from "@/lib/types";

/** Sort order for plans, so "higher" and "lower" are well defined. */
const TIER_ORDER = ["STARTER", "FOUNDATION", "ACCELERATOR", "MASTERY", "CUSTOM"];
const tierIndex = (tier: string) => {
  const i = TIER_ORDER.indexOf(tier);
  return i === -1 ? TIER_ORDER.length : i;
};

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : "—");

/** Up / down arrow relative to what the student is on now. */
function Direction({ from, to }: { from: number; to: number }) {
  if (to === from) return <Badge variant="outline" className="ml-2 text-[10px]">Current</Badge>;
  return to > from ? (
    <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
      <ArrowUp className="h-3 w-3" /> Upgrade
    </span>
  ) : (
    <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600">
      <ArrowDown className="h-3 w-3" /> Downgrade
    </span>
  );
}

type Props = {
  user: SubscribedUserDto | null;
  plans: PlanDto[];
  products: CatalogueProduct[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any successful change so the caller can refetch the table. */
  onChanged: () => void;
};

export function ManageAccessDialog({ user, plans, products, open, onOpenChange, onChanged }: Props) {
  const [ownership, setOwnership] = useState<Ownership | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const [planDays, setPlanDays] = useState("");
  const [grantSlug, setGrantSlug] = useState("");
  const [grantDays, setGrantDays] = useState("");

  const loadOwnership = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setOwnership(await productsApi.adminUserEntitlements(user.userId));
    } catch {
      setOwnership(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    setPlanId(user.plan.id);
    setPlanDays("");
    setGrantSlug("");
    setGrantDays("");
    void loadOwnership();
  }, [open, user, loadOwnership]);

  // Only real Complete Course plans are selectable; the free trial is not
  // something an admin grants as an upgrade.
  const sellablePlans = useMemo(
    () => plans.filter((p) => p.tier !== "STARTER").sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier)),
    [plans]
  );

  // Single-skill tiers only (tierRank > 0), excluding anything retired.
  const grantable = useMemo(
    () => products.filter((p) => p.tierRank > 0 && !p.retired).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const currentTier = user ? tierIndex(user.plan.tier) : 0;
  const selectedPlan = sellablePlans.find((p) => p.id === planId) ?? null;
  const onTrial = user?.plan.tier === "STARTER";

  const held = ownership?.owned.filter((o) => o.entitlementKey !== "complete") ?? [];

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await loadOwnership();
      onChanged();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "That change did not go through");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage access{user ? ` — ${user.name}` : ""}</DialogTitle>
          <DialogDescription>
            {user?.email} · changes apply immediately, with no re-activation email.
          </DialogDescription>
        </DialogHeader>

        {!user ? null : (
          <div className="space-y-5">
            {/* ---------------- Complete Course plan ---------------- */}
            <section className="rounded-xl border border-border/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Complete Course plan</h3>
                <span className="text-xs text-muted-foreground">
                  {onTrial ? "On the free trial" : `${user.plan.name} · ends ${fmt(user.endDate)}`}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {sellablePlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {p.durationDays ?? 60} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="sm:w-32"
                  inputMode="numeric"
                  placeholder="Days"
                  value={planDays}
                  onChange={(e) => setPlanDays(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={!planId || planId === user.plan.id || busy !== null}
                  onClick={() =>
                    void run(
                      "plan",
                      () => productsApi.adminChangePlan(user.userId, planId, planDays ? Number(planDays) : undefined),
                      "Plan updated"
                    )
                  }
                >
                  {busy === "plan" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {selectedPlan ? (
                  <>
                    {selectedPlan.name}
                    <Direction from={currentTier} to={tierIndex(selectedPlan.tier)} />
                    {" · "}
                    access restarts today for {planDays || selectedPlan.durationDays || 60} days.
                  </>
                ) : (
                  "Leave the day box blank to use the plan's own duration."
                )}
              </p>

              {!onTrial ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs text-destructive hover:text-destructive"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(`End ${user.name}'s ${user.plan.name} plan now? Their individual courses stay.`)) return;
                    void run("cancel", () => productsApi.adminCancelPlan(user.userId), "Plan ended");
                  }}
                >
                  {busy === "cancel" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                  End plan (keep individual courses)
                </Button>
              ) : null}
            </section>

            {/* ---------------- single-skill courses ---------------- */}
            <section className="rounded-xl border border-border/70 p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Individual courses</h3>

              {loading ? (
                <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : held.length === 0 ? (
                <p className="text-xs text-muted-foreground">No individual courses. Grant one below.</p>
              ) : (
                <ul className="mb-3 space-y-1.5">
                  {held.map((o) => (
                    <li key={o.entitlementKey} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-foreground">{o.productName ?? o.entitlementKey}</span>
                        <span className="block text-[10px] text-muted-foreground">Ends {fmt(o.endDate)}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
                        disabled={busy !== null}
                        onClick={() => {
                          if (!window.confirm(`Remove ${o.productName ?? o.entitlementKey} from ${user.name}?`)) return;
                          void run(o.entitlementKey, () => productsApi.adminRevoke(user.userId, o.entitlementKey), "Course removed");
                        }}
                      >
                        {busy === o.entitlementKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Select value={grantSlug} onValueChange={setGrantSlug}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add or change a course tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {grantable.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        {p.name}{p.durationDays ? ` · ${p.durationDays} days` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="sm:w-32"
                  inputMode="numeric"
                  placeholder="Days"
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!grantSlug || busy !== null}
                  onClick={() =>
                    void run(
                      "grant",
                      () => productsApi.adminGrant(user.userId, grantSlug, grantDays ? Number(grantDays) : undefined),
                      "Course granted"
                    )
                  }
                >
                  {busy === "grant" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Granting a different tier of a skill the student already owns replaces it — that is how a
                single-skill upgrade or downgrade is applied.
              </p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
