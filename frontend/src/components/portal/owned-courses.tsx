"use client";

/**
 * OwnedCoursesSection — reflects the products/modules this customer actually owns
 * (Complete Course subscription + any standalone course entitlements), from the
 * unified /entitlements endpoint. Additive: previously owned products persist.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Headphones, Layers } from "lucide-react";
import { productsApi, type OwnedEntitlement } from "@/lib/products-api";

function ownedIcon(e: OwnedEntitlement) {
  const cls = "h-5 w-5";
  if (e.entitlementKey === "complete") return <GraduationCap className={cls} aria-hidden />;
  const s = e.includedSkills;
  if (s.length > 1) return <Layers className={cls} aria-hidden />;
  if (s[0] === "READING") return <BookOpen className={cls} aria-hidden />;
  if (s[0] === "LISTENING") return <Headphones className={cls} aria-hidden />;
  return <Layers className={cls} aria-hidden />;
}

export function OwnedCoursesSection() {
  const [owned, setOwned] = useState<OwnedEntitlement[] | null>(null);

  useEffect(() => {
    let active = true;
    productsApi.ownership()
      .then((o) => { if (active) setOwned(o.owned); })
      .catch(() => { if (active) setOwned([]); });
    return () => { active = false; };
  }, []);

  if (!owned || owned.length === 0) return null;

  return (
    <section className="rounded-[16px] border border-border bg-card px-4 py-4 shadow-[var(--shadow-card)] sm:px-5" aria-label="Your courses">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-portal-display text-base font-semibold text-[hsl(var(--primary-deep))] sm:text-lg">Your courses</h3>
        <Link href="/courses" className="text-xs font-semibold text-primary hover:underline">Browse courses →</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {owned.map((e) => (
          <div key={e.entitlementKey} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/40 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {ownedIcon(e)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{e.productName ?? e.entitlementKey}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.includedSkills.map((s) => s[0] + s.slice(1).toLowerCase()).join(" · ")}
                {e.endDate ? ` · until ${new Date(e.endDate).toLocaleDateString()}` : ""}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Owned</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
