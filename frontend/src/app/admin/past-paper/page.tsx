"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { InlineLoader } from "@/components/loaders";
import { AdminShell } from "@/components/admin/admin-shell";
import { PastPaperPublishControls } from "@/components/admin/past-paper-publish-controls";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import {
  formatPastPaperDayTitle,
  getNextPastPaperDayNumber,
  MAX_PAST_PAPERS,
  sortPastPapersByDay
} from "@/lib/past-paper-utils";
import type { PastPaperSummaryDto } from "@/lib/types";

const PAST_PAPER_PAGE_SIZE = 3;

export default function PastPaperPage() {
  const router = useRouter();
  const { token, profile, status, error, logout, refresh } = useSession();
  const [pastPapers, setPastPapers] = useState<PastPaperSummaryDto[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadPastPapers = useCallback(async () => {
    if (!token) return;
    const response = await apiFetch<PastPaperSummaryDto[]>("/past-papers/admin", { token });
    setPastPapers(response);
  }, [token]);

  useEffect(() => {
    if (!token || profile?.role !== "ADMIN") return;
    setLoadingData(true);
    void loadPastPapers()
      .catch((caughtError: unknown) => {
        toast.error(caughtError instanceof Error ? caughtError.message : "Failed to load past papers");
      })
      .finally(() => setLoadingData(false));
  }, [loadPastPapers, profile, token]);

  const sortedPastPapers = useMemo(() => sortPastPapersByDay(pastPapers), [pastPapers]);
  const canAddPastPaper = sortedPastPapers.length < MAX_PAST_PAPERS;
  const totalPages = Math.max(1, Math.ceil(sortedPastPapers.length / PAST_PAPER_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAST_PAPER_PAGE_SIZE;
  const pagedPastPapers = sortedPastPapers.slice(pageStart, pageStart + PAST_PAPER_PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  };

  const handlePastPaperPublishedChange = (updatedPaper: PastPaperSummaryDto) => {
    setPastPapers((current) =>
      current.map((paper) => (paper.id === updatedPaper.id ? updatedPaper : paper))
    );
  };

  const addPastPaper = async () => {
    if (!token || !canAddPastPaper) return;
    setCreating(true);
    try {
      const dayNumber = getNextPastPaperDayNumber(pastPapers);
      const title = formatPastPaperDayTitle(dayNumber);
      const created = await apiFetch<PastPaperSummaryDto>("/past-papers", {
        method: "POST",
        token,
        body: { title }
      });
      toast.success("Past paper created");
      router.push(`/admin/past-paper/${created.id}/test/${created.listeningTest.id}`);
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to create past paper");
    } finally {
      setCreating(false);
    }
  };

  const deletePastPaper = async (pastPaperId: string) => {
    setDeletingId(pastPaperId);
    try {
      await apiFetch(`/past-papers/${pastPaperId}`, { method: "DELETE", token });
      toast.success("Past paper deleted");
      await loadPastPapers();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to delete past paper");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || status === "idle" || loadingData) {
    return <WorkspaceLoadingState title="Loading past papers..." layout="editor" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage past papers."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell
      title="Past Paper"
      description="Manage past paper bundles. Each bundle includes one listening and one reading test."
      profile={profile}
      compact
      fillContent
      onRefresh={refresh}
      onLogout={logout}
    >
      <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CardHeader className="flex flex-col gap-4 border-b border-border/70 p-5 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">Past papers</CardTitle>
              <CardDescription>
                Each past paper contains listening and reading tests. Assign bundles to study-plan days in Task Builder.
              </CardDescription>
            </div>
            {canAddPastPaper ? (
              <Button type="button" className="shrink-0 cursor-pointer" disabled={creating} onClick={() => void addPastPaper()}>
                <span className="inline-flex items-center gap-2">
                  {creating ? <InlineLoader label="Creating" size="sm" /> : <Plus className="h-4 w-4" />}
                  {!creating ? "Add past paper" : null}
                </span>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            {sortedPastPapers.length > 0 ? (
              <>
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    Showing {pageStart + 1}–{Math.min(pageStart + PAST_PAPER_PAGE_SIZE, sortedPastPapers.length)} of{" "}
                    {sortedPastPapers.length} past papers
                  </p>
                  <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                    {pagedPastPapers.map((paper) => (
                      <li key={paper.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/60">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground">{paper.title}</p>
                        <p className="text-xs text-muted-foreground">Listening and reading bundle</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {token ? (
                          <PastPaperPublishControls
                            pastPaper={paper}
                            token={token}
                            layout="header"
                            onPublishedChange={handlePastPaperPublishedChange}
                          />
                        ) : (
                          <Badge variant={paper.isPublished ? "default" : "outline"}>
                            {paper.isPublished ? "Published" : "Draft"}
                          </Badge>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="shrink-0 text-destructive hover:text-destructive"
                              aria-label={`Delete ${paper.title}`}
                              disabled={deletingId === paper.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {paper.title}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the past paper and both its listening and reading tests. This cannot be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => void deletePastPaper(paper.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="space-y-2 p-4">
                      {[paper.listeningTest, paper.readingTest].map((test) => (
                        <div
                          key={test.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-2 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/past-paper/${paper.id}/test/${test.id}`)}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                          >
                            <span className="truncate text-sm font-medium text-foreground">
                              {test.type === "LISTENING" ? "Listening" : "Reading"} · {test.title}
                            </span>
                          </button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="shrink-0"
                            aria-label={`Edit ${test.title}`}
                            onClick={() => router.push(`/admin/past-paper/${paper.id}/test/${test.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {totalPages > 1 ? (
                  <Pagination className="shrink-0 border-t border-border/50 pt-4">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            goToPage(safePage - 1);
                          }}
                          className={safePage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-3 text-sm text-muted-foreground tabular-nums">
                          Page {safePage} of {totalPages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            goToPage(safePage + 1);
                          }}
                          className={safePage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                No past papers yet. Use &quot;Add past paper&quot; to create your first bundle.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}
