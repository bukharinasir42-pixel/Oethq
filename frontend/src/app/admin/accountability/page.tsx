"use client";

/**
 * /admin/accountability — daily student accountability. For a chosen UTC day it
 * shows every active student with a tick per activity (lecture, test, spelling,
 * podcast, article) and lets the admin email a "complete your tasks" warning to
 * anyone falling behind (per-student or bulk to everyone incomplete).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Loader2, Mail, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { accountabilityApi, dayKeyToDate, dateToDayKey, todayKey, type AccountabilityRoster, type AccountabilityStudent } from "@/lib/accountability-api";

const ACTIVITIES: { key: keyof AccountabilityStudent["done"]; label: string }[] = [
  { key: "lecture", label: "Lecture" },
  { key: "test", label: "Test" },
  { key: "spelling", label: "Spelling" },
  { key: "podcast", label: "Podcast" },
  { key: "article", label: "Article" }
];

function Tick({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check className="h-3.5 w-3.5" /></span>
  ) : (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-500"><X className="h-3.5 w-3.5" /></span>
  );
}

export default function AdminAccountabilityPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [day, setDay] = useState<number>(() => todayKey());
  const [data, setData] = useState<AccountabilityRoster | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Filters. All of these run over the roster the API already returns, so
  // changing one costs no request — the day picker is the only thing that reloads.
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<"all" | "incomplete" | "done" | "submitted" | "not-submitted">("all");
  const [missingFilter, setMissingFilter] = useState<string>("all");
  const [warning, setWarning] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async (d: number) => {
    if (!token || profile?.role !== "ADMIN") return;
    setLoading(true);
    setLoadError(null);
    try {
      setData(await accountabilityApi.roster(d, token));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token, profile]);

  useEffect(() => { void load(day); }, [day, load]);

  // Memoised: it feeds several useMemo filters below, and a fresh [] each render
  // would invalidate all of them on every keystroke.
  const students = useMemo(() => data?.students ?? [], [data]);
  const plans = useMemo(
    () => Array.from(new Set(students.map((s) => s.plan).filter((p): p is string => Boolean(p)))).sort(),
    [students]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !`${s.name} ${s.email}`.toLowerCase().includes(q)) return false;
      if (planFilter !== "all" && (s.plan ?? "") !== planFilter) return false;
      if (stateFilter === "incomplete" && s.missed === 0) return false;
      if (stateFilter === "done" && s.missed > 0) return false;
      if (stateFilter === "submitted" && !s.submitted) return false;
      if (stateFilter === "not-submitted" && s.submitted) return false;
      // "Missed X" — the activity is explicitly not done for this day.
      if (missingFilter !== "all" && s.done[missingFilter as keyof typeof s.done]) return false;
      return true;
    });
  }, [students, query, planFilter, stateFilter, missingFilter]);

  const filtersOn = query.trim() !== "" || planFilter !== "all" || stateFilter !== "all" || missingFilter !== "all";
  const clearFilters = () => { setQuery(""); setPlanFilter("all"); setStateFilter("all"); setMissingFilter("all"); };
  const incomplete = useMemo(() => students.filter((s) => s.missed > 0), [students]);

  const warnOne = async (s: AccountabilityStudent) => {
    setWarning(s.userId);
    try {
      const r = await accountabilityApi.warn(s.userId, day);
      toast.success(r.delivered ? `Warning emailed to ${s.name}` : `Queued for ${s.name} (mail not delivered in this env)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setWarning(null);
    }
  };

  const warnAllIncomplete = async () => {
    if (incomplete.length === 0) return;
    if (!window.confirm(`Email a warning to all ${incomplete.length} student(s) with missing tasks for ${dayKeyToDate(day)}?`)) return;
    setBulkBusy(true);
    try {
      const r = await accountabilityApi.warnBulk(incomplete.map((s) => s.userId), day);
      toast.success(`Warnings sent: ${r.sent} of ${r.requested}${r.failed ? ` · ${r.failed} failed` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk send failed");
    } finally {
      setBulkBusy(false);
    }
  };

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading accountability…" layout="table" />;
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return <WorkspaceAccessDeniedState title="Admin access required" description={error || "Sign in with an admin account."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />;
  }

  const isToday = day === todayKey();

  return (
    <AdminShell title="Accountability" description="Track daily student completion and nudge anyone falling behind." profile={profile} onRefresh={() => void load(day)} onLogout={logout}>
      {loadError ? <WorkspaceErrorAlert title="Unable to load" description={loadError} /> : null}

      {/* controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/12 text-primary"><CalendarCheck className="h-4.5 w-4.5" /></span>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setDay((d) => d - 1)} title="Previous day"><ChevronLeft className="h-4 w-4" /></Button>
          <input type="date" value={dayKeyToDate(day)} max={dayKeyToDate(todayKey())} onChange={(e) => e.target.value && setDay(dateToDayKey(e.target.value))} className="h-9 rounded-md border border-border bg-background px-2.5 text-sm" />
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setDay((d) => Math.min(todayKey(), d + 1))} disabled={isToday} title="Next day"><ChevronRight className="h-4 w-4" /></Button>
          {!isToday ? <Button type="button" variant="ghost" size="sm" onClick={() => setDay(todayKey())}>Today</Button> : <Badge variant="secondary">Today</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data ? (
            <span className="text-xs text-muted-foreground">
              <b className="text-sky-600">{data.summary.submitted}</b> submitted work · <b className="text-emerald-600">{data.summary.allDone}</b> all tasks · <b className="text-rose-500">{data.summary.incomplete}</b> behind · {data.summary.total} active
            </span>
          ) : null}
          <Button type="button" onClick={() => void warnAllIncomplete()} disabled={bulkBusy || incomplete.length === 0} className="cursor-pointer">
            {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Warn all incomplete ({incomplete.length})
          </Button>
        </div>

        {/* Filters — all client-side over the day's roster, so no reload. */}
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="relative min-w-[190px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              aria-label="Search students by name or email"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2.5 text-sm"
            />
          </div>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label="Filter by course or plan"
            className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="all">All courses</option>
            {plans.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)}
            aria-label="Filter by completion state"
            className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="all">Any state</option>
            <option value="incomplete">Behind — missed something</option>
            <option value="done">Completed everything</option>
            <option value="submitted">Submitted their work</option>
            <option value="not-submitted">Did not submit</option>
          </select>

          <select
            value={missingFilter}
            onChange={(e) => setMissingFilter(e.target.value)}
            aria-label="Filter by which activity was missed"
            className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="all">Missed anything</option>
            {ACTIVITIES.map((a) => <option key={a.key} value={a.key}>Missed {a.label.toLowerCase()}</option>)}
          </select>

          <span className="text-xs text-muted-foreground tabular-nums">
            {shown.length} of {students.length}
          </span>
          {filtersOn ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="max-h-[min(70vh,48rem)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="text-center">Submitted work</TableHead>
                {ACTIVITIES.map((a) => <TableHead key={a.key} className="text-center">{a.label}</TableHead>)}
                <TableHead className="text-center">Done</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
              ) : shown.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">{filtersOn ? "No students match these filters." : "No active students."}</TableCell></TableRow>
              ) : shown.map((s) => (
                <TableRow key={s.userId} className={s.missed === 0 ? "bg-emerald-50/40" : undefined}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}{s.plan ? ` · ${s.plan}` : ""}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {s.submitted
                      ? <Badge className="bg-sky-600 hover:bg-sky-600">Submitted</Badge>
                      : <Badge variant="outline" className="border-rose-300 text-rose-500">Not yet</Badge>}
                  </TableCell>
                  {ACTIVITIES.map((a) => <TableCell key={a.key} className="text-center"><div className="flex justify-center"><Tick ok={s.done[a.key]} /></div></TableCell>)}
                  <TableCell className="text-center">
                    <Badge variant={s.missed === 0 ? "default" : "outline"} className={s.missed === 0 ? "bg-emerald-600" : ""}>{s.completed}/5</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={s.missed === 0 || warning === s.userId} onClick={() => void warnOne(s)}>
                      {warning === s.userId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />} Warn
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminShell>
  );
}
