"use client";

/**
 * /admin/writing — "Writing Correction": per-profession case-note libraries, the
 * per-profession correction inbox, and a submissions tracker (per student letter
 * counts + full-letter review).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookText, Check, Loader2, Mail, Pencil, Plus, Trash2 } from "lucide-react";
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
import { PROFESSIONS } from "@/lib/profile-options";
import { writingApi, type AdminCaseNoteRow, type AdminCaseNoteFull, type AdminSubmissionRow, type CaseNoteInput } from "@/lib/writing-api";

const selectCls = "h-9 rounded-md border border-border bg-background px-2.5 text-sm";
const blankForm = (): CaseNoteInput => ({ title: "", scenario: "", caseNotesHtml: "", wordGuidance: "180–200", timeLimitMin: 45 });

export default function AdminWritingPage() {
  const { profile, status, error, logout, refresh } = useSession();
  const [tab, setTab] = useState<"library" | "submissions">("library");
  const [profession, setProfession] = useState<string>(PROFESSIONS[0]);
  const [counts, setCounts] = useState<Record<string, { total: number; active: number }>>({});
  const [notes, setNotes] = useState<AdminCaseNoteRow[]>([]);
  const [settings, setSettings] = useState<{ settings: Record<string, string>; globalDefault: string } | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [form, setForm] = useState<CaseNoteInput>(blankForm);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AdminCaseNoteFull | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // submissions
  const [subs, setSubs] = useState<AdminSubmissionRow[]>([]);
  const [subFilter, setSubFilter] = useState("");
  const [viewSub, setViewSub] = useState<Awaited<ReturnType<typeof writingApi.adminSubmission>> | null>(null);

  const loadLibrary = useCallback(async (prof: string) => {
    try {
      const [c, list, s] = await Promise.all([writingApi.adminCounts(), writingApi.adminList(prof), writingApi.adminSettings()]);
      setCounts(c); setNotes(list.caseNotes); setSettings(s);
      setEmailInput(s.settings[prof] ?? "");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
  }, []);

  const loadSubs = useCallback(async (prof?: string) => {
    try { setSubs((await writingApi.adminSubmissions(prof ? { profession: prof } : {})).submissions); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load submissions"); }
  }, []);

  useEffect(() => { if (profile?.role === "ADMIN") void loadLibrary(profession); }, [profile, profession, loadLibrary]);
  useEffect(() => { if (profile?.role === "ADMIN" && tab === "submissions") void loadSubs(subFilter || undefined); }, [profile, tab, subFilter, loadSubs]);

  const addNote = async () => {
    if (!form.title.trim() || !form.caseNotesHtml.trim()) { toast.error("Add a title and the case notes"); return; }
    setBusy(true);
    try {
      await writingApi.adminCreate(profession, form);
      toast.success("Case note added");
      setForm(blankForm());
      await loadLibrary(profession);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add"); }
    finally { setBusy(false); }
  };

  const saveEmail = async () => {
    setBusy(true);
    try {
      await writingApi.adminSetSetting(profession, emailInput.trim());
      toast.success(emailInput.trim() ? "Correction email saved" : "Cleared — using global default");
      await loadLibrary(profession);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  };

  const saveGlobal = async () => {
    const v = window.prompt("Global default correction email (used when a profession has none):", settings?.globalDefault ?? "");
    if (v === null) return;
    try { await writingApi.adminSetSetting("*", v.trim()); toast.success("Global default saved"); await loadLibrary(profession); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
  };

  const toggleActive = async (n: AdminCaseNoteRow) => {
    try { await writingApi.adminUpdate(n.id, { isActive: !n.isActive }); await loadLibrary(profession); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };
  const removeNote = async (n: AdminCaseNoteRow) => {
    if (!window.confirm(`Delete "${n.title}"?`)) return;
    try { await writingApi.adminDelete(n.id); await loadLibrary(profession); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  };
  const openEdit = async (id: string) => { try { setEditing(await writingApi.adminGet(id)); } catch { toast.error("Could not load"); } };
  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await writingApi.adminUpdate(editing.id, { title: editing.title, scenario: editing.scenario, caseNotesHtml: editing.caseNotesHtml, wordGuidance: editing.wordGuidance, timeLimitMin: editing.timeLimitMin });
      toast.success("Saved"); setEditing(null); await loadLibrary(profession);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSavingEdit(false); }
  };

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading…" layout="table" />;
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return <WorkspaceAccessDeniedState title="Admin access required" description={error || "Sign in with an admin account."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />;
  }

  const profCount = counts[profession] ?? { total: 0, active: 0 };
  const effectiveEmail = settings?.settings[profession] || settings?.globalDefault || "info@oethq.com";

  return (
    <AdminShell title="Writing Correction" description="Per-profession case-note libraries and the letters students submit for correction." profile={profile} onRefresh={() => (tab === "library" ? loadLibrary(profession) : loadSubs(subFilter || undefined))} onLogout={logout}>
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {/* tab switch */}
        <div className="flex gap-2">
          {(["library", "submissions"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg border px-4 py-1.5 text-sm font-semibold ${tab === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              {t === "library" ? "Case-note libraries" : "Submissions"}
            </button>
          ))}
        </div>

        {tab === "library" ? (
          <>
            {/* profession picker */}
            <Card>
              <CardHeader><CardTitle className="text-base">Profession library</CardTitle><CardDescription>Students only see the library for the profession they chose at sign-up.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select className={selectCls} value={profession} onChange={(e) => setProfession(e.target.value)}>
                    {PROFESSIONS.map((p) => <option key={p} value={p}>{p}{counts[p] ? ` (${counts[p].active}/${counts[p].total})` : ""}</option>)}
                  </select>
                  <Badge variant="outline">{profCount.active} published · {profCount.total} total</Badge>
                </div>
                <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                  <div className="flex-1 space-y-1"><Label className="flex items-center gap-1 text-xs"><Mail className="h-3.5 w-3.5" /> Correction inbox for {profession}</Label>
                    <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder={`Default: ${settings?.globalDefault ?? "info@oethq.com"}`} />
                  </div>
                  <Button type="button" onClick={() => void saveEmail()} disabled={busy} className="cursor-pointer">Save inbox</Button>
                  <Button type="button" variant="outline" onClick={() => void saveGlobal()} className="cursor-pointer">Global default…</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Letters for {profession} currently route to <b>{effectiveEmail}</b>.</p>
              </CardContent>
            </Card>

            {/* add case note */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> Add a case note to {profession}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Discharge letter — Mrs Elena Ruiz" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Task / scenario <span className="text-muted-foreground">(the instruction line)</span></Label><Textarea value={form.scenario} onChange={(e) => setForm({ ...form, scenario: e.target.value })} rows={2} placeholder="You are the charge nurse… Write a letter to… HTML allowed." /></div>
                <div className="space-y-1.5"><Label className="text-xs">Case notes <span className="text-muted-foreground">(HTML — headings, lists, tables allowed)</span></Label><Textarea value={form.caseNotesHtml} onChange={(e) => setForm({ ...form, caseNotesHtml: e.target.value })} rows={8} className="font-mono text-xs" placeholder="<h3>Patient</h3><p>…</p><h3>Admission</h3><ul><li>…</li></ul>" /></div>
                <div className="grid grid-cols-[1fr_140px] gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Word guidance</Label><Input value={form.wordGuidance ?? ""} onChange={(e) => setForm({ ...form, wordGuidance: e.target.value })} placeholder="180–200" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Minutes</Label><Input type="number" value={form.timeLimitMin ?? 45} onChange={(e) => setForm({ ...form, timeLimitMin: Number(e.target.value) || 45 })} /></div>
                </div>
                <div className="flex justify-end"><Button type="button" onClick={() => void addNote()} disabled={busy} className="cursor-pointer">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add case note (draft)</Button></div>
              </CardContent>
            </Card>

            {/* list */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookText className="h-4 w-4" /> {profession} case notes</CardTitle></CardHeader>
              <CardContent>
                {notes.length === 0 ? <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">No case notes yet for {profession}.</p> : (
                  <div className="divide-y divide-border/60">
                    {notes.map((n) => (
                      <div key={n.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{n.title}</p><p className="truncate text-xs text-muted-foreground">{n.timeLimitMin} min · {n.wordGuidance || "180–200"} words</p></div>
                        <Badge variant={n.isActive ? "default" : "outline"} className="shrink-0">{n.isActive ? "Published" : "Draft"}</Badge>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Edit" onClick={() => void openEdit(n.id)}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" variant="outline" size="sm" className="shrink-0 cursor-pointer" onClick={() => void toggleActive(n)}>{n.isActive ? "Unpublish" : "Publish"}</Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" title="Delete" onClick={() => void removeNote(n)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Submitted letters</CardTitle>
                <select className={selectCls} value={subFilter} onChange={(e) => setSubFilter(e.target.value)}>
                  <option value="">All professions</option>
                  {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <CardDescription>Each student has a stable writing ID; letters are numbered per student.</CardDescription>
            </CardHeader>
            <CardContent>
              {subs.length === 0 ? <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">No submissions yet.</p> : (
                <div className="divide-y divide-border/60">
                  {subs.map((s) => (
                    <button key={s.id} type="button" onClick={async () => { try { setViewSub(await writingApi.adminSubmission(s.id)); } catch { toast.error("Could not load"); } }} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/30">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">#{s.letterNumber}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.studentName} <span className="font-mono text-xs text-muted-foreground">· {s.studentCode}</span></p>
                        <p className="truncate text-xs text-muted-foreground">{s.caseNoteTitle} · {s.profession} · {s.wordCount} words · {new Date(s.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{s.studentTotal} total</Badge>
                      {s.emailDelivered ? <span title="Emailed to corrector" className="shrink-0 text-emerald-600"><Check className="h-4 w-4" /></span> : <span title="Email not delivered" className="shrink-0 text-amber-500"><Mail className="h-4 w-4" /></span>}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* edit case note */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Edit case note</DialogTitle></DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Task / scenario</Label><Textarea value={editing.scenario} onChange={(e) => setEditing({ ...editing, scenario: e.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Case notes (HTML)</Label><Textarea value={editing.caseNotesHtml} onChange={(e) => setEditing({ ...editing, caseNotesHtml: e.target.value })} rows={10} className="font-mono text-xs" /></div>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Word guidance</Label><Input value={editing.wordGuidance ?? ""} onChange={(e) => setEditing({ ...editing, wordGuidance: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Minutes</Label><Input type="number" value={editing.timeLimitMin} onChange={(e) => setEditing({ ...editing, timeLimitMin: Number(e.target.value) || 45 })} /></div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} className="cursor-pointer">Cancel</Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={savingEdit} className="cursor-pointer">{savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* view submission */}
      <Dialog open={!!viewSub} onOpenChange={(v) => { if (!v) setViewSub(null); }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Letter #{viewSub?.letterNumber} · {viewSub?.studentCode}</DialogTitle>
            <DialogDescription>{viewSub?.student?.name} &lt;{viewSub?.student?.email}&gt; · {viewSub?.caseNoteTitle} · {viewSub?.wordCount} words</DialogDescription>
          </DialogHeader>
          {viewSub ? <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground" style={{ fontFamily: "Georgia, serif" }}>{viewSub.letterText || "(blank)"}</div> : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
