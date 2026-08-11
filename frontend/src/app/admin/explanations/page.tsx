"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  WorkspaceAccessDeniedState,
  WorkspaceErrorAlert,
  WorkspaceLoadingState
} from "@/components/layout/workspace-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";

/**
 * Admin → Explanations.
 *
 * Drafting explanations without a way to read and approve them would be
 * shipping something unusable: a Claude draft is never served to a student, so
 * until someone approves it, generating one changes nothing.
 *
 * The screen is built around the one judgement that matters — is this
 * explanation right? — so the evidence quote, the reasoning and the option
 * verdicts are all visible at once, and approving is one click.
 */

type OptionVerdict = "correct" | "distractor" | "partial";

type Row = {
  id: string;
  questionNumber: number;
  part: "A" | "B" | "C" | null;
  evidence: string;
  evidenceLetter: string | null;
  reasoning: string;
  skillTag: string | null;
  options: Record<string, { verdict: OptionVerdict; why: string }> | null;
  status: "DRAFT" | "APPROVED";
  model: string | null;
  generatedAt: string | null;
  editedAt: string | null;
};

type Detail = { testId: string; title: string; total: number; approved: number; draft: number; items: Row[] };

type TestRow = { id: string; title: string; type: string; isPublished: boolean; totalQuestions: number };

const VERDICT_LABEL: Record<OptionVerdict, string> = {
  correct: "Correct",
  partial: "Partial distractor",
  distractor: "Distractor"
};

export default function AdminExplanationsPage() {
  const { token, profile, status, error, logout, refresh } = useSession();

  const [tests, setTests] = useState<TestRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState<{ evidence: string; reasoning: string }>({ evidence: "", reasoning: "" });

  const loadTests = useCallback(async () => {
    if (!token || profile?.role !== "ADMIN") return;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await apiFetch<TestRow[] | { items: TestRow[] }>("/admin/oet-tests/reading", { token });
      const list = Array.isArray(rows) ? rows : (rows.items ?? []);
      setTests(list.filter((t) => t.type === "READING"));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the Reading papers.");
    } finally {
      setLoading(false);
    }
  }, [token, profile?.role]);

  const loadDetail = useCallback(
    async (testId: string) => {
      try {
        setDetail(await apiFetch<Detail>(`/admin/oet-tests/${testId}/explanations`, { token }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load that paper.");
      }
    },
    [token]
  );

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
  }, [selected, loadDetail]);

  const generate = async (regenerateAll = false) => {
    if (!selected) return;
    setBusy(true);
    try {
      const out = await apiFetch<{ generated: number; unverified: number; message: string }>(
        `/admin/oet-tests/${selected}/explanations/generate`,
        { method: "POST", token, body: { regenerateAll } }
      );
      toast[out.unverified > 0 ? "warning" : "success"](out.message);
      await loadDetail(selected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
    try {
      await apiFetch(path, { method, token, body });
      if (selected) await loadDetail(selected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work.");
    }
  };

  const startEdit = (r: Row) => {
    setEditing(r.id);
    setDraftText({ evidence: r.evidence, reasoning: r.reasoning });
  };

  const saveEdit = async (id: string) => {
    await act(`/admin/explanations/${id}`, "PATCH", draftText);
    setEditing(null);
    toast.success("Saved. A re-import will no longer overwrite this one.");
  };

  const filtered = useMemo(
    () => tests.filter((t) => !search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase())),
    [tests, search]
  );

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading explanations…" layout="analytics" />;
  }
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage explanations."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const drafts = detail?.items.filter((i) => i.status === "DRAFT") ?? [];

  return (
    <AdminShell
      title="Answer explanations"
      description="Why each answer is the answer — the evidence in the passage, and what made each wrong option wrong."
      profile={profile}
      onRefresh={() => void loadTests()}
      onLogout={() => logout()}
      stats={[
        { label: "Reading papers", value: tests.length },
        { label: "Covered", value: detail ? `${detail.approved}/${detail.total}` : "—" },
        { label: "Awaiting review", value: detail ? detail.draft : "—" }
      ]}
    >
      <div className="space-y-6">
        {loadError ? <WorkspaceErrorAlert description={loadError} /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Choose a paper</CardTitle>
            <CardDescription>
              Papers imported with explanations already in their JSON are live the moment they land.
              Anything drafted here is held until you approve it — students never see a draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search papers" className="max-w-sm" />
            {loading ? (
              <WorkspaceLoadingState title="Loading papers…" layout="table" />
            ) : filtered.length === 0 ? (
              <EmptyState title="No Reading papers" description="Import a Reading test or past paper first." />
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paper</TableHead>
                      <TableHead className="text-right">Questions</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id} className={selected === t.id ? "bg-muted/50" : undefined}>
                        <TableCell>
                          <p className="text-sm font-medium">{t.title}</p>
                          {!t.isPublished ? <p className="text-xs text-muted-foreground">Unpublished</p> : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{t.totalQuestions}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant={selected === t.id ? "default" : "outline"} onClick={() => setSelected(t.id)}>
                            {selected === t.id ? "Selected" : "Open"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {detail ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{detail.title}</CardTitle>
                <CardDescription>
                  {detail.approved} of {detail.total} questions have a published explanation
                  {detail.draft > 0 ? `, and ${detail.draft} are waiting for you.` : "."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void generate(false)} disabled={busy}>
                  {busy ? "Drafting…" : "Draft the missing ones"}
                </Button>
                <Button variant="outline" onClick={() => void generate(true)} disabled={busy}>
                  Redraft everything
                </Button>
                {detail.draft > 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => void act(`/admin/oet-tests/${detail.testId}/explanations/approve-all`, "POST")}
                  >
                    Approve all {detail.draft} drafts
                  </Button>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  Drafting a full paper takes a couple of minutes and costs a few cents.
                </span>
              </CardContent>
            </Card>

            {drafts.length > 0 ? (
              <Alert>
                <AlertTitle>Read these before approving</AlertTitle>
                <AlertDescription>
                  An explanation sits directly beside an answer key, so students read it as
                  authoritative. Check the evidence is really the sentence the answer comes from, and
                  that anything marked a partial distractor genuinely is one — true in the passage,
                  but not an answer to the question asked.
                </AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Questions</CardTitle>
                <CardDescription>Drafts first. Approve, edit, or delete and redraft.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {detail.items.length === 0 ? (
                  <EmptyState
                    title="Nothing yet"
                    description="Use “Draft the missing ones”, or import the paper with explanations in its JSON."
                  />
                ) : (
                  [...detail.items]
                    .sort((a, b) => (a.status === b.status ? a.questionNumber - b.questionNumber : a.status === "DRAFT" ? -1 : 1))
                    .map((r) => (
                      <div key={r.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Q{r.questionNumber}</Badge>
                          {r.part ? <Badge variant="outline">Part {r.part}</Badge> : null}
                          {r.status === "APPROVED" ? (
                            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                              Draft
                            </Badge>
                          )}
                          {r.skillTag ? <span className="text-xs text-muted-foreground">{r.skillTag}</span> : null}
                          {r.editedAt ? <span className="text-xs text-muted-foreground">edited by hand</span> : null}
                          {r.model ? <span className="text-xs text-muted-foreground">drafted</span> : null}

                          <div className="ml-auto flex gap-2">
                            {editing === r.id ? (
                              <>
                                <Button size="sm" onClick={() => void saveEdit(r.id)}>
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                                  Edit
                                </Button>
                                {r.status === "DRAFT" ? (
                                  <Button size="sm" onClick={() => void act(`/admin/explanations/${r.id}/approve`, "POST")}>
                                    Approve
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void act(`/admin/explanations/${r.id}/unapprove`, "POST")}
                                  >
                                    Unpublish
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {editing === r.id ? (
                          <div className="mt-3 space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Evidence — must be quoted exactly from the passage
                            </label>
                            <Textarea
                              rows={3}
                              value={draftText.evidence}
                              onChange={(e) => setDraftText((d) => ({ ...d, evidence: e.target.value }))}
                            />
                            <label className="text-xs font-medium text-muted-foreground">Reasoning</label>
                            <Textarea
                              rows={4}
                              value={draftText.reasoning}
                              onChange={(e) => setDraftText((d) => ({ ...d, reasoning: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <blockquote className="border-l-2 border-amber-300 bg-amber-50/60 px-3 py-2 text-xs italic text-amber-900">
                              {r.evidence}
                              {r.evidenceLetter ? (
                                <span className="ml-2 not-italic opacity-70">· Text {r.evidenceLetter}</span>
                              ) : null}
                            </blockquote>
                            <p className="text-sm text-muted-foreground">{r.reasoning}</p>
                            {r.options ? (
                              <ul className="space-y-1">
                                {Object.entries(r.options).map(([k, v]) => (
                                  <li key={k} className="flex gap-2 text-xs">
                                    <span className="font-semibold">{k}</span>
                                    <span
                                      className={
                                        v.verdict === "correct"
                                          ? "font-medium text-emerald-700"
                                          : v.verdict === "partial"
                                            ? "font-medium text-amber-700"
                                            : "font-medium text-muted-foreground"
                                      }
                                    >
                                      {VERDICT_LABEL[v.verdict]}
                                    </span>
                                    <span className="text-muted-foreground">{v.why}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
