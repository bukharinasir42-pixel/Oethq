"use client";

/**
 * OetImportDialog — one-paste OET test import for admins. Paste the canonical
 * JSON, validate it (live error feedback), then import → creates a DRAFT test.
 */
import { useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { oetTestsApi, type OetValidateResult } from "@/lib/oet-tests-api";

export function OetImportDialog({
  onImported,
  replaceTestId,
  triggerLabel
}: {
  onImported?: (testId: string) => void;
  replaceTestId?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<OetValidateResult | null>(null);

  const parse = (): unknown | undefined => {
    try {
      return JSON.parse(raw);
    } catch {
      setResult({ ok: false, errors: ["That isn't valid JSON — check for a stray comma or unquoted value."] });
      return undefined;
    }
  };

  const validate = async () => {
    setResult(null);
    const json = parse();
    if (json === undefined) return;
    setChecking(true);
    try {
      setResult(await oetTestsApi.validate(json));
    } catch (e) {
      setResult({ ok: false, errors: [e instanceof Error ? e.message : "Validation failed"] });
    } finally {
      setChecking(false);
    }
  };

  const doImport = async () => {
    const json = parse();
    if (json === undefined) return;
    setImporting(true);
    try {
      const res = await oetTestsApi.import(json, replaceTestId);
      toast.success(
        replaceTestId
          ? `Replaced "${res.title}" (${res.totalQuestions} questions)`
          : `Imported "${res.title}" (${res.totalQuestions} questions) as a draft`
      );
      setOpen(false);
      setRaw("");
      setResult(null);
      onImported?.(res.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      // Surface server-side validation errors if present.
      const errs = (e as { data?: { errors?: string[] } })?.data?.errors;
      setResult({ ok: false, errors: errs?.length ? errs : [msg] });
      toast.error("Import failed — see the errors below");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="cursor-pointer">
          <FileUp className="mr-2 h-4 w-4" /> {triggerLabel ?? "Import OET test (paste JSON)"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import an OET test</DialogTitle>
          <DialogDescription>
            Paste one canonical OET test JSON (Reading or Listening). It&apos;s validated, then added as a{" "}
            <strong>draft</strong> — publish it when you&apos;re ready.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setResult(null);
          }}
          placeholder='{ "schemaVersion": 1, "type": "READING", "title": "…", "timing": { … }, "partA": { … }, "partB": { … }, "partC": { … } }'
          className="h-64 font-mono text-xs"
          spellCheck={false}
        />

        {result && !result.ok && (
          <div className="max-h-40 overflow-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertCircle className="h-4 w-4" /> {result.errors.length} issue{result.errors.length === 1 ? "" : "s"} found
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {result.errors.slice(0, 25).map((er, i) => (
                <li key={i}>{er}</li>
              ))}
            </ul>
          </div>
        )}
        {result && result.ok && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Looks good
            </p>
            <p className="mt-0.5">
              {result.type} · <strong>{result.title}</strong> · {result.totalQuestions} questions
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={validate} disabled={checking || !raw.trim()} className="cursor-pointer">
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Validate
          </Button>
          <Button type="button" onClick={doImport} disabled={importing || !raw.trim()} className="cursor-pointer">
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {replaceTestId ? "Replace test" : "Import as draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
