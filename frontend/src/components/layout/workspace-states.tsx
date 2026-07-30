"use client";

import Link from "next/link";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InlineLoader, LoadingPulseStrip } from "@/components/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Explicit skeleton blueprint, or `auto` to derive a stable blueprint from `title`. */
export type WorkspaceLoadingLayout =
  | "auto"
  | "workspace"
  | "dashboard"
  | "table"
  | "editor"
  | "minimal"
  | "cards"
  | "analytics"
  | "split";

function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i += 1) {
    h = (h << 5) - h + title.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function resolveLayout(title: string, layout: WorkspaceLoadingLayout): Exclude<WorkspaceLoadingLayout, "auto"> {
  if (layout !== "auto") return layout;
  const presets: Exclude<WorkspaceLoadingLayout, "auto">[] = [
    "workspace",
    "dashboard",
    "table",
    "editor",
    "minimal",
    "cards",
    "analytics",
    "split"
  ];
  return presets[hashTitle(title) % presets.length];
}

function jitterWidth(seed: number, minPct: number, maxPct: number): `${number}%` {
  const span = maxPct - minPct;
  const t = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const u = t < 0 ? t + 1 : t;
  return `${minPct + Math.floor(u * span)}%`;
}

type WorkspaceLoadingStateProps = {
  title: string;
  layout?: WorkspaceLoadingLayout;
};

type WorkspaceAccessDeniedStateProps = {
  title: string;
  description: string;
  retryLabel?: string;
  actionHref?: string;
  actionLabel?: string;
  onRetry?: () => void;
};

type WorkspaceErrorAlertProps = {
  title?: string;
  description: string;
};

function LoadingHeader({ seed }: { seed: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5" style={{ width: jitterWidth(seed, 28, 42) }} />
      <Skeleton className="h-9 max-w-xl" style={{ width: jitterWidth(seed + 1, 55, 92) }} />
      <Skeleton className="h-4 max-w-2xl" style={{ width: jitterWidth(seed + 2, 62, 100) }} />
    </div>
  );
}

function LoadingFooter({ title }: { title: string }) {
  return (
    <div className="flex justify-center pt-1">
      <InlineLoader label={title} size="md" />
    </div>
  );
}

function SkeletonWorkspace({ seed }: { seed: number }) {
  return (
    <>
      <LoadingHeader seed={seed} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8" style={{ width: jitterWidth(seed + index, 18, 36) }} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </>
  );
}

function SkeletonDashboard({ seed }: { seed: number }) {
  const kpi = 3 + (seed % 2);
  return (
    <>
      <LoadingHeader seed={seed} />
      <div className={cn("grid gap-3", kpi === 3 ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4")}>
        {Array.from({ length: kpi }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10" style={{ width: jitterWidth(seed + index, 24, 44) }} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SkeletonTable({ seed }: { seed: number }) {
  const rows = 6 + (seed % 4);
  return (
    <>
      <LoadingHeader seed={seed} />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 flex-1 min-w-[12rem] max-w-md rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
      <Card>
        <CardContent className="space-y-0 divide-y divide-border/60 p-0">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-4 flex-1 min-w-[8rem]" style={{ width: jitterWidth(seed + index * 3, 35, 70) }} />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function SkeletonEditor({ seed }: { seed: number }) {
  return (
    <>
      <LoadingHeader seed={seed} />
      <div className="flex flex-col gap-4 lg:flex-row">
        <Card className="lg:w-64 shrink-0">
          <CardContent className="space-y-3 p-4">
            {Array.from({ length: 5 + (seed % 3) }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="min-h-[22rem] flex-1">
          <CardContent className="space-y-4 p-4">
            <Skeleton className="h-6 max-w-sm" style={{ width: jitterWidth(seed + 11, 52, 78) }} />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SkeletonMinimal({ seed }: { seed: number }) {
  return (
    <>
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 max-w-lg" style={{ width: jitterWidth(seed, 55, 88) }} />
      </div>
      <Skeleton className="h-56 w-full max-w-3xl rounded-2xl" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </>
  );
}

function SkeletonCards({ seed }: { seed: number }) {
  const count = 4 + (seed % 4);
  return (
    <>
      <LoadingHeader seed={seed} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 max-w-[220px]" style={{ width: jitterWidth(seed + index * 2, 40, 68) }} />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 max-w-[90%]" style={{ width: jitterWidth(seed + index * 2 + 1, 55, 90) }} />
              <Skeleton className="h-20 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function SkeletonAnalytics({ seed }: { seed: number }) {
  return (
    <>
      <LoadingHeader seed={seed} />
      <Skeleton className="h-12 w-full max-w-lg rounded-lg" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-16 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function SkeletonSplit({ seed }: { seed: number }) {
  return (
    <>
      <LoadingHeader seed={seed} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-10 w-full max-w-xs rounded-md" />
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </>
  );
}

export function WorkspaceLoadingState({ title, layout = "auto" }: WorkspaceLoadingStateProps) {
  const seed = hashTitle(title);
  const resolved = resolveLayout(title, layout);

  const body =
    resolved === "workspace" ? (
      <SkeletonWorkspace seed={seed} />
    ) : resolved === "dashboard" ? (
      <SkeletonDashboard seed={seed} />
    ) : resolved === "table" ? (
      <SkeletonTable seed={seed} />
    ) : resolved === "editor" ? (
      <SkeletonEditor seed={seed} />
    ) : resolved === "minimal" ? (
      <SkeletonMinimal seed={seed} />
    ) : resolved === "cards" ? (
      <SkeletonCards seed={seed} />
    ) : resolved === "analytics" ? (
      <SkeletonAnalytics seed={seed} />
    ) : (
      <SkeletonSplit seed={seed} />
    );

  return (
    <div
      className="space-y-6 px-4 py-6 sm:px-6 lg:px-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
      data-loading-layout={resolved}
    >
      <LoadingPulseStrip />
      {body}
      <LoadingFooter title={title} />
    </div>
  );
}

export function WorkspaceAccessDeniedState({
  title,
  description,
  retryLabel = "Retry",
  actionHref,
  actionLabel,
  onRetry
}: WorkspaceAccessDeniedStateProps) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <EmptyState icon={ShieldAlert} title={title} description={description}>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {actionHref && actionLabel ? (
            <Button asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : null}
          {onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </EmptyState>
    </div>
  );
}

export function WorkspaceErrorAlert({
  title = "Something went wrong",
  description
}: WorkspaceErrorAlertProps) {
  return (
    <Alert variant="destructive" className="p-4 sm:p-5">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
