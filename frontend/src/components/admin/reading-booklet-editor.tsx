"use client";

import { useState } from "react";
import { Eye, Maximize2 } from "lucide-react";
import { ReadingBookletPreview } from "@/components/admin/reading-booklet-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ReadingBookletContentEditor } from "@/components/admin/reading-booklet-content-editor";

const BOOKLET_HINTS = {
  A: "Reading passage shown during Part A (questions 1–20).",
  B: "Reading passage shown during Part B (one extract at a time).",
  C: "Reading passage for Part C. Candidates switch between Extract 1 (Q27–34) and Extract 2 (Q35–42)."
} as const;

const TABLE_HINT =
  "Use the table toolbar buttons to insert or edit tables in the booklet.";

type ReadingBookletEditorProps = {
  part: "A" | "B" | "C";
  value: string;
  onChange: (content: string) => void;
  bookletLabel?: string;
  bookletHint?: string;
  editorId?: string;
  contentSeed?: number;
};

export function ReadingBookletEditor({
  part,
  value,
  onChange,
  bookletLabel,
  bookletHint,
  editorId,
  contentSeed = 0
}: ReadingBookletEditorProps) {
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const resolvedEditorId = editorId || `part-${part.toLowerCase()}-booklet`;
  const label = bookletLabel || `Part ${part} booklet`;
  const hint = bookletHint || BOOKLET_HINTS[part];
  const placeholder = `Write the ${label.toLowerCase()}…`;

  return (
    <>
      <div className="surface-panel-subtle mb-4 space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={resolvedEditorId}>{label}</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Preview
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setFullViewOpen(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              Full view
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <p className="text-xs text-muted-foreground">{TABLE_HINT}</p>
        <ReadingBookletContentEditor
          id={resolvedEditorId}
          minHeight="lg"
          value={value}
          contentSeed={contentSeed}
          onChange={onChange}
          placeholder={placeholder}
        />
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 px-6 py-4 text-left">
            <DialogTitle>Candidate preview — {label}</DialogTitle>
            <DialogDescription>
              This matches the reading exam layout: your booklet on the left, questions on the right (desktop).
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <ReadingBookletPreview part={part} content={value} />
          </div>

          <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-3 sm:justify-end">
            <Button type="button" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fullViewOpen} onOpenChange={setFullViewOpen}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 px-6 py-4 text-left">
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{hint}</DialogDescription>
            <p className="text-xs text-muted-foreground">{TABLE_HINT}</p>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {fullViewOpen ? (
              <ReadingBookletContentEditor
                id={`${resolvedEditorId}-full`}
                minHeight="xl"
                value={value}
                contentSeed={contentSeed}
                onChange={onChange}
                placeholder={placeholder}
              />
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-3 sm:justify-end">
            <Button type="button" onClick={() => setFullViewOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
