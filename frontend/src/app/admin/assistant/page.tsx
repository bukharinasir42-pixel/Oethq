"use client";

import { useCallback, useEffect, useState } from "react";
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

type Stats = {
  days: number;
  conversations: number;
  handoffs: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
};

type ConversationRow = {
  id: string;
  title: string | null;
  channel: string | null;
  source: string | null;
  messageCount: number;
  startedAt: string;
  lastMessageAt: string;
  handoffAt: string | null;
  user: { id: string; name: string; email: string } | null;
};

type MessageRow = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  errorCode: string | null;
  citedChunkIds: string[];
};

type KnowledgeSource = {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
  chunkCount: number;
  createdAt: string;
};

type SearchHit = { id: string; heading: string | null; content: string; sourceName: string; rank: number };

type Lead = {
  id: string;
  whatsapp: string;
  name: string | null;
  profession: string | null;
  examDate: string | null;
  channel: string | null;
  source: string | null;
  contactedAt: string | null;
  createdAt: string;
  conversation: { id: string; title: string | null; messageCount: number; lastMessageAt: string } | null;
};

const FORMATS = [
  {
    id: "conversation",
    label: "Exported chat",
    hint: "A WhatsApp or messenger export — lines like “12/03/2026, 14:22 - Name: message”. Split by conversation turn, with phone numbers and email addresses stripped out."
  },
  {
    id: "document",
    label: "Document or transcript",
    hint: "An FAQ sheet, a page of notes, or an audio transcript. Split on paragraphs and headings."
  },
  {
    id: "qa_json",
    label: "Question and answer list",
    hint: 'JSON: [{"question": "…", "answer": "…"}]. One pair becomes one passage — the most precise option.'
  }
] as const;

const when = (v: string) => new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminAssistantPage() {
  const { token, profile, status, error, logout, refresh } = useSession();

  const [stats, setStats] = useState<Stats | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [handoffOnly, setHandoffOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openMessages, setOpenMessages] = useState<MessageRow[]>([]);

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("conversation");
  const [text, setText] = useState("");
  const [ingesting, setIngesting] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [uncontactedOnly, setUncontactedOnly] = useState(false);

  const [probe, setProbe] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || profile?.role !== "ADMIN") return;
    setLoading(true);
    setLoadError(null);
    try {
      const q = new URLSearchParams({ take: "40" });
      if (handoffOnly) q.set("handoffOnly", "true");
      if (search.trim()) q.set("search", search.trim());
      const lq = new URLSearchParams({ take: "50" });
      if (uncontactedOnly) lq.set("uncontactedOnly", "true");
      const [s, cfg, list, kb, ld] = await Promise.all([
        apiFetch<Stats>("/admin/chat/stats", { token }),
        apiFetch<{ enabled: boolean }>("/chat/config", { token }),
        apiFetch<{ items: ConversationRow[] }>(`/admin/chat/conversations?${q.toString()}`, { token }),
        apiFetch<{ totalChunks: number; sources: KnowledgeSource[] }>("/admin/chat/knowledge", { token }),
        apiFetch<{ total: number; items: Lead[] }>(`/admin/chat/leads?${lq.toString()}`, { token })
      ]);
      setStats(s);
      setEnabled(cfg.enabled);
      setConversations(list.items);
      setSources(kb.sources);
      setTotalChunks(kb.totalChunks);
      setLeads(ld.items);
      setLeadTotal(ld.total);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the assistant.");
    } finally {
      setLoading(false);
    }
  }, [token, profile?.role, handoffOnly, search, uncontactedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const openConversation = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setOpenMessages([]);
    try {
      const d = await apiFetch<{ messages: MessageRow[] }>(`/admin/chat/conversations/${id}`, { token });
      setOpenMessages(d.messages);
    } catch {
      toast.error("Could not open that conversation.");
    }
  };

  const ingest = async () => {
    if (!name.trim() || !text.trim()) {
      toast.error("Give the batch a name and paste the content.");
      return;
    }
    setIngesting(true);
    try {
      const out = await apiFetch<{ chunkCount: number }>("/admin/chat/knowledge", {
        method: "POST",
        token,
        body: { name: name.trim(), format, kind: format, text }
      });
      toast.success(`Added ${out.chunkCount} passages.`);
      setName("");
      setText("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add that.");
    } finally {
      setIngesting(false);
    }
  };

  const toggleSource = async (s: KnowledgeSource) => {
    try {
      await apiFetch(`/admin/chat/knowledge/${s.id}`, { method: "PATCH", token, body: { isActive: !s.isActive } });
      await load();
    } catch {
      toast.error("Could not change that source.");
    }
  };

  const removeSource = async (s: KnowledgeSource) => {
    if (!window.confirm(`Delete "${s.name}" and its ${s.chunkCount} passages? This cannot be undone.`)) return;
    try {
      await apiFetch(`/admin/chat/knowledge/${s.id}`, { method: "DELETE", token });
      toast.success("Deleted.");
      await load();
    } catch {
      toast.error("Could not delete that source.");
    }
  };

  const toggleContacted = async (l: Lead) => {
    try {
      await apiFetch(`/admin/chat/leads/${l.id}`, {
        method: "PATCH",
        token,
        body: { contacted: !l.contactedAt }
      });
      await load();
    } catch {
      toast.error("Could not update that lead.");
    }
  };

  const copyLeads = () => {
    const rows = [
      ["WhatsApp", "Name", "Profession", "Exam", "Channel", "Captured", "Contacted"].join("\t"),
      ...leads.map((l) =>
        [
          l.whatsapp,
          l.name ?? "",
          l.profession ?? "",
          l.examDate ?? "",
          l.channel ?? "",
          new Date(l.createdAt).toISOString().slice(0, 10),
          l.contactedAt ? "yes" : "no"
        ].join("\t")
      )
    ].join("\n");
    void navigator.clipboard.writeText(rows).then(
      () => toast.success("Copied. Paste straight into a spreadsheet."),
      () => toast.error("Could not copy.")
    );
  };

  const runProbe = async () => {
    if (!probe.trim()) return;
    try {
      const out = await apiFetch<{ results: SearchHit[] }>(
        `/admin/chat/knowledge/search?q=${encodeURIComponent(probe.trim())}`,
        { token }
      );
      setHits(out.results);
    } catch {
      toast.error("Search failed.");
    }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading the assistant…" layout="analytics" />;
  }
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account to manage the assistant."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <AdminShell
      title="Assistant"
      description="The chat assistant on the website — what it knows, what it has been asked, and what it costs."
      profile={profile}
      onRefresh={() => void load()}
      onLogout={() => logout()}
      stats={[
        { label: "Conversations (30d)", value: stats?.conversations.toLocaleString() ?? "—" },
        { label: "Needed a human", value: stats?.handoffs.toLocaleString() ?? "—" },
        { label: "Leads captured", value: leadTotal.toLocaleString() },
        { label: "Passages known", value: totalChunks.toLocaleString() },
        { label: "Spend (30d)", value: stats ? `$${stats.estimatedCostUsd.toFixed(2)}` : "—" }
      ]}
    >
      <div className="space-y-6">
        {loadError ? <WorkspaceErrorAlert description={loadError} /> : null}

        {enabled === false ? (
          <Alert variant="destructive">
            <AlertTitle>The assistant is switched off</AlertTitle>
            <AlertDescription>
              No <code>ANTHROPIC_API_KEY</code> is set on the API server, so the chat button does not
              appear on the website. Set it and restart the API to turn the assistant on.
            </AlertDescription>
          </Alert>
        ) : null}

        {enabled && totalChunks === 0 ? (
          <Alert>
            <AlertTitle>The assistant has nothing to answer from</AlertTitle>
            <AlertDescription>
              It is switched on but its knowledge base is empty, so it will say it does not know and pass
              people to a human. Add your exported chats and FAQ below.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* -------------------------------------------------------------- leads */}
        <Card>
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <CardDescription>
              Visitors who gave the assistant their WhatsApp number. It asks once when the chat opens
              and once more after it has given real advice, and never a third time. Each one carries the
              channel that brought them, so you can see which traffic actually produces people worth
              calling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={uncontactedOnly ? "default" : "outline"}
                onClick={() => setUncontactedOnly((v) => !v)}
              >
                Not yet contacted
              </Button>
              <Button size="sm" variant="outline" onClick={copyLeads} disabled={leads.length === 0}>
                Copy for spreadsheet
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">{leadTotal.toLocaleString()} total</span>
            </div>

            {leads.length === 0 ? (
              <EmptyState
                title="No leads yet"
                description="Numbers appear here as soon as visitors start sharing them with the assistant."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Came from</TableHead>
                      <TableHead>Captured</TableHead>
                      <TableHead className="text-right">Follow-up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((l) => (
                      <TableRow key={l.id} className={l.contactedAt ? "opacity-60" : undefined}>
                        <TableCell className="font-mono text-sm font-medium">{l.whatsapp}</TableCell>
                        <TableCell>
                          <p className="text-sm">{l.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{l.profession ?? ""}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.examDate ?? "—"}</TableCell>
                        <TableCell>
                          {l.channel ? (
                            <Badge variant="secondary">{l.channel.replace(/_/g, " ").toLowerCase()}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{when(l.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {l.conversation ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void openConversation(l.conversation!.id)}
                              >
                                Read chat
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant={l.contactedAt ? "outline" : "default"}
                              onClick={() => void toggleContacted(l)}
                            >
                              {l.contactedAt ? "Contacted" : "Mark contacted"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------- knowledge */}
        <Card>
          <CardHeader>
            <CardTitle>What it knows</CardTitle>
            <CardDescription>
              Paste your exported conversations, transcripts or FAQ here. The text is split into passages
              and searched on every question — only the handful that match are sent to the model, which is
              what keeps it accurate and keeps the cost flat no matter how much you add.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this batch, e.g. “WhatsApp enquiries Jan–Jun 2026”"
              />
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <Button
                    key={f.id}
                    size="sm"
                    variant={format === f.id ? "default" : "outline"}
                    onClick={() => setFormat(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{FORMATS.find((f) => f.id === format)?.hint}</p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste the content here…"
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-3">
              <Button onClick={() => void ingest()} disabled={ingesting}>
                {ingesting ? "Adding…" : "Add to the knowledge base"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {text.trim() ? `${text.trim().length.toLocaleString()} characters` : "Nothing pasted yet"}
              </span>
            </div>

            {sources.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Passages</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.kind}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.chunkCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{when(s.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => void toggleSource(s)}>
                            {s.isActive ? "Switch off" : "Switch on"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void removeSource(s)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>

        {/* -------------------------------------------------------------- probe */}
        <Card>
          <CardHeader>
            <CardTitle>Try a question</CardTitle>
            <CardDescription>
              See exactly which passages a question would pull up, without spending a model call. If the
              right passage is not in this list, the assistant cannot answer it — that means adding
              material, not changing the wording.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={probe}
                onChange={(e) => setProbe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runProbe();
                }}
                placeholder="e.g. can I pay in instalments?"
              />
              <Button onClick={() => void runProbe()}>Search</Button>
            </div>
            {hits === null ? null : hits.length === 0 ? (
              <EmptyState
                title="Nothing matched"
                description="The assistant would say it does not know and offer a human. Add material covering this."
              />
            ) : (
              <div className="space-y-2">
                {hits.map((h, i) => (
                  <div key={h.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="secondary">#{i + 1}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {h.sourceName}
                        {h.heading ? ` · ${h.heading}` : ""}
                      </span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        score {h.rank.toFixed(2)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">{h.content.slice(0, 400)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------ conversations */}
        <Card>
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <CardDescription>
              Every thread, with the traffic channel the person came from. The ones marked{" "}
              <strong>needs a human</strong> are the questions your knowledge base could not answer — they
              are the list of what to add next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search what people asked"
                className="max-w-sm"
              />
              <Button size="sm" variant={handoffOnly ? "default" : "outline"} onClick={() => setHandoffOnly((v) => !v)}>
                Only ones needing a human
              </Button>
            </div>

            {loading && conversations.length === 0 ? (
              <WorkspaceLoadingState title="Loading conversations…" layout="table" />
            ) : conversations.length === 0 ? (
              <EmptyState title="No conversations yet" description="They appear here as soon as people start asking." />
            ) : (
              <div className="space-y-2">
                {conversations.map((cv) => (
                  <div key={cv.id} className="rounded-lg border">
                    <button
                      type="button"
                      onClick={() => void openConversation(cv.id)}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{cv.title ?? "(no question recorded)"}</p>
                        <p className="text-xs text-muted-foreground">
                          {cv.user ? cv.user.email : "Visitor"} · {cv.messageCount} messages · {when(cv.lastMessageAt)}
                        </p>
                      </div>
                      {cv.channel ? (
                        <Badge variant="secondary">{cv.channel.replace(/_/g, " ").toLowerCase()}</Badge>
                      ) : null}
                      {cv.handoffAt ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                          needs a human
                        </Badge>
                      ) : null}
                    </button>
                    {openId === cv.id ? (
                      <div className="space-y-2 border-t bg-muted/40 p-3">
                        {openMessages.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Loading…</p>
                        ) : (
                          openMessages.map((m) => (
                            <div
                              key={m.id}
                              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                m.role === "USER"
                                  ? "ml-auto bg-primary text-primary-foreground"
                                  : m.errorCode
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-background"
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{m.content}</p>
                              {m.errorCode ? (
                                <p className="mt-1 text-[10px] uppercase tracking-wide">failed: {m.errorCode}</p>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* --------------------------------------------------------------- cost */}
        {stats ? (
          <Card>
            <CardHeader>
              <CardTitle>Cost and speed</CardTitle>
              <CardDescription>Last {stats.days} days.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Messages", value: stats.messages.toLocaleString() },
                  { label: "Input tokens", value: stats.inputTokens.toLocaleString() },
                  { label: "Output tokens", value: stats.outputTokens.toLocaleString() },
                  { label: "Average reply time", value: `${(stats.avgLatencyMs / 1000).toFixed(1)}s` }
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {stats.cacheReadTokens > 0 ? (
                  <>
                    {Math.round((stats.cacheReadTokens / Math.max(stats.inputTokens, 1)) * 100)}% of input was served
                    from the prompt cache at a tenth of the price — the instructions and price list are
                    identical on every message, so they are only charged in full once every few minutes.
                  </>
                ) : (
                  "Cost is estimated from token counts at list price; your invoice is the authority."
                )}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
