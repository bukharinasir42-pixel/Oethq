"use client";

/**
 * /admin/cheat-sheets — manage premium PortalResources: the Reading & Listening
 * cheat-sheet PDFs and "how to use" lecture videos, plus the single "must watch"
 * intro video above the Part C articles reader. PDFs and videos are added by URL
 * (paste the S3/Bunny link); videos may instead use a Bunny video ID.
 */
import { useCallback, useEffect, useState } from "react";
import { FileStack, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  portalResourcesApi,
  type AdminPortalResource,
  type PortalResourceInput,
  type PortalResourceKind,
  type PortalResourcePlacement
} from "@/lib/portal-resources-api";

const PLACEMENTS: { value: PortalResourcePlacement; label: string; hint: string }[] = [
  { value: "READING_CHEATSHEET", label: "Reading cheat sheet", hint: "Shows on the Reading Cheat Sheets page" },
  { value: "LISTENING_CHEATSHEET", label: "Listening cheat sheet", hint: "Shows on the Listening Cheat Sheets page" },
  { value: "READING_ARTICLE_INTRO", label: "Article intro video (Part C)", hint: "Shows above the Reading Part C articles reader" },
  { value: "ONBOARDING_INTRO", label: "Onboarding intro (mandatory)", hint: "The 'how to use the course' video every student must watch before the portal opens" }
];
const placementLabel = (p: PortalResourcePlacement) => PLACEMENTS.find((x) => x.value === p)?.label ?? p;

const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

type FormState = {
  placement: PortalResourcePlacement;
  kind: PortalResourceKind;
  title: string;
  description: string;
  displayOrder: string;
  pdfUrl: string;
  bunnyVideoId: string;
  videoUrl: string;
  isPublished: boolean;
};
const emptyForm: FormState = {
  placement: "READING_CHEATSHEET", kind: "PDF", title: "", description: "",
  displayOrder: "0", pdfUrl: "", bunnyVideoId: "", videoUrl: "", isPublished: true
};

function toInput(f: FormState): PortalResourceInput {
  return {
    placement: f.placement,
    kind: f.kind,
    title: f.title.trim(),
    description: f.description.trim() || null,
    displayOrder: Number(f.displayOrder) || 0,
    pdfUrl: f.kind === "PDF" ? f.pdfUrl.trim() || null : null,
    bunnyVideoId: f.kind === "VIDEO" ? f.bunnyVideoId.trim() || null : null,
    videoUrl: f.kind === "VIDEO" ? f.videoUrl.trim() || null : null,
    isPublished: f.isPublished
  };
}

export default function AdminCheatSheetsPage() {
  const { profile, status, error, logout, refresh } = useSession();
  const [rows, setRows] = useState<AdminPortalResource[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminPortalResource | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await portalResourcesApi.adminList();
      setRows(r.resources);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { if (profile?.role === "ADMIN") void load(); }, [profile, load]);

  const add = async () => {
    if (!form.title.trim()) { toast.error("Enter a title"); return; }
    if (form.kind === "PDF" && !form.pdfUrl.trim()) { toast.error("Paste the PDF URL"); return; }
    if (form.kind === "VIDEO" && !form.bunnyVideoId.trim() && !form.videoUrl.trim()) { toast.error("Enter a Bunny video ID or a video URL"); return; }
    setAdding(true);
    try {
      await portalResourcesApi.adminCreate(toInput(form));
      toast.success("Added");
      setForm({ ...emptyForm, placement: form.placement, kind: form.kind });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (r: AdminPortalResource) => {
    try { await portalResourcesApi.adminUpdate(r.id, { isPublished: !r.isPublished }); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };
  const remove = async (r: AdminPortalResource) => {
    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    try { await portalResourcesApi.adminDelete(r.id); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await portalResourcesApi.adminUpdate(editing.id, {
        placement: editing.placement,
        kind: editing.kind,
        title: editing.title.trim(),
        description: editing.description?.trim() || null,
        displayOrder: editing.displayOrder,
        pdfUrl: editing.kind === "PDF" ? editing.pdfUrl?.trim() || null : null,
        bunnyVideoId: editing.kind === "VIDEO" ? editing.bunnyVideoId?.trim() || null : null,
        videoUrl: editing.kind === "VIDEO" ? editing.videoUrl?.trim() || null : null,
        isPublished: editing.isPublished
      });
      toast.success("Saved");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading…" layout="table" />;
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return <WorkspaceAccessDeniedState title="Admin access required" description={error || "Sign in with an admin account."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />;
  }

  const grouped = PLACEMENTS.map((p) => ({ ...p, items: rows.filter((r) => r.placement === p.value) }));

  return (
    <AdminShell title="Cheat Sheets" description="Cheat-sheet PDFs, how-to lessons and the Part C articles intro video." profile={profile} onRefresh={refresh} onLogout={logout}>
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {loadError ? <Card><CardContent className="py-6 text-sm text-destructive">{loadError}</CardContent></Card> : null}

        {/* add */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> Add a resource</CardTitle>
            <CardDescription>Paste the PDF link (from S3) or a video (Bunny video ID or any embed URL). Publish it to show it in the portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Where it shows</Label>
                <select className={selectClass} value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value as PortalResourcePlacement, kind: (e.target.value === "READING_ARTICLE_INTRO" || e.target.value === "ONBOARDING_INTRO") ? "VIDEO" : form.kind })}>
                  {PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground">{PLACEMENTS.find((p) => p.value === form.placement)?.hint}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <select className={selectClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PortalResourceKind })} disabled={form.placement === "READING_ARTICLE_INTRO" || form.placement === "ONBOARDING_INTRO"}>
                  <option value="PDF">PDF (cheat sheet)</option>
                  <option value="VIDEO">Video (lesson)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.kind === "PDF" ? "e.g. OET Reading Part C — Cheat Sheet" : "e.g. Must watch before Part C articles"} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Description (optional)</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            {form.kind === "PDF" ? (
              <div className="space-y-1.5"><Label className="text-xs">PDF URL</Label><Input value={form.pdfUrl} onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })} placeholder="https://…/cheat-sheet.pdf" /></div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-xs">Bunny video ID</Label><Input value={form.bunnyVideoId} onChange={(e) => setForm({ ...form, bunnyVideoId: e.target.value })} placeholder="e.g. 1a2b3c-…" /></div>
                <div className="space-y-1.5"><Label className="text-xs">…or video URL</Label><Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://…/embed" /></div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <input id="cs-order" type="number" className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
                  <Label htmlFor="cs-order" className="text-xs text-muted-foreground">order</Label>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> Published
                </label>
              </div>
              <Button type="button" onClick={() => void add()} disabled={adding} className="cursor-pointer">
                {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* library grouped by placement */}
        {grouped.map((g) => (
          <Card key={g.value}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><FileStack className="h-4 w-4" /> {g.label}</CardTitle>
                <Badge variant="outline">{g.items.filter((i) => i.isPublished).length} published · {g.items.length} total</Badge>
              </div>
              <CardDescription>{g.hint}</CardDescription>
            </CardHeader>
            <CardContent>
              {g.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-center text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {g.items.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                      <Badge variant="secondary" className="shrink-0">{r.kind}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.kind === "PDF" ? r.pdfUrl : (r.bunnyVideoId ? `Bunny: ${r.bunnyVideoId}` : r.videoUrl) || "—"}</p>
                      </div>
                      <Badge variant={r.isPublished ? "default" : "outline"} className="shrink-0">{r.isPublished ? "Published" : "Draft"}</Badge>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Edit" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" variant="outline" size="sm" className="shrink-0 cursor-pointer" onClick={() => void toggle(r)}>{r.isPublished ? "Unpublish" : "Publish"}</Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" title="Delete" onClick={() => void remove(r)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* edit */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit resource</DialogTitle></DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Where it shows</Label>
                  <select className={selectClass} value={editing.placement} onChange={(e) => setEditing({ ...editing, placement: e.target.value as PortalResourcePlacement })}>
                    {PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <select className={selectClass} value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as PortalResourceKind })}>
                    <option value="PDF">PDF</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              {editing.kind === "PDF" ? (
                <div className="space-y-1.5"><Label className="text-xs">PDF URL</Label><Input value={editing.pdfUrl ?? ""} onChange={(e) => setEditing({ ...editing, pdfUrl: e.target.value })} /></div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-xs">Bunny video ID</Label><Input value={editing.bunnyVideoId ?? ""} onChange={(e) => setEditing({ ...editing, bunnyVideoId: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Video URL</Label><Input value={editing.videoUrl ?? ""} onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })} /></div>
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <input type="number" className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm" value={editing.displayOrder} onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) || 0 })} />
                  <Label className="text-xs text-muted-foreground">order</Label>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={editing.isPublished} onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })} /> Published
                </label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} className="cursor-pointer">Cancel</Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={saving} className="cursor-pointer">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
