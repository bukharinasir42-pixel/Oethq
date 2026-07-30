"use client";

/**
 * /admin/reading-articles — the premium reading-article bank. Bulk-paste many
 * articles at once (structured format), then manage the library: preview,
 * publish/unpublish, edit, delete. Published articles feed the global "article
 * of the day" on the Reading Part B/C portal surface.
 */
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { readingArticlesApi, parseArticleBulk, parseArticleJson, type AdminArticle, type AdminArticleFull } from "@/lib/reading-articles-api";
import "@/components/portal/reading-article.css";

const BULK_TEMPLATE = `TITLE: The Limits of Sunscreen
KICKER: Reading · Part C · Text 11
STANDFIRST: "Wear sunscreen" may be the most repeated advice in skin health — and among the most misunderstood.

01 Few pieces of health advice are repeated as confidently as the instruction to wear sunscreen…

02 Consider the most common misunderstanding. Many people treat sunscreen as though it rendered the sun harmless…

ATTRIBUTION: OET HQ · Reading Part C. Examiner-style practice passage.

---

TITLE: Second Article Title
KICKER: Reading · Part C · Text 12
STANDFIRST: A one-line intro…

01 First paragraph…

02 Second paragraph…`;

const JSON_TEMPLATE = `[
  {
    "kicker": "Reading · Part C · Text 11",
    "title": "The Limits of Sunscreen",
    "standfirst": "\\"Wear sunscreen\\" may be the most repeated advice in skin health — and among the most misunderstood.",
    "paragraphs": [
      "Few pieces of health advice are repeated as confidently as the instruction to wear sunscreen…",
      "Consider the most common misunderstanding. Many people treat sunscreen as though it rendered the sun harmless…"
    ],
    "attribution": "OET HQ · Reading Part C. Examiner-style practice passage."
  },
  {
    "kicker": "Reading · Part C · Text 12",
    "title": "Second Article Title",
    "standfirst": "A one-line intro…",
    "paragraphs": ["First paragraph…", "Second paragraph…"]
  }
]`;

const pad2 = (n: number) => String(n).padStart(2, "0");
const toParas = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export default function AdminReadingArticlesPage() {
  const { profile, status, error, logout, refresh } = useSession();
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [counts, setCounts] = useState<{ total: number; active: number }>({ total: 0, active: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"text" | "json">("text");
  const [bulk, setBulk] = useState("");
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<AdminArticleFull | null>(null);
  const [editing, setEditing] = useState<AdminArticleFull | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [list, c] = await Promise.all([readingArticlesApi.adminList(), readingArticlesApi.adminCounts()]);
      setArticles(list.articles);
      setCounts(c);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load articles");
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "ADMIN") void load();
  }, [profile, load]);

  const active =
    mode === "text"
      ? { parsed: bulk.trim() ? parseArticleBulk(bulk) : [], errors: [] as string[] }
      : (() => { const r = parseArticleJson(json); return { parsed: r.articles, errors: r.errors }; })();
  const parsedCount = active.parsed.length;

  const addBulk = async () => {
    const parsed = active.parsed;
    if (parsed.length === 0) {
      toast.error("No complete articles found", {
        description:
          mode === "text"
            ? "Each article needs a TITLE and at least one body paragraph, separated by a line of ---."
            : 'Provide a JSON array where each article has a "title" and "paragraphs" (or "bodyText").'
      });
      return;
    }
    setBusy(true);
    try {
      const res = await readingArticlesApi.adminCreate(parsed);
      toast.success(`Added ${res.created} article${res.created === 1 ? "" : "s"} as drafts`);
      setBulk("");
      setJson("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add articles");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (a: AdminArticle) => {
    try {
      await readingArticlesApi.adminUpdate(a.id, { isActive: !a.isActive });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (a: AdminArticle) => {
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    try {
      await readingArticlesApi.adminDelete(a.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const openPreview = async (id: string) => {
    try { setPreview(await readingArticlesApi.adminGet(id)); } catch { toast.error("Could not load article"); }
  };
  const openEdit = async (id: string) => {
    try { setEditing(await readingArticlesApi.adminGet(id)); } catch { toast.error("Could not load article"); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await readingArticlesApi.adminUpdate(editing.id, {
        kicker: editing.kicker, title: editing.title, standfirst: editing.standfirst,
        bodyText: editing.bodyText, attribution: editing.attribution
      });
      toast.success("Article saved");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingEdit(false);
    }
  };

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading…" layout="table" />;
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState title="Admin access required" description={error || "Sign in with an admin account."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />
    );
  }

  return (
    <AdminShell title="Reading Articles" description="The premium daily-reading bank for Reading Part B & C." profile={profile} onRefresh={refresh} onLogout={logout}>
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {loadError ? <Card><CardContent className="py-6 text-sm text-destructive">{loadError}</CardContent></Card> : null}

        {/* bulk add */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> Add articles (bulk)</CardTitle>
              <div className="inline-flex rounded-lg border border-border/70 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition ${mode === "text" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setMode("json")}
                  className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition ${mode === "json" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  JSON
                </button>
              </div>
            </div>
            <CardDescription>
              {mode === "text" ? (
                <>Separate each article with a line of <code>---</code>. Per article: <code>TITLE:</code> (required), optional <code>KICKER:</code>, <code>STANDFIRST:</code>, <code>ATTRIBUTION:</code>, then a blank line and the body paragraphs (blank line between paragraphs; any leading 01/02 numbers are stripped). New articles are added as <b>drafts</b> — publish them below.</>
              ) : (
                <>Paste a JSON array of articles (or <code>{'{ "articles": [ … ] }'}</code>). Each article: <code>title</code> (required), <code>paragraphs</code> (array of strings) <i>or</i> <code>bodyText</code>, plus optional <code>kicker</code>, <code>standfirst</code>, <code>attribution</code>. Plain text only — no HTML. New articles are added as <b>drafts</b>.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "text" ? (
              <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={12} placeholder={BULK_TEMPLATE} className="font-mono text-xs" />
            ) : (
              <Textarea value={json} onChange={(e) => setJson(e.target.value)} rows={14} placeholder={JSON_TEMPLATE} className="font-mono text-xs" />
            )}
            {active.errors.length > 0 ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {active.errors.slice(0, 6).map((er, i) => (<div key={i}>• {er}</div>))}
                {active.errors.length > 6 ? <div>…and {active.errors.length - 6} more</div> : null}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{parsedCount > 0 ? `${parsedCount} article${parsedCount === 1 ? "" : "s"} detected` : "Paste one or more articles"}</span>
              <Button type="button" onClick={() => void addBulk()} disabled={busy || parsedCount === 0} className="cursor-pointer">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add {parsedCount || ""} to library
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* library */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Library</CardTitle>
              <Badge variant="outline">{counts.active} published · {counts.total} total</Badge>
            </div>
            <CardDescription>Published articles rotate daily — one shown to every student per day.</CardDescription>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">No articles yet. Paste some above.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {articles.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.kicker ? `${a.kicker} · ` : ""}{a.words} words · {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                    </div>
                    <Badge variant={a.isActive ? "default" : "outline"} className="shrink-0">{a.isActive ? "Published" : "Draft"}</Badge>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Preview" onClick={() => void openPreview(a.id)}><Eye className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Edit" onClick={() => void openEdit(a.id)}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 cursor-pointer" onClick={() => void toggleActive(a)}>{a.isActive ? "Unpublish" : "Publish"}</Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" title="Delete" onClick={() => void remove(a)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* preview modal */}
      <Dialog open={!!preview} onOpenChange={(v) => { if (!v) setPreview(null); }}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Student preview</DialogTitle><DialogDescription>Exactly how students see this article.</DialogDescription></DialogHeader>
          {preview ? (
            <div className="oethq-portal">
              <article className="article-reader">
                {preview.kicker ? <div className="ar-kicker">{preview.kicker}</div> : null}
                <h1 className="ar-title">{preview.title}</h1>
                {preview.standfirst ? <p className="ar-standfirst">{preview.standfirst}</p> : null}
                <div className="ar-body">
                  {toParas(preview.bodyText).map((p, i) => (<p key={i} className="ar-para"><span className="ar-num">{pad2(i + 1)}</span>{p}</p>))}
                </div>
                {preview.attribution ? <p className="ar-attrib">{preview.attribution}</p> : null}
              </article>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* edit modal */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Edit article</DialogTitle></DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Kicker</Label><Input value={editing.kicker ?? ""} onChange={(e) => setEditing({ ...editing, kicker: e.target.value })} placeholder="Reading · Part C · Text 11" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Standfirst</Label><Textarea value={editing.standfirst ?? ""} onChange={(e) => setEditing({ ...editing, standfirst: e.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Body (paragraphs separated by a blank line)</Label><Textarea value={editing.bodyText} onChange={(e) => setEditing({ ...editing, bodyText: e.target.value })} rows={12} className="font-mono text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Attribution</Label><Textarea value={editing.attribution ?? ""} onChange={(e) => setEditing({ ...editing, attribution: e.target.value })} rows={2} /></div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} className="cursor-pointer">Cancel</Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={savingEdit} className="cursor-pointer">{savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
