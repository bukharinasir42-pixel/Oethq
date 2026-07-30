"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { OetImportDialog } from "@/components/admin/oet-import-dialog";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { isPastPaperTestTitle } from "@/lib/past-paper-utils";
import { sortTestsByDay } from "@/lib/test-builder-utils";
import type { TestSummaryDto } from "@/lib/types";

export default function TestBuilderPage() {
  const router = useRouter();
  const { token, profile, status, error, logout, refresh } = useSession();
  const [tests, setTests] = useState<TestSummaryDto[]>([]);
  const [activeType, setActiveType] = useState<"LISTENING" | "READING">("LISTENING");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    if (!token) return;
    const response = await apiFetch<TestSummaryDto[]>("/tests/admin", { token });
    setTests(response);
  }, [token]);

  useEffect(() => {
    if (!token || profile?.role !== "ADMIN") return;
    void loadTests().catch((caughtError: unknown) => {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to load tests");
    });
  }, [loadTests, profile, token]);

  const testsForActiveType = useMemo(
    () =>
      sortTestsByDay(
        tests.filter((test) => test.type === activeType && !isPastPaperTestTitle(test.title))
      ),
    [activeType, tests]
  );

  const addTest = () => {
    // Both skills now use the guided builders that output an official (Rasch)
    // contentJson test — same as JSON import, but form-driven.
    if (activeType === "LISTENING") {
      router.push("/admin/test-builder/new-listening");
      return;
    }
    router.push("/admin/test-builder/new-reading");
  };

  const deleteTest = async (testId: string) => {
    setDeletingId(testId);
    try {
      await apiFetch(`/tests/${testId}`, { method: "DELETE", token });
      toast.success("Test deleted");
      await loadTests();
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to delete test");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading test builder..." layout="editor" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage Listening and Reading tests."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell
      title="Test Builder"
      description="Manage Listening and Reading tests. Open a row to edit or add a new test."
      profile={profile}
      compact
      fillContent
      onRefresh={refresh}
      onLogout={logout}
    >
      <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CardHeader className="space-y-2 border-b border-border/70 p-3">
            <CardTitle className="text-lg">Tests</CardTitle>
            <CardDescription>Select Listening or Reading, then add or open a test to edit.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-3">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Test type</Label>
                <Tabs
                  value={activeType}
                  onValueChange={(value) => setActiveType(value as "LISTENING" | "READING")}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="LISTENING">Listening</TabsTrigger>
                    <TabsTrigger value="READING">Reading</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <OetImportDialog onImported={(id) => router.push(`/admin/oet-tests/${id}`)} />
                <Button type="button" className="cursor-pointer" onClick={addTest}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add {activeType === "LISTENING" ? "Listening" : "Reading"} test
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {activeType === "LISTENING" ? "Listening" : "Reading"} tests
                </p>
                {testsForActiveType.length > 0 ? (
                  <ul className="space-y-1.5">
                    {testsForActiveType.map((test) => (
                      <li
                        key={test.id}
                        className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-2 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => router.push(test.isImported ? `/admin/oet-tests/${test.id}` : `/admin/test-builder/${test.id}`)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                        >
                          <span className="truncate text-sm font-medium text-foreground">{test.title}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {test.isImported && (
                              <Badge variant="outline" className="border-primary/30 text-primary">Imported</Badge>
                            )}
                            <Badge variant={test.isPublished ? "default" : "outline"}>
                              {test.isPublished ? "Published" : "Draft"}
                            </Badge>
                          </span>
                        </button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          aria-label={`Edit ${test.title}`}
                          onClick={() => router.push(test.isImported ? `/admin/oet-tests/${test.id}` : `/admin/test-builder/${test.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="shrink-0 text-destructive hover:text-destructive"
                              aria-label={`Delete ${test.title}`}
                              disabled={deletingId === test.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {test.title}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the test and unlinks it from any daily tasks. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => void deleteTest(test.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                    No {activeType === "LISTENING" ? "listening" : "reading"} tests yet. Use the button above to add
                    one.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}
