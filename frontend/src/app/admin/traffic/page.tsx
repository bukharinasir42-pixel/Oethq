"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  WorkspaceAccessDeniedState,
  WorkspaceErrorAlert,
  WorkspaceLoadingState
} from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";

type ChannelRow = {
  channel: string;
  label: string;
  visitors: number;
  signups: number;
  buyers: number;
  revenue: number;
  conversationCount: number;
  signupRate: number | null;
};

type Summary = {
  from: string;
  to: string;
  totals: { visitors: number; pageViews: number; signups: number; buyers: number; revenue: number; conversations: number };
  firstTouch: ChannelRow[];
  lastTouch: ChannelRow[];
  daily: Array<{ day: string; visitors: number; signups: number }>;
  topSources: Array<{ source: string; channel: string; visitors: number; signups: number }>;
  topCampaigns: Array<{ campaign: string; visitors: number; signups: number }>;
};

type VisitorRow = {
  id: string;
  firstChannel: string;
  firstChannelLabel: string;
  firstSource: string | null;
  firstCampaign: string | null;
  firstReferrer: string | null;
  firstLandingPath: string | null;
  firstSeenAt: string;
  lastChannelLabel: string;
  lastSeenAt: string;
  pageViews: number;
  sessions: number;
  country: string | null;
  conversations: number;
  user: { id: string; name: string; email: string; createdAt: string } | null;
};

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 }
];

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (v: string) => new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** A bar sized against the largest row, so the shape is readable at a glance. */
function Bar({ value, max, tone = "sky" }: { value: number; max: number; tone?: "sky" | "green" }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${tone === "green" ? "bg-emerald-500" : "bg-sky-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ChannelTable({ rows, showMoney }: { rows: ChannelRow[]; showMoney: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  if (rows.length === 0) {
    return <EmptyState title="No traffic yet" description="Visits will appear here as soon as the site is live." />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[190px]">Channel</TableHead>
            <TableHead className="text-right">Visitors</TableHead>
            {showMoney ? (
              <>
                <TableHead className="text-right">Signups</TableHead>
                <TableHead className="text-right">Signup rate</TableHead>
                <TableHead className="text-right">Buyers</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Chats</TableHead>
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.channel}>
              <TableCell>
                <p className="text-sm font-semibold">{r.label}</p>
                <div className="mt-1.5 max-w-[220px]">
                  <Bar value={r.visitors} max={max} />
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.visitors.toLocaleString()}</TableCell>
              {showMoney ? (
                <>
                  <TableCell className="text-right tabular-nums">{r.signups.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.signupRate === null ? "—" : `${r.signupRate}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.buyers.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{money(r.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.conversationCount.toLocaleString()}
                  </TableCell>
                </>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminTrafficPage() {
  const { token, profile, status, error, logout, refresh } = useSession();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [visitorTotal, setVisitorTotal] = useState(0);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const load = useCallback(async () => {
    if (!token || profile?.role !== "ADMIN") return;
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams({ from: range.from, to: range.to });
      const s = await apiFetch<Summary>(`/admin/traffic/summary?${qs.toString()}`, { token });
      setSummary(s);

      const vq = new URLSearchParams({ take: "50" });
      if (channelFilter) vq.set("channel", channelFilter);
      if (search.trim()) vq.set("search", search.trim());
      const v = await apiFetch<{ total: number; items: VisitorRow[] }>(`/admin/traffic/visitors?${vq.toString()}`, { token });
      setVisitors(v.items);
      setVisitorTotal(v.total);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the traffic report.");
    } finally {
      setLoading(false);
    }
  }, [token, profile?.role, range, channelFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading traffic…" layout="analytics" />;
  }
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to see where your traffic comes from."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const t = summary?.totals;
  const maxDaily = Math.max(1, ...(summary?.daily ?? []).map((d) => d.visitors));

  return (
    <AdminShell
      title="Traffic"
      description="Where your visitors come from, and which of those channels turn into students."
      profile={profile}
      onRefresh={() => void load()}
      onLogout={() => logout()}
      stats={[
        { label: "Visitors", value: t?.visitors.toLocaleString() ?? "—" },
        { label: "Signups", value: t?.signups.toLocaleString() ?? "—" },
        { label: "Buyers", value: t?.buyers.toLocaleString() ?? "—" },
        { label: "Revenue", value: t ? money(t.revenue) : "—" }
      ]}
    >
      <div className="space-y-6">
        {loadError ? <WorkspaceErrorAlert description={loadError} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={days === r.days ? "default" : "outline"}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {summary ? `${when(summary.from)} — ${when(summary.to)}` : null}
          </span>
        </div>

        {loading && !summary ? (
          <WorkspaceLoadingState title="Loading traffic…" layout="analytics" />
        ) : null}

        {summary ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Where your students came from</CardTitle>
                <CardDescription>
                  First touch — the channel that found each person, credited with everything they went on
                  to do. This is the number to spend against: someone who discovers you on YouTube and
                  comes back a week later by typing the address is still a YouTube student.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChannelTable rows={summary.firstTouch} showMoney />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Last click</CardTitle>
                  <CardDescription>
                    The most recent channel each visitor arrived through. Useful for spotting what brings
                    people back. Signups and revenue are not repeated here — they are credited once, to
                    first touch, so the same sale is never counted twice.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChannelTable rows={summary.lastTouch} showMoney={false} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Visitors per day</CardTitle>
                  <CardDescription>New browsers seen each day, and the signups on the same day.</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.daily.length === 0 ? (
                    <EmptyState title="Nothing yet" description="Daily traffic appears once visits start arriving." />
                  ) : (
                    <div className="space-y-2">
                      {summary.daily.slice(-21).map((d) => (
                        <div key={d.day} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
                          <span className="text-xs tabular-nums text-muted-foreground">{d.day.slice(5)}</span>
                          <Bar value={d.visitors} max={maxDaily} />
                          <span className="text-xs tabular-nums">
                            {d.visitors}
                            {d.signups > 0 ? <span className="ml-2 text-emerald-600">+{d.signups}</span> : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top sources</CardTitle>
                  <CardDescription>The exact site or tag behind each channel.</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.topSources.length === 0 ? (
                    <EmptyState title="No sources yet" description="Sources appear as visits arrive." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead className="text-right">Visitors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.topSources.map((s) => (
                          <TableRow key={`${s.source}-${s.channel}`}>
                            <TableCell className="font-medium">{s.source}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{s.channel.replace(/_/g, " ").toLowerCase()}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{s.visitors}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Campaigns</CardTitle>
                  <CardDescription>
                    Only links you tagged with <code className="text-xs">utm_campaign</code> appear here.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.topCampaigns.length === 0 ? (
                    <EmptyState
                      title="No campaigns tagged yet"
                      description="Add ?utm_source=youtube&utm_campaign=name to a link to track it by name."
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead className="text-right">Visitors</TableHead>
                          <TableHead className="text-right">Signups</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.topCampaigns.map((cp) => (
                          <TableRow key={cp.campaign}>
                            <TableCell className="font-medium">{cp.campaign}</TableCell>
                            <TableCell className="text-right tabular-nums">{cp.visitors}</TableCell>
                            <TableCell className="text-right tabular-nums">{cp.signups}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Individual visitors</CardTitle>
                <CardDescription>
                  The most recent 50. Nothing personal is stored for a visitor who never signs up — only
                  the channel, the landing page and a random id for their browser.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by email, source, campaign or landing page"
                    className="max-w-sm"
                  />
                  <Button
                    size="sm"
                    variant={channelFilter === null ? "default" : "outline"}
                    onClick={() => setChannelFilter(null)}
                  >
                    All channels
                  </Button>
                  {summary.firstTouch
                    // UNATTRIBUTED is a reporting bucket, not a stored channel —
                    // filtering by it would silently return everything.
                    .filter((r) => r.channel !== "UNATTRIBUTED")
                    .slice(0, 6)
                    .map((r) => (
                      <Button
                        key={r.channel}
                        size="sm"
                        variant={channelFilter === r.channel ? "default" : "outline"}
                        onClick={() => setChannelFilter(r.channel)}
                      >
                        {r.label}
                      </Button>
                    ))}
                  <span className="ml-auto text-xs text-muted-foreground">{visitorTotal.toLocaleString()} total</span>
                </div>

                {visitors.length === 0 ? (
                  <EmptyState title="No visitors match" description="Try a wider date range or clear the filters." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Came from</TableHead>
                          <TableHead>Landed on</TableHead>
                          <TableHead className="text-right">Pages</TableHead>
                          <TableHead>First seen</TableHead>
                          <TableHead>Became a student</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitors.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{v.firstChannelLabel}</p>
                              <p className="text-xs text-muted-foreground">
                                {v.firstSource ?? "—"}
                                {v.firstCampaign ? ` · ${v.firstCampaign}` : ""}
                              </p>
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                              {v.firstLandingPath ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{v.pageViews}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{when(v.firstSeenAt)}</TableCell>
                            <TableCell>
                              {v.user ? (
                                <>
                                  <p className="text-sm font-medium">{v.user.name}</p>
                                  <p className="text-xs text-muted-foreground">{v.user.email}</p>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not yet</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How to read this</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Direct</strong> is not a channel you can buy. It is
                  everyone whose browser sent no referrer: typed addresses, bookmarks, and — this is the
                  big one — links opened inside apps. WhatsApp, Instagram and most in-app browsers strip
                  the referrer, so genuine social traffic lands here unless the link is tagged.
                </p>
                <p>
                  <strong className="text-foreground">To fix that, tag your links.</strong> Add{" "}
                  <code className="text-xs">?utm_source=youtube&amp;utm_campaign=reading-launch</code> to
                  the link in a video description or a bio, and it will be attributed exactly, referrer or
                  not.
                </p>
                <p>
                  <strong className="text-foreground">Created by admin</strong> covers accounts you made
                  by hand. They are separated so they never inflate a marketing channel.
                </p>
                <p>
                  <strong className="text-foreground">Not tracked</strong> is everyone who signed up
                  before this page existed, plus anyone whose browser blocked the visit ping. Expect all
                  of your existing students and all past revenue to sit here on day one — that is history
                  that was never recorded, not a channel. It stops growing from the moment this is live.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
