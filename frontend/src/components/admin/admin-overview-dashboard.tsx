"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  ClipboardCopy,
  CreditCard,
  FileText,
  ListChecks,
  Newspaper,
  Sparkles,
  Tag,
  TrendingUp,
  UserSquare,
  Users
} from "lucide-react";
import { WorkspaceErrorAlert } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminOverviewDto, PlanDto, SubscribedUserDto } from "@/lib/types";

type TestStatsDto = {
  totalTests: number;
  publishedTests: number;
  attemptsInProgress: number;
  completedToday: number;
};

export type AdminOverviewDashboardProps = {
  overview: AdminOverviewDto | null;
  plans: PlanDto[];
  subscribedUsers: SubscribedUserDto[];
  testStats: TestStatsDto | null;
  loadError: string | null;
  adminName: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function MetricBento({
  label,
  value,
  hint,
  className,
  delayClass
}: {
  label: string;
  value: number | string;
  hint?: string;
  className?: string;
  delayClass?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[16px] border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--shadow-hover)]",
        "motion-safe:animate-oet-loader-fade-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards]",
        delayClass,
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.12),transparent_68%)] transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{label}</p>
      <p className="mt-3 font-display text-4xl font-semibold tracking-tight text-[hsl(var(--primary-deep))] tabular-nums md:text-[2.75rem]">
        {value}
      </p>
      {hint ? <p className="mt-2 max-w-[28ch] text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const workflow = [
  {
    title: "Task Builder",
    blurb: "40-day cadence · lectures · articles",
    href: "/admin/task-builder",
    icon: ListChecks,
    accent: "from-primary/14 to-transparent"
  },
  {
    title: "Past Paper",
    blurb: "Listening + Reading bundles",
    href: "/admin/past-paper",
    icon: ClipboardCopy,
    accent: "from-primary/10 to-transparent"
  },
  {
    title: "Test Builder",
    blurb: "Listening & Reading engines",
    href: "/admin/test-builder",
    icon: FileText,
    accent: "from-secondary/50 to-transparent"
  },
  {
    title: "Blogs",
    blurb: "Public feed & editorial CMS",
    href: "/admin/blogs",
    icon: Newspaper,
    accent: "from-accent/45 to-transparent"
  },
  {
    title: "Subscribed Users",
    blurb: "Plans · bands · onboarding",
    href: "/admin/subscribed-users",
    icon: Users,
    accent: "from-primary/10 to-transparent"
  },
  {
    title: "Progress",
    blurb: "Scores · retakes · readiness",
    href: "/admin/progress",
    icon: TrendingUp,
    accent: "from-secondary/35 to-transparent"
  }
] as const;

const shortcuts = [
  { href: "/admin/pricing", label: "Pricing", icon: Tag },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/users", label: "Registry", icon: UserSquare }
] as const;

export function AdminOverviewDashboard({
  overview,
  plans,
  subscribedUsers,
  testStats,
  loadError,
  adminName
}: AdminOverviewDashboardProps) {
  const users = overview?.users ?? 0;
  const active = overview?.activeSubscriptions ?? 0;
  const expired = overview?.expiredSubscriptions ?? 0;
  const published = testStats?.publishedTests ?? 0;

  return (
    <div className="relative min-w-0">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.12]"
        aria-hidden
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `linear-gradient(115deg, hsl(var(--primary) / 0.08) 0%, transparent 38%, transparent 62%, hsl(var(--secondary) / 0.35) 100%)`
          }}
        />
      </div>

      {loadError ? (
        <div className="mb-6">
          <WorkspaceErrorAlert title="Unable to load admin overview" description={loadError} />
        </div>
      ) : null}

      {/* Hero */}
      <header
        className={cn(
          "relative mb-8 overflow-hidden rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8 lg:p-10",
          "motion-safe:animate-oet-loader-fade-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards]"
        )}
      >
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-4">
            <span className="editorial-kicker inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              Command center
            </span>
            <h1 className="max-w-[20ch] font-display text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-[hsl(var(--primary-deep))]">
              Run the academy pipeline with intent.
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground md:text-base">
              Publish engines, tune plans, and watch candidates move through the same disciplined rhythm they will face on
              test day.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="rounded-[11px] border border-border bg-muted px-4 py-3 text-[12.5px] text-muted-foreground">
              <span className="text-foreground/80">Signed in as</span>{" "}
              <span className="font-semibold text-primary">{adminName}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {shortcuts.map(({ href, label, icon: Icon }) => (
                <Button key={href} asChild variant="outline" size="sm" className="rounded-full text-[12px]">
                  <Link href={href} className="gap-2 !no-underline">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Bento metrics */}
      <section className="mb-10 grid grid-cols-6 gap-3 md:gap-4">
        <MetricBento
          label="Registered users"
          value={users}
          hint="All roles in the registry."
          className="col-span-6 md:col-span-3 lg:col-span-2 lg:row-span-2 lg:min-h-[220px]"
          delayClass="motion-safe:[animation-delay:60ms]"
        />
        <MetricBento
          label="Active plans"
          value={active}
          hint="Subscriptions currently in good standing."
          className="col-span-6 sm:col-span-3 md:col-span-3 lg:col-span-2"
          delayClass="motion-safe:[animation-delay:120ms]"
        />
        <MetricBento
          label="Expired plans"
          value={expired}
          className="col-span-6 sm:col-span-3 md:col-span-3 lg:col-span-2"
          delayClass="motion-safe:[animation-delay:160ms]"
        />
        <MetricBento
          label="Published tests"
          value={published}
          hint={`${testStats?.totalTests ?? "—"} total in library.`}
          className="col-span-6 sm:col-span-3 md:col-span-3 lg:col-span-2"
          delayClass="motion-safe:[animation-delay:200ms]"
        />
      </section>

      {/* Workflow runway */}
      <section
        className={cn(
          "mb-10 motion-safe:animate-oet-loader-fade-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards] motion-safe:[animation-delay:280ms]"
        )}
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workflow</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[hsl(var(--primary-deep))]">Where to work next</h2>
          </div>
          <Link
            href="/admin/progress"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground no-underline transition hover:border-primary/30 hover:bg-primary/[0.04]"
          >
            <Activity className="h-3.5 w-3.5 text-primary" aria-hidden />
            Live progress
          </Link>
        </div>
        <div className="equal-card-grid sm:grid-cols-2 xl:grid-cols-5">
          {workflow.map(({ title, blurb, href, icon: Icon, accent }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "equal-card group relative justify-between overflow-hidden rounded-[16px] border border-border bg-card p-4 no-underline shadow-[var(--shadow-card)] transition duration-300",
                "motion-safe:hover:-translate-y-1 motion-safe:hover:border-primary/25 motion-safe:hover:shadow-[var(--shadow-hover)]"
              )}
            >
              <div
                className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition duration-500 group-hover:opacity-100", accent)}
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-2">
                <div className="rounded-[11px] border border-border bg-muted p-2 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" aria-hidden />
              </div>
              <div className="relative mt-6 space-y-1">
                <p className="font-display text-lg font-semibold tracking-tight text-[hsl(var(--primary-deep))]">{title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Pricing + roster — equal-height paired cards */}
      <section
        className={cn(
          "grid items-stretch gap-6 lg:grid-cols-12",
          "motion-safe:animate-oet-loader-fade-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards] motion-safe:[animation-delay:340ms]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col gap-4 rounded-[16px] border border-border bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-7 lg:p-6">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Catalog</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-[hsl(var(--primary-deep))]">Live pricing snapshot</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Values shown here mirror what candidates see on the public plans surface.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full text-[12px]">
              <Link href="/admin/pricing" className="!no-underline">
                Edit plans
              </Link>
            </Button>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-hidden rounded-[11px] border border-border bg-muted/40">
            {plans.length === 0 ? (
              <li className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
                No plans returned from the API.
              </li>
            ) : (
              plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-primary/[0.03] first:rounded-t-[11px] last:mt-auto last:rounded-b-[11px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{plan.name}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {plan.tier} · {plan.durationDays}d · R{plan.readingLimit} / L{plan.listeningLimit} / P{plan.pastPaperLimit}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.isActive === false ? (
                      <Badge variant="secondary" className="text-[10px] tracking-wide">
                        Inactive
                      </Badge>
                    ) : null}
                    <span className="font-display text-lg font-semibold tabular-nums text-primary">
                      ${plan.price}
                      <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{plan.currency}</span>
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] border border-border bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-5 lg:p-6">
          <div
            className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.12),transparent_70%)] opacity-60"
            aria-hidden
          />
          <div className="relative flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Roster</p>
                <h2 className="mt-1 font-display text-xl font-semibold text-[hsl(var(--primary-deep))]">Subscribed candidates</h2>
                <p className="mt-1 text-sm text-muted-foreground">Latest five by API order — full list in workspace.</p>
              </div>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col gap-2">
              {subscribedUsers.slice(0, 5).map((user) => (
                <li
                  key={user.subscriptionId}
                  className="flex items-center gap-3 rounded-[11px] border border-border bg-muted/60 px-3 py-2.5 transition hover:border-primary/25 hover:bg-primary/[0.04]"
                >
                  <div
                    className="oet-logo-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white shadow-none"
                    aria-hidden
                  >
                    {initials(user.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                      <Badge variant="outline" className="text-[9px] tracking-wide sm:hidden">
                        {user.status}
                      </Badge>
                    </div>
                    <p className="truncate text-[11.5px] text-muted-foreground">{user.email}</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground sm:hidden">
                      {user.plan.name} · {user.currentBand || "—"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <Badge variant="outline" className="text-[10px] tracking-wide">
                      {user.status}
                    </Badge>
                    <p className="mt-1 max-w-[14ch] truncate text-[10px] text-muted-foreground">
                      {user.plan.name} · {user.currentBand || "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-auto w-full shrink-0 rounded-[11px] font-medium">
              <Link href="/admin/subscribed-users" className="!no-underline">
                Open full roster
                <ArrowUpRight className="ml-2 inline h-4 w-4 align-text-bottom" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
