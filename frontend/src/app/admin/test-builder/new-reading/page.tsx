"use client";

/**
 * /admin/test-builder/new-reading — guided form that authors an OFFICIAL
 * (Rasch-scored) reading test. It assembles the canonical contentJson and
 * submits it through the same import API as the JSON paste flow, so a
 * form-built test renders and scores identically to an imported one.
 *
 * Standard OET reading layout (fixed):
 *   Part A — 4 texts A–D + 20 questions (letter-match and/or short answer), Q1–20.
 *   Part B — 6 workplace extracts, one 3-option MCQ each, Q21–26.
 *   Part C — 2 long texts, 8 four-option MCQs each, Q27–42.
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
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

const TEXT_LETTERS = ["A", "B", "C", "D"] as const;

type PartAQ = {
  type: "letter_match" | "fill_blank";
  prompt: string;
  answer: string; // letter for letter_match
  terms: string; // for fill_blank
  display: string;
  caseSensitive: boolean;
};
type ReadingText = { title: string; body: string };
type Mcq = { prompt: string; options: Record<string, string>; answer: string };
type PartBItem = Mcq & { kind: string; docTitle: string; docHtml: string };
type PartCText = { title: string; wordCount: string; body: string; questions: Mcq[] };

const blankMcq = (letters: readonly string[]): Mcq => ({
  prompt: "",
  options: Object.fromEntries(letters.map((l) => [l, ""])),
  answer: "",
});

type Form = {
  title: string;
  description: string;
  totalMinutes: number;
  partAMinutes: number;
  partBCMinutes: number;
  topic: string;
  partAInstructions: string;
  texts: ReadingText[];
  partAQuestions: PartAQ[];
  partBInstructions: string;
  partB: PartBItem[];
  partCInstructions: string;
  partC: PartCText[];
};

const initialForm = (): Form => ({
  title: "",
  description: "",
  totalMinutes: 60,
  partAMinutes: 15,
  partBCMinutes: 45,
  topic: "",
  partAInstructions: "",
  texts: TEXT_LETTERS.map(() => ({ title: "", body: "" })),
  partAQuestions: Array.from({ length: 20 }, () => ({ type: "letter_match", prompt: "", answer: "", terms: "", display: "", caseSensitive: false } as PartAQ)),
  partBInstructions: "",
  partB: Array.from({ length: 6 }, () => ({ ...blankMcq(["A", "B", "C"]), kind: "", docTitle: "", docHtml: "" })),
  partCInstructions: "",
  partC: Array.from({ length: 2 }, () => ({
    title: "",
    wordCount: "",
    body: "",
    questions: Array.from({ length: 8 }, () => blankMcq(["A", "B", "C", "D"])),
  })),
});

const splitParas = (s: string): string[] => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

/* ---- module-scope presentational helpers (so inputs never remount) ---- */
function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

/* ---- reusable MCQ editor (variable option count) ---- */
function McqEditor({ value, onChange, letters, numberLabel }: { value: Mcq; onChange: (m: Mcq) => void; letters: readonly string[]; numberLabel: string }) {
  return (
    <div className="space-y-2">
      <Textarea value={value.prompt} onChange={(e) => onChange({ ...value, prompt: e.target.value })} placeholder="Question stem…" rows={2} />
      <div className="grid gap-2">
        {letters.map((k) => (
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
    </div>
  );
}

export default function NewReadingBuilderPage() {
  const router = useRouter();
  const { profile, status, error, logout, refresh } = useSession();
  const [form, setForm] = useState<Form>(initialForm);
  const [saving, setSaving] = useState(false);

  const edit = (fn: (d: Form) => void) =>
    setForm((f) => {
      const d = structuredClone(f) as Form;
      fn(d);
      return d;
    });

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

  const buildDoc = () => {
    const partAQuestions = form.partAQuestions.map((q, i) => {
      const n = i + 1;
      if (q.type === "letter_match") return { n, type: "letter_match", prompt: q.prompt, answer: q.answer };
      const terms = q.terms.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
      return { n, type: "fill_blank", prompt: q.prompt, answer: { display: q.display.trim() || terms[0] || "", mode: "or", terms, caseSensitive: q.caseSensitive } };
    });
    const partBItems = form.partB.map((it, i) => ({
      n: 21 + i,
      kind: it.kind.trim() || undefined,
      docTitle: it.docTitle.trim() || undefined,
      docHtml: it.docHtml,
      prompt: it.prompt,
      options: it.options,
      answer: it.answer,
    }));
    let cn = 26;
    const partCTexts = form.partC.map((t) => ({
      title: t.title,
      wordCount: t.wordCount.trim() ? Number(t.wordCount) : undefined,
      paras: splitParas(t.body),
      questions: t.questions.map((q) => {
        cn += 1;
        return { n: cn, type: "mcq", prompt: q.prompt, options: q.options, answer: q.answer };
      }),
    }));
    return {
      schemaVersion: 1,
      type: "READING",
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      timing: { totalMinutes: Math.max(1, Math.round(form.totalMinutes)), partAMinutes: form.partAMinutes, partBCMinutes: form.partBCMinutes },
      partA: {
        instructions: form.partAInstructions.trim() || undefined,
        topic: form.topic.trim(),
        texts: form.texts.map((t, i) => ({ letter: TEXT_LETTERS[i], title: t.title, blocks: splitParas(t.body).map((html) => ({ type: "p", html })) })),
        questions: partAQuestions,
      },
      partB: { instructions: form.partBInstructions.trim() || undefined, items: partBItems },
      partC: { instructions: form.partCInstructions.trim() || undefined, texts: partCTexts },
    };
  };

  const localProblems = (): string[] => {
    const p: string[] = [];
    if (!form.title.trim()) p.push("Give the test a title.");
    if (!form.topic.trim()) p.push("Enter a Part A topic.");
    form.texts.forEach((t, i) => {
      if (!t.title.trim()) p.push(`Part A · Text ${TEXT_LETTERS[i]}: add a title.`);
      if (!t.body.trim()) p.push(`Part A · Text ${TEXT_LETTERS[i]}: add the passage text.`);
    });
    form.partAQuestions.forEach((q, i) => {
      if (!q.prompt.trim()) p.push(`Part A · Q${i + 1}: missing question.`);
      if (q.type === "letter_match" && !q.answer) p.push(`Part A · Q${i + 1}: choose the correct text (A–D).`);
      if (q.type === "fill_blank" && !q.terms.trim()) p.push(`Part A · Q${i + 1}: add at least one accepted answer.`);
    });
    form.partB.forEach((it, i) => {
      if (!it.docHtml.trim()) p.push(`Part B · Q${21 + i}: add the extract text.`);
      if (!it.prompt.trim()) p.push(`Part B · Q${21 + i}: missing question.`);
      if (!it.options.A.trim() || !it.options.B.trim() || !it.options.C.trim()) p.push(`Part B · Q${21 + i}: fill options A, B and C.`);
      if (!it.answer) p.push(`Part B · Q${21 + i}: pick the correct answer.`);
    });
    let cn = 26;
    form.partC.forEach((t, ti) => {
      if (!t.title.trim()) p.push(`Part C · Text ${ti + 1}: add a title.`);
      if (!t.body.trim()) p.push(`Part C · Text ${ti + 1}: add the passage text.`);
      t.questions.forEach((q) => {
        cn += 1;
        if (!q.prompt.trim()) p.push(`Part C · Q${cn}: missing question.`);
        if (["A", "B", "C", "D"].some((k) => !q.options[k].trim())) p.push(`Part C · Q${cn}: fill options A–D.`);
        if (!q.answer) p.push(`Part C · Q${cn}: pick the correct answer.`);
      });
    });
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
      const res = await oetTestsApi.import(buildDoc());
      toast.success(`Created "${res.title}" as a draft`);
      router.push(`/admin/oet-tests/${res.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create the test";
      const details = (e as { details?: { errors?: string[] } })?.details?.errors;
      toast.error(msg, { description: details?.slice(0, 3).join(" · ") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="New reading test" description="Guided builder — official Rasch scoring." profile={profile} compact onRefresh={refresh} onLogout={logout}>
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <button type="button" onClick={() => router.push("/admin/test-builder")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Test Builder
          </button>
          <Button type="button" onClick={() => void save()} disabled={saving} className="cursor-pointer">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Create draft
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-5 pb-24">
        <Section title="Test details">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => edit((d) => (d.title = e.target.value))} placeholder="OET Reading — Practice Test 2" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={form.description} onChange={(e) => edit((d) => (d.description = e.target.value))} placeholder="Full paper · Parts A, B & C" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">Total</Label><Input type="number" value={form.totalMinutes} onChange={(e) => edit((d) => (d.totalMinutes = Number(e.target.value) || 60))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Part A</Label><Input type="number" value={form.partAMinutes} onChange={(e) => edit((d) => (d.partAMinutes = Number(e.target.value) || 15))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Parts B+C</Label><Input type="number" value={form.partBCMinutes} onChange={(e) => edit((d) => (d.partBCMinutes = Number(e.target.value) || 45))} /></div>
            </div>
          </div>
        </Section>

        {/* ---------- Part A ---------- */}
        <Section title={<>Part A · Four texts <span className="font-normal text-muted-foreground">· Questions 1–20</span></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input value={form.topic} onChange={(e) => edit((d) => (d.topic = e.target.value))} placeholder="e.g. Thalassaemia" />
            </div>
            <div className="space-y-1.5">
              <Label>Part A instructions <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={form.partAInstructions} onChange={(e) => edit((d) => (d.partAInstructions = e.target.value))} placeholder="Standard wording used if blank" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">The four texts (A–D)</p>
            <div className="space-y-3">
              {form.texts.map((t, i) => (
                <div key={i} className="rounded-xl border border-border/70 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{TEXT_LETTERS[i]}</span>
                    <Input value={t.title} onChange={(e) => edit((d) => (d.texts[i].title = e.target.value))} placeholder={`Text ${TEXT_LETTERS[i]} title`} className="font-semibold" />
                  </div>
                  <Textarea value={t.body} onChange={(e) => edit((d) => (d.texts[i].body = e.target.value))} rows={4} placeholder="Passage text. Separate paragraphs with a blank line. HTML allowed." />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions 1–20</p>
            <p className="mb-3 text-xs text-muted-foreground">&quot;Which text&quot; = matching (pick A–D). &quot;Short answer&quot; = the student types a word/phrase.</p>
            <div className="space-y-3">
              {form.partAQuestions.map((q, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <select
                      value={q.type}
                      onChange={(e) => edit((d) => (d.partAQuestions[i].type = e.target.value as PartAQ["type"]))}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      <option value="letter_match">Which text (A–D)</option>
                      <option value="fill_blank">Short answer</option>
                    </select>
                  </div>
                  <Input value={q.prompt} onChange={(e) => edit((d) => (d.partAQuestions[i].prompt = e.target.value))} placeholder={q.type === "letter_match" ? "In which text can you find…?" : "Question — use [blank] for the gap, or leave it for a trailing input"} className="mb-2 h-8 text-sm" />
                  {q.type === "letter_match" ? (
                    <div className="flex gap-1.5">
                      {TEXT_LETTERS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => edit((d) => (d.partAQuestions[i].answer = l))}
                          className={`h-8 w-9 rounded-md border text-sm font-bold ${q.answer === l ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground"}`}
                        >
                          {l}
                        </button>
                      ))}
                      <span className="self-center pl-1 text-[11px] text-muted-foreground">correct text</span>
                    </div>
                  ) : (
                    <Input value={q.terms} onChange={(e) => edit((d) => (d.partAQuestions[i].terms = e.target.value))} placeholder="accepted answers, comma-separated" className="h-8 text-sm" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ---------- Part B ---------- */}
        <Section title={<>Part B · Workplace extracts <span className="font-normal text-muted-foreground">· Questions 21–26</span></>}>
          <div className="space-y-1.5">
            <Label className="text-xs">Part B instructions <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={form.partBInstructions} onChange={(e) => edit((d) => (d.partBInstructions = e.target.value))} placeholder="Standard wording used if blank" />
          </div>
          {form.partB.map((it, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/70 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Q{21 + i}</span>
                <Input value={it.kind} onChange={(e) => edit((d) => (d.partB[i].kind = e.target.value))} placeholder="Kind (Memo / Email…) — optional" className="h-8 text-sm" />
                <Input value={it.docTitle} onChange={(e) => edit((d) => (d.partB[i].docTitle = e.target.value))} placeholder="Document title — optional" className="h-8 text-sm" />
              </div>
              <Textarea value={it.docHtml} onChange={(e) => edit((d) => (d.partB[i].docHtml = e.target.value))} rows={3} placeholder="Extract text (HTML allowed)." />
              <McqEditor value={it} letters={["A", "B", "C"]} numberLabel={`Q${21 + i}`} onChange={(m) => edit((d) => (d.partB[i] = { ...d.partB[i], ...m }))} />
            </div>
          ))}
        </Section>

        {/* ---------- Part C ---------- */}
        <Section title={<>Part C · Long texts <span className="font-normal text-muted-foreground">· Questions 27–42</span></>}>
          <div className="space-y-1.5">
            <Label className="text-xs">Part C instructions <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={form.partCInstructions} onChange={(e) => edit((d) => (d.partCInstructions = e.target.value))} placeholder="Standard wording used if blank" />
          </div>
          {form.partC.map((t, ti) => (
            <div key={ti} className="rounded-xl border border-border/70 p-4">
              <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_120px]">
                <Input value={t.title} onChange={(e) => edit((d) => (d.partC[ti].title = e.target.value))} placeholder={`Text ${ti + 1} title (Questions ${27 + ti * 8}–${34 + ti * 8})`} className="font-semibold" />
                <Input value={t.wordCount} onChange={(e) => edit((d) => (d.partC[ti].wordCount = e.target.value))} placeholder="Word count" type="number" />
              </div>
              <Textarea value={t.body} onChange={(e) => edit((d) => (d.partC[ti].body = e.target.value))} rows={5} placeholder="Passage text. Separate paragraphs with a blank line." className="mb-3" />
              <div className="space-y-3">
                {t.questions.map((q, qi) => (
                  <div key={qi} className="rounded-lg bg-muted/30 p-3">
                    <div className="mb-1 text-xs font-semibold text-muted-foreground">Question {27 + ti * 8 + qi}</div>
                    <McqEditor value={q} letters={["A", "B", "C", "D"]} numberLabel={`Q${27 + ti * 8 + qi}`} onChange={(m) => edit((d) => (d.partC[ti].questions[qi] = m))} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>
      </div>
    </AdminShell>
  );
}
