"use client";

/**
 * /admin/accountability/[userId] — everything one student has ever done.
 *
 * Deliberately course-agnostic: a Reading-only buyer and a Complete Course
 * student record the same activities, and this view answers "what has this
 * person actually done", not "what did they buy". Two halves — every test they
 * have submitted with its Part A/B/C breakdown, and a day-by-day trail of the
 * daily work.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, Minus } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { accountabilityApi, type StudentHistory } from "@/lib/accountability-api";

const DAILY = [
  { key: "lecture", label: "Lecture" },
  { key: "drill", label: "Drill" },
  { key: "spelling", label: "Spelling" },
  { key: "podcast", label: "Podcast" },
  { key: "article", label: "Article" }
] as const;

function Tick({ on }: { on: boolean }) {
  return on ? (
    <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="done" />
  ) : (
    <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" aria-label="not done" />
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="surface-panel-subtle rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function StudentAccountabilityPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { profile, status, error, refresh, logout } = useSession();
  const [data, setData] = useState<StudentHistory | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [skill, setSkill] = useState<"ALL" | "READING" | "LISTENING">("ALL");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);
    try {
      setData(await accountabilityApi.student(userId));
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load this student");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!profile || profile.role !== "ADMIN") return;
    void load();
  }, [load, profile]);

  const tests = useMemo(
    () => (data ? data.tests.filter((t) => skill === "ALL" || t.type === skill) : []),
    [data, skill]
  );

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading student…" layout="table" />;
  }
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to view student accountability."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const s = data?.student;
  const sum = data?.summary;

  return (
    <AdminShell
      title={s?.name || "Student"}
      description={s ? `${s.email} · joined ${new Date(s.joinedAt).toLocaleDateString()}` : "Full accountability history"}
      profile={profile}
      onRefresh={() => void load()}
      onLogout={logout}
    >
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
          <Link href="/admin/accountability">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to accountability
          </Link>
        </Button>
      </div>

      {loadError ? <WorkspaceErrorAlert title="Unable to load" description={loadError} /> : null}

      {loading && !data ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data && s && sum ? (
        <div className="space-y-6">
          {/* What they own — the answer to "which course is this?" */}
          <div className="flex flex-wrap items-center gap-2">
            {s.plan ? <Badge variant="default">{s.plan}{s.planStatus ? ` · ${s.planStatus}` : ""}</Badge> : null}
            {s.courses.map((c) => <Badge key={c.slug ?? c.name} variant="outline">{c.name}</Badge>)}
            {!s.plan && s.courses.length === 0 ? <Badge variant="outline">No active course</Badge> : null}
            {s.lastLogin ? (
              <span className="text-xs text-muted-foreground">Last login {new Date(s.lastLogin).toLocaleDateString()}</span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Stat label="Tests submitted" value={sum.testsSubmitted} />
            <Stat label="Best score" value={sum.bestScaled ?? "—"} hint="out of 500" />
            <Stat label="Average" value={sum.avgScaled ?? "—"} hint="all scored tests" />
            <Stat label="Reading avg" value={sum.avgReading ?? "—"} />
            <Stat label="Listening avg" value={sum.avgListening ?? "—"} />
            <Stat label="Days active" value={sum.activeDays} hint={`${sum.submittedDays} submitted work`} />
          </div>

          {/* ---- every test, with the full part breakdown ---- */}
          <section className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="font-display text-base font-semibold text-[hsl(var(--primary-deep))]">
                Tests submitted <span className="text-muted-foreground">({tests.length})</span>
              </h2>
              <div className="flex gap-1">
                {(["ALL", "READING", "LISTENING"] as const).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={skill === k ? "default" : "outline"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setSkill(k)}
                  >
                    {k === "ALL" ? "All" : k === "READING" ? "Reading" : "Listening"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="max-h-[26rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead className="text-center">Correct</TableHead>
                    <TableHead className="text-center">Part A</TableHead>
                    <TableHead className="text-center">Part B</TableHead>
                    <TableHead className="text-center">Part C</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        No submitted tests{skill === "ALL" ? "" : ` for ${skill.toLowerCase()}`} yet.
                      </TableCell>
                    </TableRow>
                  ) : tests.map((t) => (
                    <TableRow key={t.attemptId}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {t.submittedAt ? new Date(t.submittedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <span className="text-sm font-medium text-foreground">{t.title}</span>
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">{t.type}</span>
                        {t.autoSubmitted ? (
                          <Badge variant="outline" className="ml-2 border-amber-300 text-[10px] text-amber-700">Auto-submitted</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center font-semibold tabular-nums">{t.scaledScore ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        {t.grade ? <Badge variant={t.grade === "A" || t.grade === "B" ? "default" : "outline"}>{t.grade}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {t.score != null ? `${t.score}${t.totalQuestions ? ` / ${t.totalQuestions}` : ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">{t.partAScore ?? "—"}</TableCell>
                      <TableCell className="text-center tabular-nums text-sm">{t.partBScore ?? "—"}</TableCell>
                      <TableCell className="text-center tabular-nums text-sm">{t.partCScore ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* ---- day-by-day trail ---- */}
          <section className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-display text-base font-semibold text-[hsl(var(--primary-deep))]">
                Daily trail <span className="text-muted-foreground">({data.days.length} active days)</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Only days with activity appear. A dash means not done that day, not that it was unavailable.
              </p>
            </div>
            <div className="max-h-[26rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {DAILY.map((d) => <TableHead key={d.key} className="text-center">{d.label}</TableHead>)}
                    <TableHead className="text-center">Tests</TableHead>
                    <TableHead className="text-center">Submitted work</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.days.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        This student has not recorded any activity yet.
                      </TableCell>
                    </TableRow>
                  ) : data.days.map((d) => (
                    <TableRow key={d.dayKey} className={d.submitted ? "bg-emerald-50/40" : undefined}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{d.date}</TableCell>
                      {DAILY.map((a) => (
                        <TableCell key={a.key} className="text-center"><Tick on={d[a.key]} /></TableCell>
                      ))}
                      <TableCell className="text-center tabular-nums text-sm">{d.tests || <span className="text-muted-foreground/40">0</span>}</TableCell>
                      <TableCell className="text-center"><Tick on={d.submitted} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
