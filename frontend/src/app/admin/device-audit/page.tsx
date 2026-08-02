"use client";

/**
 * /admin/device-audit — accounts that look shared, and the controls to act.
 *
 * The table is a triage queue, not a verdict. Every row carries the plain
 * reasons behind its score so an admin decides, and expanding a row shows the
 * actual devices — where each signed in from, when it was last used, and whether
 * the two-device cap pushed it out. Two countries in a week is the signal that
 * matters; everything else is corroboration.
 *
 * Three actions, escalating: end one device, sign the student out everywhere,
 * or block the account so they cannot sign in at all.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight, Globe, Loader2, Search, ShieldBan, ShieldCheck, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { deviceAuditApi, type DeviceList, type FlaggedAccount, type SharingReport } from "@/lib/device-audit-api";

const RISK_STYLE: Record<string, string> = {
  high: "bg-rose-600 hover:bg-rose-600",
  medium: "bg-amber-500 hover:bg-amber-500",
  low: "bg-slate-400 hover:bg-slate-400"
};

/** "GB" → "🇬🇧" — flags read faster than codes when scanning a column. */
function flag(cc: string) {
  if (!/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const when = (iso: string) => new Date(iso).toLocaleString();

function DeviceDetail({ userId }: { userId: string }) {
  const [data, setData] = useState<DeviceList | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await deviceAuditApi.devices(userId));
    } catch {
      setData(null);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  if (!data) {
    return <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-2 px-2 py-3">
      {data.sessions.map((s) => (
        <div
          key={s.id}
          className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs ${
            s.live ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-muted/30"
          }`}
        >
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
            {s.label}
          </span>
          <span className="text-muted-foreground">
            {s.country ? `${flag(s.country)} ${s.country}` : "Unknown"}
            {s.city ? ` · ${s.city}` : ""}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">{s.ip ?? "—"}</span>
          <span className="text-muted-foreground">Last used {when(s.lastSeenAt)}</span>
          {s.revokedAt ? (
            <Badge variant="outline" className="text-[10px]">
              {s.revokedReason === "device_limit" ? "Pushed out by the limit" : s.revokedReason === "signed_out" ? "Signed out" : "Ended by admin"}
            </Badge>
          ) : (
            <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">Active</Badge>
          )}
          {s.live ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-6 px-2 text-[11px] text-destructive hover:text-destructive"
              disabled={busy === s.id}
              onClick={async () => {
                setBusy(s.id);
                try {
                  await deviceAuditApi.revokeDevice(s.id);
                  toast.success("Device signed out");
                  await load();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Could not end that device");
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "End this device"}
            </Button>
          ) : null}
        </div>
      ))}
      {data.sessions.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">No devices recorded yet.</p>
      ) : null}
    </div>
  );
}

export default function DeviceAuditPage() {
  const { profile, status, error, refresh, logout } = useSession();
  const [report, setReport] = useState<SharingReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<"ALL" | "high" | "medium">("ALL");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setReport(await deviceAuditApi.report());
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load the device audit");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile || profile.role !== "ADMIN") return;
    void load();
  }, [load, profile]);

  const rows = useMemo(() => {
    const all = report?.flagged ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (risk !== "ALL" && r.risk !== risk) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    });
  }, [report, query, risk]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "That did not go through");
    } finally {
      setBusy(null);
    }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading device audit…" layout="table" />;
  }
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to view the device audit."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell
      title="Device audit"
      description="Accounts showing signs of being shared, with the devices behind each."
      profile={profile}
      onRefresh={() => void load()}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Unable to load" description={loadError} /> : null}

      {report?.geoUnavailable ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <Globe className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No country data is reaching the app, so location columns read Unknown and country cannot
            contribute to a score. Country comes from the CDN in front of the site (Cloudflare, Vercel,
            Fastly, CloudFront). Turn on IP geolocation headers there and it will populate from the next
            sign-in — no code change needed. Device counts, evictions and IP spread work regardless.
          </span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {(["ALL", "high", "medium"] as const).map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={risk === k ? "default" : "outline"}
            className="h-9 px-3 text-xs"
            onClick={() => setRisk(k)}
          >
            {k === "ALL" ? "All flagged" : k === "high" ? "High risk" : "Medium"}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} flagged of {report?.totalAccounts ?? 0} accounts with devices
        </span>
      </div>

      {loading && !report ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing looks shared"
          description="No account is showing enough signals to flag. This page fills in as students sign in from more places."
        />
      ) : (
        <div className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Student</TableHead>
                <TableHead>Why it is flagged</TableHead>
                <TableHead className="text-center">Countries</TableHead>
                <TableHead className="text-center">Devices</TableHead>
                <TableHead className="text-center">Pushed out</TableHead>
                <TableHead className="text-center">Risk</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: FlaggedAccount) => {
                const open = openRow === r.userId;
                return (
                  <>
                    <TableRow key={r.userId} className={r.suspended ? "bg-rose-50/50" : undefined}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-muted-foreground"
                          onClick={() => setOpenRow(open ? null : r.userId)}
                          aria-label={open ? "Hide devices" : "Show devices"}
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Link href={`/admin/accountability/${r.userId}`} className="text-sm font-medium text-foreground hover:underline">
                          {r.name}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">{r.email}</p>
                        {r.suspended ? (
                          <Badge variant="outline" className="mt-1 border-rose-300 text-[10px] text-rose-600">Blocked</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <ul className="space-y-0.5">
                          {r.reasons.map((reason) => (
                            <li key={reason} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {r.countries.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span title={r.countries.join(", ")}>
                            {r.countries.map((c) => flag(c)).join(" ")} {r.countries.length > 1 ? `(${r.countries.length})` : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {r.liveDevices}<span className="text-muted-foreground">/{r.devices}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{r.evictions}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={RISK_STYLE[r.risk] ?? ""}>{r.risk}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            disabled={busy !== null || r.liveDevices === 0}
                            onClick={() =>
                              void act(`out-${r.userId}`, () => deviceAuditApi.revokeAll(r.userId), "Signed out everywhere")
                            }
                          >
                            {busy === `out-${r.userId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sign out all"}
                          </Button>
                          {r.suspended ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px]"
                              disabled={busy !== null}
                              onClick={() => void act(`un-${r.userId}`, () => deviceAuditApi.reinstate(r.userId), "Account unblocked")}
                            >
                              {busy === `un-${r.userId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unblock"}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-[11px]"
                              disabled={busy !== null}
                              onClick={() => {
                                const reason = window.prompt(
                                  `Block ${r.name}? They will not be able to sign in until you unblock them.\n\nReason (shown in the security log):`,
                                  "Account sharing"
                                );
                                if (reason == null) return;
                                void act(
                                  `block-${r.userId}`,
                                  () => deviceAuditApi.suspend(r.userId, reason || "Account sharing"),
                                  "Account blocked"
                                );
                              }}
                            >
                              {busy === `block-${r.userId}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <><ShieldBan className="mr-1 h-3 w-3" />Block</>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {open ? (
                      <TableRow key={`${r.userId}-devices`}>
                        <TableCell colSpan={8} className="bg-muted/20 p-0">
                          <DeviceDetail userId={r.userId} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        These are signals, not proof. Two countries in the same week is the one that rarely has an
        innocent explanation; a high device count on its own can just mean a phone, a laptop and a
        reinstalled browser. Open a row and look at the devices before blocking anyone.
      </p>
    </AdminShell>
  );
}
