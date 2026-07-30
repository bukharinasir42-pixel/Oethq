"use client";

/**
 * /admin/security — exam-integrity: review and reinstate accounts suspended for
 * repeated screenshot attempts during tests.
 */
import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/hooks/use-session";
import { securityApi, type SuspendedUser } from "@/lib/security-api";

export default function AdminSecurityPage() {
  const { profile, status, error, logout, refresh } = useSession();
  const [rows, setRows] = useState<SuspendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await securityApi.listSuspended());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "ADMIN") void load();
  }, [load, profile]);

  const reinstate = async (u: SuspendedUser) => {
    setBusyId(u.id);
    try {
      await securityApi.reinstate(u.id);
      toast.success(`${u.name || u.email} reinstated`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reinstate");
    } finally {
      setBusyId(null);
    }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading..." layout="editor" />;
  }
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell title="Exam Security" description="Accounts suspended for screenshot attempts during tests." profile={profile} onRefresh={load} onLogout={logout}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ShieldAlert className="h-5 w-5 text-rose-600" /> Suspended accounts</CardTitle>
          <CardDescription>
            Students are suspended after 3 screenshot attempts during a test (2 warnings, then suspension). Reinstating
            clears their strike count and restores login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <WorkspaceLoadingState title="Loading suspended accounts..." layout="table" />
          ) : rows.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No suspended accounts" description="No students are currently suspended for exam-integrity reasons." />
          ) : (
            <ul className="space-y-2">
              {rows.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{u.name || "Unnamed"}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    {u.suspendedReason ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{u.suspendedReason}</p> : null}
                  </div>
                  <Badge variant="outline" className="border-rose-300 text-rose-600">{u.screenshotStrikes} strikes</Badge>
                  {u.suspendedAt ? (
                    <span className="text-[11px] text-muted-foreground">{new Date(u.suspendedAt).toLocaleString()}</span>
                  ) : null}
                  <Button type="button" size="sm" disabled={busyId === u.id} onClick={() => void reinstate(u)} className="cursor-pointer">
                    {busyId === u.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Reinstate
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
