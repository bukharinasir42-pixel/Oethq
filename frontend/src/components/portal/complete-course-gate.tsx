"use client";

/**
 * CompleteCourseGate — premium lock panel shown when a standalone-only student
 * opens a Complete-Course-only surface (cohort live classes or the daily study
 * plan). Offers the Complete Course plans.
 */
import { useState } from "react";
import { CalendarClock, Lock, Users } from "lucide-react";
import { PlansUpgradeModal } from "@/components/portal/plans-upgrade-modal";

export function CompleteCourseGate({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  const [plansOpen, setPlansOpen] = useState(false);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative overflow-hidden rounded-[20px] border border-primary/20 bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="h-8 w-8" aria-hidden />
        </span>
        <h2 className="mt-5 font-portal-display text-2xl font-bold text-[hsl(var(--primary-deep))]">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>

        <div className="mx-auto mt-6 grid max-w-md gap-3 text-left sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="text-sm leading-6 text-foreground">Daily live cohort classes with instructors</span>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="text-sm leading-6 text-foreground">A guided day-by-day study plan across all four skills</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPlansOpen(true)}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-card)] transition hover:opacity-90"
        >
          View Complete Course plans
        </button>
      </div>
      <PlansUpgradeModal open={plansOpen} onOpenChange={setPlansOpen} />
    </div>
  );
}
