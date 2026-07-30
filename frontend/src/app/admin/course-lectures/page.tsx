"use client";

/**
 * /admin/course-lectures — admin manager for the per-skill lecture library.
 * Create/edit/publish/delete lectures and tag each with a skill (which controls
 * which course entitlement unlocks it).
 */
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import type { SkillKey } from "@/hooks/use-ownership";
import { lecturesApi, type AdminLecture, type LectureInput } from "@/lib/lectures-api";

const SKILLS: SkillKey[] = ["READING", "LISTENING", "WRITING", "SPEAKING"];

const EMPTY: LectureInput = {
  skill: "READING", title: "", description: "", displayOrder: 0,
  bunnyVideoId: "", videoUrl: "", durationMin: null, isPublished: false
};

export default function AdminCourseLecturesPage() {
  const { profile, status, error, logout, refresh } = useSession();
  const [lectures, setLectures] = useState<AdminLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LectureInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true); setLoadError(null);
    try { setLectures((await lecturesApi.listAll()).lectures); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load lectures"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const startEdit = (l: AdminLecture) => {
    setEditingId(l.id);
    setForm({
      skill: l.skill, title: l.title, description: l.description ?? "", displayOrder: l.displayOrder,
      bunnyVideoId: l.bunnyVideoId ?? "", videoUrl: l.videoUrl ?? "", durationMin: l.durationMin, isPublished: l.isPublished
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const resetForm = () => { setEditingId(null); setForm(EMPTY); };

  const save = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      if (editingId) await lecturesApi.update(editingId, form);
      else await lecturesApi.create(form);
      resetForm();
      await reload();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try { await lecturesApi.remove(id); await reload(); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setBusy(false); }
  };

  const togglePublish = async (l: AdminLecture) => {
    setBusy(true);
    try { await lecturesApi.update(l.id, { isPublished: !l.isPublished }); await reload(); }
    finally { setBusy(false); }
  };

  const grouped = useMemo(() => {
    const m = new Map<SkillKey, AdminLecture[]>();
    for (const l of lectures) { const a = m.get(l.skill) ?? []; a.push(l); m.set(l.skill, a); }
    return SKILLS.filter((s) => m.has(s)).map((s) => ({ skill: s, items: m.get(s)! }));
  }, [lectures]);

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading..." layout="table" />;
  if (status === "unauth" || !profile) {
    return <WorkspaceAccessDeniedState title="Admin access required" description={error || "Log in as an admin."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />;
  }

  const set = <K extends keyof LectureInput>(k: K, v: LectureInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <AdminShell
      title="Course Lectures"
      description="Per-skill lecture library for the standalone courses. Tag each lecture with a skill — owning a course with that skill unlocks it."
      profile={profile}
      onRefresh={reload}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Something went wrong" description={loadError} /> : null}

      {/* Editor */}
      <section className="rounded-[16px] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="font-workspace-display text-lg font-semibold">{editingId ? "Edit lecture" : "Add a lecture"}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Title
            <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Reading Part A — Skimming" />
          </label>
          <label className="text-sm font-medium">Skill (controls which course unlocks it)
            <select className={inputCls} value={form.skill} onChange={(e) => set("skill", e.target.value as SkillKey)}>
              {SKILLS.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">Description
            <input className={inputCls} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Short summary" />
          </label>
          <label className="text-sm font-medium">Bunny video ID
            <input className={inputCls} value={form.bunnyVideoId ?? ""} onChange={(e) => set("bunnyVideoId", e.target.value)} placeholder="Bunny Stream video id (optional)" />
          </label>
          <label className="text-sm font-medium">Fallback video URL
            <input className={inputCls} value={form.videoUrl ?? ""} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://… (optional)" />
          </label>
          <label className="text-sm font-medium">Display order
            <input type="number" className={inputCls} value={form.displayOrder ?? 0} onChange={(e) => set("displayOrder", Number(e.target.value))} />
          </label>
          <label className="text-sm font-medium">Duration (min)
            <input type="number" className={inputCls} value={form.durationMin ?? ""} onChange={(e) => set("durationMin", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <input type="checkbox" checked={Boolean(form.isPublished)} onChange={(e) => set("isPublished", e.target.checked)} />
            Published (visible to entitled candidates)
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" onClick={save} disabled={busy || !form.title.trim()} className="cursor-pointer">
            <Plus className="mr-1.5 h-4 w-4" /> {editingId ? "Save changes" : "Add lecture"}
          </Button>
          {editingId ? <Button type="button" variant="outline" onClick={resetForm} className="cursor-pointer">Cancel</Button> : null}
        </div>
      </section>

      {/* List */}
      <div className="mt-6 space-y-6">
        {loading ? <WorkspaceLoadingState title="Loading lectures..." layout="table" /> :
          lectures.length === 0 ? <p className="text-sm text-muted-foreground">No lectures yet. Add one above.</p> :
          grouped.map(({ skill, items }) => (
            <section key={skill}>
              <h3 className="mb-2 font-workspace-display text-base font-semibold text-[hsl(var(--primary-deep))]">{skill[0] + skill.slice(1).toLowerCase()}</h3>
              <div className="space-y-2">
                {items.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{l.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        #{l.displayOrder}{l.durationMin ? ` · ${l.durationMin} min` : ""}{l.bunnyVideoId ? " · video set" : l.videoUrl ? " · url set" : " · no video"}
                      </p>
                    </div>
                    <Badge variant={l.isPublished ? "default" : "outline"} className="cursor-pointer" onClick={() => void togglePublish(l)}>
                      {l.isPublished ? "Published" : "Draft"}
                    </Badge>
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(l)} className="cursor-pointer"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void remove(l.id)} className="cursor-pointer text-rose-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>
    </AdminShell>
  );
}
