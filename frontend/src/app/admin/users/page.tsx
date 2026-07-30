"use client";

import { useEffect, useMemo, useState } from "react";
import { UsersRound, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { UserProgramDialog } from "@/components/admin/user-program-dialog";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { RegistryUserDto } from "@/lib/types";
import { HEARD_FROM, PROFESSIONS, heardFromStyle } from "@/lib/profile-options";

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function SourceBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const s = heardFromStyle(value);
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

const selectCls = "h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground";

export default function AdminUsersRegistryPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [rows, setRows] = useState<RegistryUserDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [professionFilter, setProfessionFilter] = useState("");
  const [heardFilter, setHeardFilter] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!token || !profile || profile.role !== "ADMIN") return;
      try {
        const res = await apiFetch<RegistryUserDto[]>("/users", { token });
        setRows(res);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : "Failed to load users");
      }
    };
    void load();
  }, [token, profile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      if (professionFilter && u.profession !== professionFilter) return false;
      if (heardFilter && u.heardFrom !== heardFilter) return false;
      if (q && !(`${u.name} ${u.email}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, search, professionFilter, heardFilter]);

  // Source breakdown across the currently filtered set (for "track everything").
  const sourceCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of filtered) if (u.heardFrom) m.set(u.heardFrom, (m.get(u.heardFrom) ?? 0) + 1);
    return HEARD_FROM.map((h) => ({ ...h, count: m.get(h.value) ?? 0 })).filter((h) => h.count > 0);
  }, [filtered]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading registry…" layout="table" />;
  }

  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to view the user registry."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const activeFilters = !!(search || professionFilter || heardFilter);

  return (
    <AdminShell
      title="All registered users"
      description="Directory of accounts with profession, acquisition source and the latest subscription per user."
      profile={profile}
      onRefresh={refresh}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Unable to load users" description={loadError} /> : null}

      {/* filter bar */}
      <div className="mb-4 rounded-[16px] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-9" />
          </div>
          <select className={selectCls} value={professionFilter} onChange={(e) => setProfessionFilter(e.target.value)}>
            <option value="">All professions</option>
            {PROFESSIONS.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
          <select className={selectCls} value={heardFilter} onChange={(e) => setHeardFilter(e.target.value)}>
            <option value="">All sources</option>
            {HEARD_FROM.map((h) => (<option key={h.value} value={h.value}>{h.label}</option>))}
          </select>
          {activeFilters ? (
            <button type="button" onClick={() => { setSearch(""); setProfessionFilter(""); setHeardFilter(""); }} className="text-xs font-medium text-primary hover:underline">
              Clear filters
            </button>
          ) : null}
        </div>
        {sourceCounts.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source mix:</span>
            {sourceCounts.map((h) => (
              <span key={h.value} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: h.color, background: h.bg }}>
                {h.label} <b>{h.count}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-primary/12 text-primary">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-[hsl(var(--primary-deep))]">Registry</p>
            <p className="text-xs text-muted-foreground">
              {filtered.length}{activeFilters ? ` of ${rows.length}` : ""} user{filtered.length === 1 ? "" : "s"} · sorted by newest first
            </p>
          </div>
        </div>
        <div className="max-h-[min(70vh,48rem)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Profession</TableHead>
                <TableHead>Heard from</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Latest plan</TableHead>
                <TableHead>Sub status</TableHead>
                <TableHead>Program</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const sub = u.subscriptions[0];
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{u.profession || <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell><SourceBadge value={u.heardFrom} /></TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{sub?.plan?.name ?? "—"}</TableCell>
                    <TableCell>
                      {sub ? <Badge variant="secondary">{sub.status}</Badge> : <span className="text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {u.role === "CANDIDATE" ? <UserProgramDialog userId={u.id} userName={u.name || u.email} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminShell>
  );
}
