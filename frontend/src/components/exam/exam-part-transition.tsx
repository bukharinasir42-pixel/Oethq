"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReadingSectionIntro } from "./reading/reading-exam-instructions";
import { ReadingSectionIntroBlock } from "./reading/reading-section-intro";

type ExamPartTransitionProps = {
  part: "B" | "C";
  partIntro?: ReadingSectionIntro | null;
  onDismiss?: () => void;
};

const AUTO_DISMISS_MS = 8000;

export function ExamPartTransition({ part, partIntro, onDismiss }: ExamPartTransitionProps) {
  const [visible, setVisible] = useState(true);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = useCallback(() => {
    setVisible(false);
    onDismissRef.current?.();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [dismiss, part]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 p-6 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-part-transition-title"
      aria-describedby="exam-part-transition-desc"
    >
      <div
        className={cn(
          "max-w-md rounded-2xl border border-primary/25 bg-card px-8 py-10 text-center shadow-xl",
          "motion-safe:zoom-in-95 motion-safe:duration-300"
        )}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <BookOpen className="h-7 w-7" aria-hidden />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Section change</p>
        <h2 id="exam-part-transition-title" className="mt-2 font-portal-display text-2xl font-semibold text-foreground">
          Part {part} begins now
        </h2>
        <p id="exam-part-transition-desc" className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {part === "B"
            ? "Your Part B booklet is on the left. Answer one question at a time. You can return to Part A if you need to review."
            : "Your Part C booklet is on the left. You can move between Part A, B, and C to review or change answers."}
        </p>
        {partIntro ? (
          <div className="mt-5 text-left">
            <ReadingSectionIntroBlock {...partIntro} />
          </div>
        ) : null}
        <Button type="button" className="mt-8 min-w-[10rem]" size="lg" onClick={dismiss} autoFocus>
          Continue to Part {part}
        </Button>
      </div>
    </div>
  );
}
