"use client";

/**
 * /admin/listening-podcasts — the daily listening-podcast library. Bulk-upload
 * audio files (one podcast per file) and/or add one by URL, then manage the
 * library: preview, publish/unpublish, edit, delete. Published podcasts feed the
 * global "podcast of the day" on the Listening Part C portal surface.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Link2, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { listeningPodcastsApi, readAudioDuration, fmtDuration, type AdminPodcast, type AdminPodcastFull } from "@/lib/listening-podcasts-api";

const titleFromFilename = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || "Untitled podcast";

export default function AdminListeningPodcastsPage() {
  const { profile, status, error, logout, refresh } = useSession();
  const [podcasts, setPodcasts] = useState<AdminPodcast[]>([]);
  const [counts, setCounts] = useState<{ total: number; active: number }>({ total: 0, active: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [urlTitle, setUrlTitle] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [preview, setPreview] = useState<AdminPodcastFull | null>(null);
  const [editing, setEditing] = useState<AdminPodcastFull | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [list, c] = await Promise.all([listeningPodcastsApi.adminList(), listeningPodcastsApi.adminCounts()]);
      setPodcasts(list.podcasts);
      setCounts(c);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load podcasts");
    }
  }, []);

  useEffect(() => { if (profile?.role === "ADMIN") void load(); }, [profile, load]);

  const uploadFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name));
    if (list.length === 0) { toast.error("Pick audio files (mp3, m4a, wav…)"); return; }
    setUploading({ done: 0, total: list.length });
    const created: { title: string; audioAssetId: string; durationSec: number | null }[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const durationSec = await readAudioDuration(f);
        const asset = await listeningPodcastsApi.uploadAudio(f);
        created.push({ title: titleFromFilename(f.name), audioAssetId: asset.id, durationSec });
        setUploading({ done: i + 1, total: list.length });
      }
      const res = await listeningPodcastsApi.adminCreate(created);
      toast.success(`Uploaded ${res.created} podcast${res.created === 1 ? "" : "s"} as drafts`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addByUrl = async () => {
    if (!urlTitle.trim() || !urlValue.trim()) { toast.error("Enter a title and a URL"); return; }
    setAddingUrl(true);
    try {
      const res = await listeningPodcastsApi.adminCreate([{ title: urlTitle.trim(), audioUrl: urlValue.trim() }]);
      toast.success(res.created ? "Podcast added as a draft" : "Nothing added");
      setUrlTitle(""); setUrlValue("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    } finally {
      setAddingUrl(false);
    }
  };

  const toggleActive = async (p: AdminPodcast) => {
    try { await listeningPodcastsApi.adminUpdate(p.id, { isActive: !p.isActive }); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };
  const remove = async (p: AdminPodcast) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try { await listeningPodcastsApi.adminDelete(p.id); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  };
  const openPreview = async (id: string) => { try { setPreview(await listeningPodcastsApi.adminGet(id)); } catch { toast.error("Could not load"); } };
  const openEdit = async (id: string) => { try { setEditing(await listeningPodcastsApi.adminGet(id)); } catch { toast.error("Could not load"); } };

  const replaceAudio = async (file: File | null) => {
    if (!file || !editing) return;
    setSavingEdit(true);
    try {
      const durationSec = await readAudioDuration(file);
      const asset = await listeningPodcastsApi.uploadAudio(file);
      const full = await listeningPodcastsApi.adminUpdate(editing.id, { audioAssetId: asset.id, durationSec });
      setEditing(full);
      toast.success("Audio replaced");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Replace failed"); }
    finally { setSavingEdit(false); if (editFileRef.current) editFileRef.current.value = ""; }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await listeningPodcastsApi.adminUpdate(editing.id, { kicker: editing.kicker, title: editing.title, description: editing.description });
      toast.success("Podcast saved");
      setEditing(null);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSavingEdit(false); }
  };

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading…" layout="table" />;
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return <WorkspaceAccessDeniedState title="Admin access required" description={error || "Sign in with an admin account."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />;
  }

  return (
    <AdminShell title="Listening Podcasts" description="The daily podcast library for the Listening Part C surface." profile={profile} onRefresh={refresh} onLogout={logout}>
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {loadError ? <Card><CardContent className="py-6 text-sm text-destructive">{loadError}</CardContent></Card> : null}

        {/* upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" /> Upload audio files</CardTitle>
            <CardDescription>Pick many at once — each file becomes a draft podcast (titled from its filename, duration read automatically). Publish them below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" multiple hidden onChange={(e) => void uploadFiles(e.target.files)} />
            <Button type="button" variant="outline" className="w-full cursor-pointer" onClick={() => fileRef.current?.click()} disabled={!!uploading}>
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading {uploading.done}/{uploading.total}…</> : <><Upload className="mr-2 h-4 w-4" /> Choose audio files</>}
            </Button>
            <div className="flex items-end gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="flex-1 space-y-1"><Label className="text-xs flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Or add one by URL</Label>
                <div className="flex gap-2">
                  <Input value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} placeholder="Podcast title" className="w-44" />
                  <Input value={urlValue} onChange={(e) => setUrlValue(e.target.value)} placeholder="https://…/podcast.mp3" />
                </div>
              </div>
              <Button type="button" onClick={() => void addByUrl()} disabled={addingUrl || !urlTitle.trim() || !urlValue.trim()} className="cursor-pointer">
                {addingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* library */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Headphones className="h-4 w-4" /> Library</CardTitle>
              <Badge variant="outline">{counts.active} published · {counts.total} total</Badge>
            </div>
            <CardDescription>Published podcasts rotate daily — one shown to every student per day.</CardDescription>
          </CardHeader>
          <CardContent>
            {podcasts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">No podcasts yet. Upload some above.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {podcasts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.kicker ? `${p.kicker} · ` : ""}{p.durationSec ? `${fmtDuration(p.durationSec)} · ` : ""}{p.audioKind === "asset" ? "uploaded" : p.audioKind === "url" ? "URL" : "no audio"}
                      </p>
                    </div>
                    <Badge variant={p.isActive ? "default" : "outline"} className="shrink-0">{p.isActive ? "Published" : "Draft"}</Badge>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Preview" onClick={() => void openPreview(p.id)}><Headphones className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Edit" onClick={() => void openEdit(p.id)}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 cursor-pointer" onClick={() => void toggleActive(p)}>{p.isActive ? "Unpublish" : "Publish"}</Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" title="Delete" onClick={() => void remove(p)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* preview */}
      <Dialog open={!!preview} onOpenChange={(v) => { if (!v) setPreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          {preview ? (
            <div className="space-y-3">
              {preview.kicker ? <p className="text-xs font-semibold uppercase tracking-wide text-primary">{preview.kicker}</p> : null}
              {preview.description ? <p className="text-sm text-muted-foreground">{preview.description}</p> : null}
              {preview.resolvedAudioUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio src={preview.resolvedAudioUrl} controls className="w-full" />
              ) : <p className="text-sm text-destructive">No audio attached.</p>}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* edit */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit podcast</DialogTitle></DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Kicker</Label><Input value={editing.kicker ?? ""} onChange={(e) => setEditing({ ...editing, kicker: e.target.value })} placeholder="Listening · Part C · Podcast 3" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} /></div>
              <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-3">
                <Label className="text-xs">Audio {editing.durationSec ? `· ${fmtDuration(editing.durationSec)}` : ""}</Label>
                {editing.resolvedAudioUrl ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio src={editing.resolvedAudioUrl} controls className="w-full" />
                ) : <p className="text-xs text-muted-foreground">No audio.</p>}
                <input ref={editFileRef} type="file" accept="audio/*" hidden onChange={(e) => void replaceAudio(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => editFileRef.current?.click()} disabled={savingEdit}><Upload className="mr-1.5 h-3.5 w-3.5" /> Replace audio file</Button>
              </div>
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
