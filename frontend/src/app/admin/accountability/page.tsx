"use client";

/**
 * /admin/accountability — daily student accountability. For a chosen UTC day it
 * shows every active student with a tick per activity (lecture, test, spelling,
 * podcast, article) and lets the admin email a "complete your tasks" warning to
 * anyone falling behind (per-student or bulk to everyone incomplete).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Loader2, Mail, X } from "lucide-react";
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
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
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

  const students = data?.students ?? [];
  const shown = useMemo(() => (onlyIncomplete ? students.filter((s) => s.missed > 0) : students), [students, onlyIncomplete]);
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
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <input type="checkbox" checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
            Only incomplete
          </label>
          <Button type="button" onClick={() => void warnAllIncomplete()} disabled={bulkBusy || incomplete.length === 0} className="cursor-pointer">
            {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Warn all incomplete ({incomplete.length})
          </Button>
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
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">{onlyIncomplete ? "Everyone completed their tasks — nice." : "No active students."}</TableCell></TableRow>
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
