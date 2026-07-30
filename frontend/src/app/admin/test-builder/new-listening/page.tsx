"use client";

/**
 * /admin/test-builder/new-listening — guided form that authors an OFFICIAL
 * (Rasch-scored) listening test. It assembles the canonical contentJson and
 * submits it through the same import + audio APIs as the JSON paste flow, so a
 * form-built test renders and scores identically to an imported one.
 *
 * Standard OET layout: Part A = 2 extracts, note-completion Q1–24; Part B = 6
 * MCQ items Q25–30; Part C = 2 extracts, MCQ Q31–42.
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Link2, Loader2, Music, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { oetTestsApi } from "@/lib/oet-tests-api";

type Letter = "A" | "B" | "C";
type NoteLine = { prompt: string; terms: string; display: string };
type Section = { heading: string; lines: NoteLine[] };
type PartAExtract = { heading: string; contextHtml: string; sections: Section[] };
type Mcq = { prompt: string; options: Record<Letter, string>; answer: Letter | "" };
type PartBItem = Mcq & { contextHtml: string };
type PartCExtract = { heading: string; contextHtml: string; questions: Mcq[] };

const blankLine = (): NoteLine => ({ prompt: "", terms: "", display: "" });
const blankMcq = (): Mcq => ({ prompt: "", options: { A: "", B: "", C: "" }, answer: "" });
const blankPartBItem = (): PartBItem => ({ ...blankMcq(), contextHtml: "" });

const initialPartA = (): PartAExtract[] => [
  { heading: "Extract 1 · Questions 1–12", contextHtml: "", sections: [{ heading: "", lines: Array.from({ length: 12 }, blankLine) }] },
  { heading: "Extract 2 · Questions 13–24", contextHtml: "", sections: [{ heading: "", lines: Array.from({ length: 12 }, blankLine) }] },
];
const initialPartC = (): PartCExtract[] => [
  { heading: "Extract 1 · Questions 31–36", contextHtml: "", questions: Array.from({ length: 6 }, blankMcq) },
  { heading: "Extract 2 · Questions 37–42", contextHtml: "", questions: Array.from({ length: 6 }, blankMcq) },
];

type Form = {
  title: string;
  description: string;
  totalMinutes: number;
  partAInstructions: string;
  partBInstructions: string;
  partCInstructions: string;
  partA: PartAExtract[];
  partB: PartBItem[];
  partC: PartCExtract[];
};

const initialForm = (): Form => ({
  title: "",
  description: "",
  totalMinutes: 45,
  partAInstructions: "",
  partBInstructions: "",
  partCInstructions: "",
  partA: initialPartA(),
  partB: Array.from({ length: 6 }, blankPartBItem),
  partC: initialPartC(),
});

/* ---- presentational helpers (module-scope so inputs never remount) ---- */
function CountPill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
      {ok ? <Check className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

function McqEditor({ value, onChange, numberLabel }: { value: Mcq; onChange: (m: Mcq) => void; numberLabel: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{numberLabel} · question</Label>
      <Textarea value={value.prompt} onChange={(e) => onChange({ ...value, prompt: e.target.value })} placeholder="What does the speaker suggest about…?" rows={2} />
      <div className="grid gap-2">
        {(["A", "B", "C"] as Letter[]).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="radio"
              name={`${numberLabel}-ans`}
              checked={value.answer === k}
              onChange={() => onChange({ ...value, answer: k })}
              className="h-4 w-4 shrink-0 accent-emerald-600"
              title="Mark as the correct answer"
            />
            <span className="w-4 shrink-0 text-xs font-bold text-muted-foreground">{k}</span>
            <Input value={value.options[k]} onChange={(e) => onChange({ ...value, options: { ...value.options, [k]: e.target.value } })} placeholder={`Option ${k}`} />
          </label>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Select the radio next to the correct option.</p>
    </div>
  );
}

export default function NewListeningBuilderPage() {
  const router = useRouter();
  const { profile, status, error, logout, refresh } = useSession();
  const [form, setForm] = useState<Form>(initialForm);
  const [audioMode, setAudioMode] = useState<"none" | "upload" | "url">("none");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Immutable deep update helper. */
  const edit = (fn: (d: Form) => void) =>
    setForm((f) => {
      const d = structuredClone(f) as Form;
      fn(d);
      return d;
    });

  const partACount = useMemo(
    () => form.partA.reduce((t, ex) => t + ex.sections.reduce((s, sec) => s + sec.lines.length, 0), 0),
    [form.partA]
  );
  const partCCount = useMemo(() => form.partC.reduce((t, ex) => t + ex.questions.length, 0), [form.partC]);

  // running question numbers for display
  const partANumbers = useMemo(() => {
    const out: number[][][] = [];
    let n = 0;
    for (const ex of form.partA) {
      const exArr: number[][] = [];
      for (const sec of ex.sections) exArr.push(sec.lines.map(() => ++n));
      out.push(exArr);
    }
    return out;
  }, [form.partA]);
  const partCNumbers = useMemo(() => {
    const out: number[][] = [];
    let n = 30;
    for (const ex of form.partC) out.push(ex.questions.map(() => ++n));
    return out;
  }, [form.partC]);

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading…" layout="editor" />;
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

  const countsOk = partACount === 24 && form.partB.length === 6 && partCCount === 12;

  const buildDoc = () => {
    let n = 0;
    const partA = form.partA.map((ex) => {
      const groups: { heading: string; questionNumbers: number[] }[] = [];
      const questions: unknown[] = [];
      for (const sec of ex.sections) {
        const qns: number[] = [];
        for (const line of sec.lines) {
          n += 1;
          qns.push(n);
          const terms = line.terms.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
          questions.push({
            n,
            type: "fill_blank",
            prompt: line.prompt.includes("[blank]") ? line.prompt : `${line.prompt} [blank]`,
            answer: { display: line.display.trim() || terms[0] || "", mode: "or", terms, caseSensitive: false },
          });
        }
        groups.push({ heading: sec.heading, questionNumbers: qns });
      }
      return { heading: ex.heading, contextHtml: ex.contextHtml, groups, questions };
    });
    const partB = form.partB.map((it, i) => ({
      n: 25 + i,
      extractLabel: `Extract ${i + 1}`,
      contextHtml: it.contextHtml,
      prompt: it.prompt,
      options: it.options,
      answer: it.answer,
    }));
    let cn = 30;
    const partC = form.partC.map((ex) => ({
      heading: ex.heading,
      contextHtml: ex.contextHtml,
      questions: ex.questions.map((q) => {
        cn += 1;
        return { n: cn, type: "mcq", prompt: q.prompt, options: q.options, answer: q.answer };
      }),
    }));
    return {
      schemaVersion: 1,
      type: "LISTENING",
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      timing: { totalMinutes: Math.max(1, Math.round(form.totalMinutes)) },
      partA: { instructions: form.partAInstructions.trim() || undefined, extracts: partA },
      partB: { instructions: form.partBInstructions.trim() || undefined, items: partB },
      partC: { instructions: form.partCInstructions.trim() || undefined, extracts: partC },
    };
  };

  const localProblems = (): string[] => {
    const p: string[] = [];
    if (!form.title.trim()) p.push("Give the test a title.");
    if (partACount !== 24) p.push(`Part A must have exactly 24 note lines (currently ${partACount}).`);
    if (partCCount !== 12) p.push(`Part C must have exactly 12 questions (currently ${partCCount}).`);
    form.partA.forEach((ex, ei) =>
      ex.sections.forEach((sec) =>
        sec.lines.forEach((l, li) => {
          if (!l.prompt.trim()) p.push(`Part A · Extract ${ei + 1}: a note line ${li + 1} is missing its prompt.`);
          if (!l.terms.trim()) p.push(`Part A · Extract ${ei + 1}: note line ${li + 1} needs at least one accepted answer.`);
        })
      )
    );
    form.partB.forEach((it, i) => {
      if (!it.prompt.trim()) p.push(`Part B · Q${25 + i}: missing question.`);
      if (!it.options.A.trim() || !it.options.B.trim() || !it.options.C.trim()) p.push(`Part B · Q${25 + i}: fill options A, B and C.`);
      if (!it.answer) p.push(`Part B · Q${25 + i}: pick the correct answer.`);
    });
    let cn = 30;
    form.partC.forEach((ex, ei) =>
      ex.questions.forEach((q) => {
        cn += 1;
        if (!q.prompt.trim()) p.push(`Part C · Q${cn}: missing question.`);
        if (!q.options.A.trim() || !q.options.B.trim() || !q.options.C.trim()) p.push(`Part C · Q${cn}: fill options A, B and C.`);
        if (!q.answer) p.push(`Part C · Q${cn}: pick the correct answer.`);
      })
    );
    return p;
  };

  const save = async () => {
    const problems = localProblems();
    if (problems.length) {
      toast.error(problems[0], { description: problems.length > 1 ? `+ ${problems.length - 1} more to fix` : undefined });
      return;
    }
    setSaving(true);
    try {
      let audioAssetId: string | null = null;
      if (audioMode === "upload" && audioFile) {
        const asset = await oetTestsApi.uploadAudio(audioFile);
        audioAssetId = asset.id;
      }
      const res = await oetTestsApi.import(buildDoc());
      if (audioAssetId) await oetTestsApi.setAudio(res.id, { audioAssetId });
      else if (audioMode === "url" && audioUrl.trim()) await oetTestsApi.setAudio(res.id, { audioUrl: audioUrl.trim() });
      toast.success(`Created "${res.title}" as a draft`);
      router.push(`/admin/oet-tests/${res.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create the test";
      // import errors carry a details array
      const details = (e as { details?: { errors?: string[] } })?.details?.errors;
      toast.error(msg, { description: details?.slice(0, 3).join(" · ") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="New listening test" description="Guided builder — official Rasch scoring." profile={profile} compact onRefresh={refresh} onLogout={logout}>
      {/* sticky action bar */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push("/admin/test-builder")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Test Builder
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <CountPill ok={partACount === 24}>Part A {partACount}/24</CountPill>
            <CountPill ok={form.partB.length === 6}>Part B {form.partB.length}/6</CountPill>
            <CountPill ok={partCCount === 12}>Part C {partCCount}/12</CountPill>
            <Button type="button" onClick={() => void save()} disabled={saving || !countsOk} className="cursor-pointer">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Create draft
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-5 pb-24">
        {/* ---------- meta ---------- */}
        <Card>
          <CardHeader><CardTitle className="text-base">Test details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => edit((d) => (d.title = e.target.value))} placeholder="OET Listening — Practice Test 6" />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={form.description} onChange={(e) => edit((d) => (d.description = e.target.value))} placeholder="Complete Listening Sub-test · Parts A, B & C" />
              </div>
              <div className="space-y-1.5">
                <Label>Time (min)</Label>
                <Input type="number" value={form.totalMinutes} onChange={(e) => edit((d) => (d.totalMinutes = Number(e.target.value) || 45))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------- audio ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Music className="h-4 w-4" /> Listening audio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["none", "upload", "url"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAudioMode(m)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${audioMode === m ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground"}`}
                >
                  {m === "none" ? "Add later" : m === "upload" ? "Upload file" : "Paste URL"}
                </button>
              ))}
            </div>
            {audioMode === "upload" ? (
              <div className="space-y-1.5">
                <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> {audioFile ? audioFile.name : "Choose audio file"}
                </Button>
              </div>
            ) : audioMode === "url" ? (
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <Input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://…/audio.mp3" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">You can attach the recording after saving, on the test&apos;s page.</p>
            )}
          </CardContent>
        </Card>

        {/* ---------- Part A ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part A · Note completion <span className="font-normal text-muted-foreground">· Questions 1–24</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Part A instructions <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={form.partAInstructions} onChange={(e) => edit((d) => (d.partAInstructions = e.target.value))} rows={2} placeholder="Leave blank to use the standard OET Part A wording." />
            </div>
            {form.partA.map((ex, ei) => (
              <div key={ei} className="rounded-xl border border-border/70 p-4">
                <div className="mb-3 space-y-2">
                  <Input value={ex.heading} onChange={(e) => edit((d) => (d.partA[ei].heading = e.target.value))} placeholder="Extract heading" className="font-semibold" />
                  <Textarea value={ex.contextHtml} onChange={(e) => edit((d) => (d.partA[ei].contextHtml = e.target.value))} rows={2} placeholder="Context / intro shown above the notes (HTML allowed)." />
                </div>
                {ex.sections.map((sec, si) => (
                  <div key={si} className="mb-3 rounded-lg bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Input value={sec.heading} onChange={(e) => edit((d) => (d.partA[ei].sections[si].heading = e.target.value))} placeholder="Sub-heading (e.g. Symptoms) — optional" className="h-8 text-sm" />
                      {ex.sections.length > 1 ? (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => edit((d) => d.partA[ei].sections.splice(si, 1))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {sec.lines.map((line, li) => (
                        <div key={li} className="grid gap-2 rounded-md bg-background p-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center">
                          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">{partANumbers[ei]?.[si]?.[li]}</span>
                          <Input value={line.prompt} onChange={(e) => edit((d) => (d.partA[ei].sections[si].lines[li].prompt = e.target.value))} placeholder="note text — use [blank] for the gap" className="h-8 text-sm" />
                          <Input value={line.terms} onChange={(e) => edit((d) => (d.partA[ei].sections[si].lines[li].terms = e.target.value))} placeholder="accepted answers, comma-separated" className="h-8 text-sm" />
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => edit((d) => d.partA[ei].sections[si].lines.splice(li, 1))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="mt-2 cursor-pointer text-primary" onClick={() => edit((d) => d.partA[ei].sections[si].lines.push(blankLine()))}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add note line
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => edit((d) => d.partA[ei].sections.push({ heading: "", lines: [blankLine()] }))}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add sub-heading group
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ---------- Part B ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part B · Short extracts <span className="font-normal text-muted-foreground">· Questions 25–30</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Part B instructions <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={form.partBInstructions} onChange={(e) => edit((d) => (d.partBInstructions = e.target.value))} rows={2} placeholder="Leave blank for the standard wording." />
            </div>
            {form.partB.map((it, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border/70 p-4">
                <Textarea value={it.contextHtml} onChange={(e) => edit((d) => (d.partB[i].contextHtml = e.target.value))} rows={2} placeholder={`Q${25 + i} · extract context (who is speaking / setting) — HTML allowed`} />
                <McqEditor value={it} numberLabel={`Q${25 + i}`} onChange={(m) => edit((d) => (d.partB[i] = { ...m, contextHtml: d.partB[i].contextHtml }))} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ---------- Part C ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Part C · Extended listening <span className="font-normal text-muted-foreground">· Questions 31–42</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Part C instructions <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={form.partCInstructions} onChange={(e) => edit((d) => (d.partCInstructions = e.target.value))} rows={2} placeholder="Leave blank for the standard wording." />
            </div>
            {form.partC.map((ex, ei) => (
              <div key={ei} className="rounded-xl border border-border/70 p-4">
                <div className="mb-3 space-y-2">
                  <Input value={ex.heading} onChange={(e) => edit((d) => (d.partC[ei].heading = e.target.value))} placeholder="Extract heading" className="font-semibold" />
                  <Textarea value={ex.contextHtml} onChange={(e) => edit((d) => (d.partC[ei].contextHtml = e.target.value))} rows={2} placeholder="Shared context for the extract (HTML allowed)." />
                </div>
                <div className="space-y-4">
                  {ex.questions.map((q, qi) => (
                    <div key={qi} className="rounded-lg bg-muted/30 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Question {partCNumbers[ei]?.[qi]}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => edit((d) => d.partC[ei].questions.splice(qi, 1))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <McqEditor value={q} numberLabel={`Q${partCNumbers[ei]?.[qi]}`} onChange={(m) => edit((d) => (d.partC[ei].questions[qi] = m))} />
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3 cursor-pointer" onClick={() => edit((d) => d.partC[ei].questions.push(blankMcq()))}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add question
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
