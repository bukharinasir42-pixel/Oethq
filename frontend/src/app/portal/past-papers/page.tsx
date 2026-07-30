"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCopy, Lock } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { SkillUpgradeModal } from "@/components/portal/skill-upgrade-modal";
import type { SkillKey } from "@/hooks/use-ownership";
import { PortalErrorAlert } from "@/components/portal/portal-error-alert";
import { TestTypeIcon } from "@/components/portal/test-type-icon";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalPlanAccess } from "@/hooks/use-portal-plan-access";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { buildPastPaperSlots, type PortalPastPaperSlot } from "@/lib/portal-past-paper-utils";
import type { PastPaperSummaryDto } from "@/lib/types";

function PastPapersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skillFilter = ((): "READING" | "LISTENING" | null => {
    const s = searchParams.get("skill")?.toUpperCase();
    return s === "READING" || s === "LISTENING" ? s : null;
  })();
  const skillLabel = skillFilter === "READING" ? "Reading" : skillFilter === "LISTENING" ? "Listening" : null;
  const { token, profile, status, error, refresh, logout } = useSession();
  const { subscription, pastPaperLimitForSkill, showPastPapersNav, ownsSkill, loading: loadingPlanAccess, loaded: planLoaded } = usePortalPlanAccess();
  const [pastPapers, setPastPapers] = useState<PastPaperSummaryDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPastPapers, setLoadingPastPapers] = useState(true);
  const [lockedSkill, setLockedSkill] = useState<SkillKey | null>(null);

  useEffect(() => {
    // Only redirect once plan access has definitively loaded for this user.
    // `planLoaded` (not `loadingPlanAccess`) avoids the hard-load race where the
    // token is still resolving and access briefly reads as "none".
    if (!token || !profile || !planLoaded) return;
    if (!showPastPapersNav) {
      router.replace("/portal");
    }
  }, [token, profile, planLoaded, router, showPastPapersNav]);

  const reload = async () => {
    if (!token || !profile) return;
    setLoadError(null);
    setLoadingPastPapers(true);
    try {
      const response = await apiFetch<PastPaperSummaryDto[]>("/past-papers", { token });
      setPastPapers(response);
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load past papers");
    } finally {
      setLoadingPastPapers(false);
    }
  };

  useEffect(() => {
    if (!token || !profile || !showPastPapersNav) return;
    void reload();
  }, [profile, showPastPapersNav, token]);

  // Per-skill past-paper COUNT allowance (Foundation 1 … Mega 10; Complete plan
  // limit for subscribers). A skill's test unlocks only within its own count.
  const ownsReceptive = ownsSkill("READING") || ownsSkill("LISTENING");
  const readingLimit = pastPaperLimitForSkill("READING");
  const listeningLimit = pastPaperLimitForSkill("LISTENING");
  // Slots rendered = the largest allowance among the skill(s) currently in view;
  // slots beyond a given skill's limit render that skill's row count-locked.
  const slotCount =
    skillFilter === "READING" ? readingLimit : skillFilter === "LISTENING" ? listeningLimit : Math.max(readingLimit, listeningLimit);
  const slots = useMemo(() => buildPastPaperSlots(pastPapers, slotCount), [slotCount, pastPapers]);
  const openCount = slots.filter((slot) => slot.configured).length;

  if (status === "loading" || status === "idle" || loadingPlanAccess || (profile && !planLoaded)) {
    return <WorkspaceLoadingState title="Loading past papers..." layout="table" />;
  }

  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to view past papers."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  if (!showPastPapersNav) {
    return <WorkspaceLoadingState title="Redirecting..." layout="table" />;
  }

  return (
    <PortalShell
      title={skillLabel ? `${skillLabel} past papers` : "Past papers"}
      description={
        skillLabel
          ? `Official OET HQ ${skillLabel} past papers included with your course.`
          : "Official listening and reading past papers included with your plan."
      }
      profile={profile}
      packageName={subscription?.plan?.name}
      statusLabel={subscription?.status ? `Status: ${subscription.status}` : undefined}
      expiryLabel={
        subscription?.expiresInDays !== undefined ? `${subscription.expiresInDays} days left` : undefined
      }
      onRefresh={() => void reload()}
      onLogout={logout}
    >
      {loadError ? (
        <PortalErrorAlert title="Unable to load past papers" description={loadError} onRetry={() => void reload()} />
      ) : loadingPastPapers ? (
        <WorkspaceLoadingState title="Loading past papers..." layout="table" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="tabular-nums">
              {slotCount} included with your {skillLabel ? `${skillLabel} ` : ""}course
            </Badge>
            <Badge variant="default" className="tabular-nums">
              {openCount} available
            </Badge>
          </div>

          {slots.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  icon={ClipboardCopy}
                  title={ownsReceptive ? "No past papers published yet" : "Past papers not included"}
                  description={
                    ownsReceptive
                      ? `Your OET HQ ${skillLabel ? `${skillLabel} ` : ""}past papers will appear here as soon as they're published.`
                      : "Upgrade from the free trial to unlock past paper practice."
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {slots.map((slot) => (
                <PastPaperSlotCard
                  key={slot.slotNumber}
                  slot={slot}
                  ownsSkill={ownsSkill}
                  onUpgrade={setLockedSkill}
                  skillFilter={skillFilter}
                  readingLimit={readingLimit}
                  listeningLimit={listeningLimit}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <SkillUpgradeModal skill={lockedSkill} open={lockedSkill !== null} onOpenChange={(v) => { if (!v) setLockedSkill(null); }} />
    </PortalShell>
  );
}

export default function PastPapersPage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Loading past papers..." layout="table" />}>
      <PastPapersInner />
    </Suspense>
  );
}

type SkillLockProps = { ownsSkill: (s: SkillKey) => boolean; onUpgrade: (s: SkillKey) => void };
type SkillFilterProp = { skillFilter: "READING" | "LISTENING" | null };
type CountLimitProps = { readingLimit: number; listeningLimit: number };

function PastPaperSlotCard({ slot, ownsSkill, onUpgrade, skillFilter, readingLimit, listeningLimit }: { slot: PortalPastPaperSlot } & SkillLockProps & SkillFilterProp & CountLimitProps) {
  const bothLabel = "Listening and reading past papers for this slot.";
  const oneLabel = skillFilter === "READING" ? "Reading past paper for this slot." : "Listening past paper for this slot.";
  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{slot.label}</CardTitle>
            <CardDescription>
              {slot.configured
                ? skillFilter
                  ? oneLabel
                  : bothLabel
                : "This past paper has not been published yet."}
            </CardDescription>
          </div>
          <Badge variant={slot.configured ? "default" : "outline"}>
            {slot.configured ? "Available" : "Coming soon"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <PastPaperSlotContent slot={slot} ownsSkill={ownsSkill} onUpgrade={onUpgrade} skillFilter={skillFilter} readingLimit={readingLimit} listeningLimit={listeningLimit} />
      </CardContent>
    </Card>
  );
}

function PastPaperSlotContent({ slot, ownsSkill, onUpgrade, skillFilter, readingLimit, listeningLimit }: { slot: PortalPastPaperSlot } & SkillLockProps & SkillFilterProp & CountLimitProps) {
  if (slot.pastPaper) {
    const showListening = skillFilter !== "READING";
    const showReading = skillFilter !== "LISTENING";
    // A skill's row unlocks only if the skill is owned AND this slot is within
    // that skill's tier count (mirrors the server cap for opening the test).
    const listeningLocked = !ownsSkill("LISTENING") || slot.slotNumber > listeningLimit;
    const readingLocked = !ownsSkill("READING") || slot.slotNumber > readingLimit;
    return (
      <>
        {showListening ? (
          <PastPaperTestRow
            type="LISTENING"
            title={slot.pastPaper.listeningTest.title}
            subtitle="Listening past paper"
            testId={slot.pastPaper.listeningTest.id}
            locked={listeningLocked}
            onUpgrade={onUpgrade}
          />
        ) : null}
        {showReading ? (
          <PastPaperTestRow
            type="READING"
            title={slot.pastPaper.readingTest.title}
            subtitle="Reading past paper"
            testId={slot.pastPaper.readingTest.id}
            locked={readingLocked}
            onUpgrade={onUpgrade}
          />
        ) : null}
      </>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Your plan includes this past paper. It will appear here once the admin publishes it.
    </p>
  );
}

function PastPaperTestRow({
  type,
  title,
  subtitle,
  testId,
  locked,
  onUpgrade
}: {
  type: "LISTENING" | "READING";
  title: string;
  subtitle: string;
  testId: string;
  locked: boolean;
  onUpgrade: (s: SkillKey) => void;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${locked ? "border-border/60 bg-muted/30" : "border-border/60"}`}>
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <TestTypeIcon type={type} size="xs" />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{subtitle}</p>
        </div>
        <p className={`truncate text-sm font-medium ${locked ? "text-muted-foreground" : "text-foreground"}`}>{title}</p>
      </div>
      {locked ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onUpgrade(type)}
          className="h-10 shrink-0 cursor-pointer gap-1.5"
        >
          <Lock className="h-3.5 w-3.5" aria-hidden /> Upgrade
        </Button>
      ) : (
        <Button asChild size="sm" variant="secondary" className="h-10 shrink-0 cursor-pointer">
          <Link href={`/portal/tests/${testId}?from=past-papers`} className="inline-flex items-center">
            Start
          </Link>
        </Button>
      )}
    </div>
  );
}
