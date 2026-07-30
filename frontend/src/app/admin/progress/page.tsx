"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  CandidateProgressSummaryDto,
  PaginatedCandidateProgressDto,
  SubscribedUserDto,
  UserProgressDto
} from "@/lib/types";

const PAGE_SIZE = 10;

function normalizePaginatedCandidates(
  response: unknown,
  page: number,
  limit: number
): PaginatedCandidateProgressDto {
  if (Array.isArray(response)) {
    const subscribed = response as SubscribedUserDto[];
    const total = subscribed.length;
    const start = (page - 1) * limit;
    const items: CandidateProgressSummaryDto[] = subscribed.slice(start, start + limit).map((user) => ({
      userId: user.userId,
      name: user.name,
      email: user.email,
      subscriptionId: user.subscriptionId,
      plan: user.plan,
      subscriptionStatus: user.status,
      startDate: user.startDate ?? null,
      endDate: user.endDate ?? null,
      currentBand: user.currentBand ?? null,
      latestPassProbability: 0,
      retainedResultsCount: 0,
      attemptsCount: 0
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  const paginated = (response ?? {}) as Partial<PaginatedCandidateProgressDto>;
  return {
    items: paginated.items ?? [],
    total: paginated.total ?? 0,
    page: paginated.page ?? page,
    limit: paginated.limit ?? limit,
    totalPages: paginated.totalPages ?? 1
  };
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="surface-panel-subtle rounded-xl px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">{value}</p>
    </div>
  );
}

function ProgressListItem({
  title,
  subtitle,
  badges,
  metrics
}: {
  title: string;
  subtitle: string;
  badges: ReactNode;
  metrics?: ReactNode;
}) {
  return (
    <div className="surface-panel-subtle rounded-xl px-4 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">{badges}</div>
      </div>
      {metrics ? <div className="mt-4 border-t border-border/50 pt-4">{metrics}</div> : null}
    </div>
  );
}

function ProgressPageContent() {
  const router = useRouter();
  const { token, profile, status, error, logout, refresh } = useSession();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [candidatePage, setCandidatePage] = useState<PaginatedCandidateProgressDto | null>(null);
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get("userId") || "");
  const [progress, setProgress] = useState<UserProgressDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(false);

  useEffect(() => {
    setPage(Number(searchParams.get("page") || 1));
    setSelectedUserId(searchParams.get("userId") || "");
  }, [searchParams]);

  const loadCandidates = useCallback(async () => {
    if (!token || !profile || profile.role !== "ADMIN") return;
    setLoadingCandidates(true);
    setLoadError(null);
    try {
      const response = await apiFetch<unknown>(`/users/subscribed?page=${page}&limit=${PAGE_SIZE}`, { token });
      setCandidatePage(normalizePaginatedCandidates(response, page, PAGE_SIZE));
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load candidate progress");
    } finally {
      setLoadingCandidates(false);
    }
  }, [page, profile, token]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    const loadProgress = async () => {
      if (!token || !selectedUserId) {
        setProgress(null);
        return;
      }
      setLoadingProgress(true);
      try {
        const progressResponse = await apiFetch<UserProgressDto>(`/users/${selectedUserId}/progress`, { token });
        setProgress(progressResponse);
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load user progress");
      } finally {
        setLoadingProgress(false);
      }
    };

    void loadProgress();
  }, [selectedUserId, token]);

  const trendData = useMemo(
    () =>
      (progress?.retainedResults || []).slice().reverse().map((result, index) => ({
        label: `Attempt ${index + 1}`,
        score: result.score
      })),
    [progress]
  );

  const candidateItems = useMemo(() => candidatePage?.items ?? [], [candidatePage]);

  const selectedSummary = useMemo(
    () => candidateItems.find((item) => item.userId === selectedUserId) ?? null,
    [candidateItems, selectedUserId]
  );

  const selectCandidate = (userId: string) => {
    setSelectedUserId(userId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("userId", userId);
    params.set("page", String(page));
    router.replace(`/admin/progress?${params.toString()}`);
  };

  const goToPage = (nextPage: number) => {
    const safePage = Math.max(1, Math.min(nextPage, candidatePage?.totalPages ?? 1));
    setPage(safePage);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(safePage));
    if (selectedUserId) params.set("userId", selectedUserId);
    router.replace(`/admin/progress?${params.toString()}`);
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading progress review..." layout="analytics" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to review candidate progress."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell
      title="Progress Review"
      description="Inspect retained scores, recent retakes, and current readiness before taking any action on a candidate account."
      profile={profile}
      onRefresh={refresh}
      onLogout={logout}
    >
      <div className="flex flex-col gap-6">
      {loadError ? <WorkspaceErrorAlert title="Unable to load candidate progress" description={loadError} /> : null}

      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardHeader className="space-y-1.5 border-b border-border/50 p-5 pb-4">
          <CardTitle className="text-lg">All candidates</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            One row per candidate showing their current plan only. Select a row to load detailed progress below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total candidates" value={candidatePage?.total ?? 0} />
            <StatTile label="This page" value={candidateItems.length} />
            <StatTile label="Retained results" value={progress?.retainedResults.length ?? "—"} />
            <StatTile
              label="Latest band"
              value={progress?.summary.latestBand ?? selectedSummary?.currentBand ?? "—"}
            />
          </div>

          {loadingCandidates ? (
            <WorkspaceLoadingState title="Loading candidates..." layout="table" />
          ) : candidateItems.length === 0 ? (
            <EmptyState
              title="No candidate progress yet"
              description="Subscribed candidates will appear here once they are enrolled on a plan."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Current plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latest band</TableHead>
                      <TableHead className="text-right">Retained</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                      <TableHead className="text-right">Pass %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidateItems.map((candidate) => {
                      const isSelected = candidate.userId === selectedUserId;
                      return (
                        <TableRow
                          key={candidate.userId}
                          className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                          onClick={() => selectCandidate(candidate.userId)}
                        >
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{candidate.name}</p>
                              <p className="text-xs text-muted-foreground">{candidate.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{candidate.plan?.name ?? "No plan"}</TableCell>
                          <TableCell>
                            <Badge variant={candidate.subscriptionStatus === "ACTIVE" ? "default" : "outline"}>
                              {candidate.subscriptionStatus ?? "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>{candidate.currentBand ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{candidate.retainedResultsCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{candidate.attemptsCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{candidate.latestPassProbability}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Pagination className="pt-1">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        goToPage(page - 1);
                      }}
                      className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 text-sm text-muted-foreground">
                      Page {candidatePage?.page ?? page} of {candidatePage?.totalPages ?? 1}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        goToPage(page + 1);
                      }}
                      className={page >= (candidatePage?.totalPages ?? 1) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </>
          )}
        </CardContent>
      </Card>

      {loadingProgress ? (
        <WorkspaceLoadingState title="Loading candidate detail..." layout="analytics" />
      ) : progress ? (
        <div className="flex flex-col gap-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Candidate" value={progress.user.name} />
            <StatTile label="Plan" value={progress.subscription?.plan.name || "No plan"} />
            <StatTile label="Latest band" value={progress.summary.latestBand || "No band"} />
            <StatTile label="Pass probability" value={`${progress.summary.latestPassProbability}%`} />
          </section>

          <section className="equal-card-grid xl:grid-cols-2">
            <Card className="equal-card border-border shadow-[var(--shadow-card)]">
              <CardHeader className="space-y-1.5 border-b border-border/50 p-5 pb-4">
                <CardTitle>Retained Score Trend</CardTitle>
                <CardDescription>Latest retained result per test, visualized across attempts.</CardDescription>
              </CardHeader>
              <CardContent className="equal-card-body p-5">
                {trendData.length > 0 ? (
                  <>
                    <ChartContainer
                      className="h-[280px] w-full"
                      config={{
                        score: {
                          label: "Score",
                          color: "hsl(var(--primary))"
                        }
                      }}
                    >
                      <LineChart data={trendData}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line dataKey="score" stroke="var(--color-score)" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ChartContainer>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Recent retained progression: {trendData.map((item) => `${item.label} (${item.score})`).join(", ")}
                    </p>
                  </>
                ) : (
                  <EmptyState
                    icon={Activity}
                    title="No retained trend available"
                    description="Once the candidate records retained results, the score trend will appear here."
                  />
                )}
              </CardContent>
            </Card>

            <Card className="equal-card border-border shadow-[var(--shadow-card)]">
              <CardHeader className="space-y-1.5 border-b border-border/50 p-5 pb-4">
                <CardTitle>Retained Results</CardTitle>
                <CardDescription>Latest score kept per test, aligned with the retake rule.</CardDescription>
              </CardHeader>
              <CardContent className="equal-card-body gap-4 p-5">
                {progress.retainedResults.length === 0 ? (
                  <EmptyState
                    title="No retained results"
                    description="This candidate has not completed enough work to generate retained scores yet."
                  />
                ) : (
                  progress.retainedResults.map((result) => (
                    <ProgressListItem
                      key={result.id}
                      title={result.test.title}
                      subtitle={formatDateTime(result.completedAt)}
                      badges={
                        <>
                          <Badge variant="outline">Score {result.score}</Badge>
                          <Badge variant="outline">{result.bandLabel}</Badge>
                        </>
                      }
                      metrics={
                        <div className="grid gap-4 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Pass probability
                            </p>
                            <p className="mt-2 font-medium text-foreground">{result.passProbability}%</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Attempts kept
                            </p>
                            <p className="mt-2 font-medium text-foreground">{result.attemptsCount}</p>
                          </div>
                        </div>
                      }
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <Card className="border-border shadow-[var(--shadow-card)]">
            <CardHeader className="space-y-1.5 border-b border-border/50 p-5 pb-4">
              <CardTitle>Recent Attempt History</CardTitle>
              <CardDescription>
                Review the most recent submissions, including auto-submits and in-progress states.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-5">
              {progress.attempts.length === 0 ? (
                <EmptyState
                  title="No attempt history yet"
                  description="Attempt events will appear here after the candidate starts taking tests."
                />
              ) : (
                progress.attempts.map((attempt) => (
                  <ProgressListItem
                    key={attempt.id}
                    title={attempt.test.title}
                    subtitle={`${attempt.section.replaceAll("_", " ")} · ${formatDateTime(attempt.submittedAt || attempt.updatedAt)}`}
                    badges={
                      <>
                        <Badge variant="outline">{attempt.status}</Badge>
                        <Badge variant="outline">Score {attempt.score ?? "Pending"}</Badge>
                        <Badge variant="outline">{attempt.bandLabel || "Pending band"}</Badge>
                      </>
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          size="comfortable"
          title="Select a candidate from the table"
          description="Choose a row above to load retained scores, attempts, and readiness signals."
        />
      )}
      </div>
    </AdminShell>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Loading progress review..." layout="analytics" />}>
      <ProgressPageContent />
    </Suspense>
  );
}
