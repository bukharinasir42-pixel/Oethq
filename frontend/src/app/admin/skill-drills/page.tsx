"use client";

/**
 * /admin/skill-drills — the core-skill drill library. Bulk drag-and-drop .html
 * drills into a module; the portal shows one global "drill of the day" per
 * module, rotating every 24h. Toggle / delete / preview individual drills.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Dumbbell, Eye, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/hooks/use-session";
import { skillDrillsApi, type AdminDrill } from "@/lib/skill-drills-api";

const MODULES = [
  { key: "part-a-core", label: "Reading Part A" },
  { key: "part-bc-core", label: "Reading Part B & C" },
  { key: "spellings", label: "Listening Spellings" },
  { key: "part-c-podcasts", label: "Part C Podcasts" }
] as const;

function extractTitle(html: string, fallback: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let t = m ? m[1].replace(/\s+/g, " ").trim() : "";
  if (t && typeof document !== "undefined") {
    const el = document.createElement("textarea");
    el.innerHTML = t;
    t = el.value; // decode HTML entities (&amp; → &)
  }
  return t || fallback;
}

export default function AdminSkillDrillsPage() {
  const { profile, status, error, logout, refresh } = useSession();
  const [module, setModule] = useState<string>("part-a-core");
  const [drills, setDrills] = useState<AdminDrill[]>([]);
  const [counts, setCounts] = useState<Record<string, { total: number; active: number }>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (mod: string) => {
    setLoading(true);
    try {
      const [list, cnt] = await Promise.all([skillDrillsApi.adminList(mod), skillDrillsApi.adminCounts()]);
      setDrills(list.drills);
      setCounts(cnt);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load drills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "ADMIN") void load(module);
  }, [load, module, profile]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => /\.html?$/i.test(f.name) || f.type === "text/html");
    if (files.length === 0) {
      toast.error("Drop .html drill files only.");
      return;
    }
    setUploading(true);
    try {
      const parsed = await Promise.all(
        files.map(async (f) => {
          const html = await f.text();
          return { title: extractTitle(html, f.name.replace(/\.html?$/i, "")), html };
        })
      );
      const res = await skillDrillsApi.adminCreate(module, parsed);
      toast.success(`${res.created} drill${res.created === 1 ? "" : "s"} uploaded`);
      await load(module);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (d: AdminDrill) => {
    setBusyId(d.id);
    try {
      await skillDrillsApi.adminUpdate(d.id, { isActive: !d.isActive });
      await load(module);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (d: AdminDrill) => {
    if (!window.confirm(`Delete "${d.title}"? This cannot be undone.`)) return;
    setBusyId(d.id);
    try {
      await skillDrillsApi.adminDelete(d.id);
      toast.success("Drill deleted");
      await load(module);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  };

  const preview = async (d: AdminDrill) => {
    try {
      const full = await skillDrillsApi.adminGet(d.id);
      const w = window.open("", "_blank");
      if (w) { w.document.open(); w.document.write(full.html); w.document.close(); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to preview");
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
    <AdminShell title="Skill Drills" description="Upload the interactive drill library. One global drill of the day per module, rotating every 24 hours." profile={profile} onRefresh={() => load(module)} onLogout={logout}>
      {/* Module tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {MODULES.map((m) => {
          const c = counts[m.key];
          const active = module === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setModule(m.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}
            >
              {m.label}
              {c ? <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${active ? "bg-primary/15" : "bg-muted"}`}>{c.active}/{c.total}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Upload zone */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><UploadCloud className="h-5 w-5 text-primary" /> Upload drills</CardTitle>
          <CardDescription>Drag &amp; drop the self-contained <code>.html</code> drill files here (or click to choose). Each file&apos;s <code>&lt;title&gt;</code> becomes its name. Upload 60–100 to build the library.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); void uploadFiles(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/40"}`}
          >
            {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-muted-foreground" />}
            <p className="text-sm font-semibold text-foreground">{uploading ? "Uploading…" : "Drop .html drills here"}</p>
            <p className="text-xs text-muted-foreground">Bulk upload supported · loads into <strong>{MODULES.find((m) => m.key === module)?.label}</strong></p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".html,text/html"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }}
          />
        </CardContent>
      </Card>

      {/* Library list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Dumbbell className="h-5 w-5 text-primary" /> {MODULES.find((m) => m.key === module)?.label} library</CardTitle>
          <CardDescription>Active drills are eligible for the daily rotation. Inactive drills are skipped.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <WorkspaceLoadingState title="Loading drills..." layout="table" />
          ) : drills.length === 0 ? (
            <EmptyState icon={Dumbbell} title="No drills yet" description="Upload .html drill files above to build this module's library." />
          ) : (
            <ul className="space-y-2">
              {drills.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{d.sizeKb} KB · added {new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="outline" className={d.isActive ? "border-emerald-300 text-emerald-600" : "border-border text-muted-foreground"}>
                    {d.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button type="button" size="sm" variant="outline" onClick={() => void preview(d)} className="cursor-pointer">
                    <Eye className="mr-1.5 h-4 w-4" /> Preview
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busyId === d.id} onClick={() => void toggleActive(d)} className="cursor-pointer">
                    {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : d.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => void remove(d)} className="cursor-pointer text-rose-600 hover:text-rose-700">
                    <Trash2 className="h-4 w-4" />
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
