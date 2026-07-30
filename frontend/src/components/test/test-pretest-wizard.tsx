"use client";

import { useState } from "react";
import { ArrowRight, ClipboardCheck, Headphones, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WorkspaceErrorAlert } from "@/components/layout/workspace-states";
import type { TestDetailDto } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Before you begin",
    icon: ClipboardCheck,
    body: [
      "This session runs under exam-style rules: timers persist if you leave and return.",
      "Do not refresh the page to reset progress—your attempt state is saved on the server.",
      "Only start when you can work uninterrupted for the scheduled duration."
    ]
  },
  {
    title: "Timing and navigation",
    icon: Timer,
    body: [
      "The global clock keeps running across parts unless instructions say otherwise.",
      "Some reading parts lock back-navigation—read each screen carefully before advancing.",
      "Submit when finished, or the system will auto-submit if time expires."
    ]
  },
  {
    title: "Listening extracts",
    icon: Headphones,
    body: [
      "Audio plays in order—there is no gap between extracts.",
      "Each clip plays once; after the final extract you have a short countdown before auto-submit.",
      "Use working headphones and stable volume before you start."
    ]
  }
] as const;

type TestPretestWizardProps = {
  token: string;
  testId: string;
  test: TestDetailDto;
  onBegin: () => void;
};

export function TestPretestWizard({ test, onBegin }: TestPretestWizardProps) {
  const [step, setStep] = useState(0);

  if (test.type === "READING") {
    return (
      <WorkspaceErrorAlert
        title="Instructions unavailable"
        description="Reading tests use the dedicated instruction screen. Refresh the page to try again."
      />
    );
  }

  const listeningHints = test.type === "LISTENING";
  const stepsToShow = listeningHints ? STEPS : STEPS.filter((_, i) => i !== 2);
  const active = stepsToShow[Math.min(step, stepsToShow.length - 1)];
  const Icon = active.icon;
  const progress = ((step + 1) / stepsToShow.length) * 100;

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-2xl space-y-6",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
      )}
    >
      <div className="space-y-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">Exam preparation</p>
        <h1 className="font-portal-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{test.title}</h1>
        <p className="text-sm text-muted-foreground">
          {test.type === "LISTENING" ? "Listening" : "Reading"} · {test.totalQuestions} questions ·{" "}
          {test.timerDuration} min window
        </p>
      </div>

      <Progress value={progress} className="h-1.5" aria-hidden />

      <Card className="overflow-hidden border-border shadow-[var(--shadow-card)]">
        <CardHeader className="space-y-3 border-b border-border/60 bg-muted/15 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="font-portal-display text-xl">{active.title}</CardTitle>
              <CardDescription className="text-xs uppercase tracking-wider">
                Step {step + 1} of {stepsToShow.length}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {active.body.map((line) => (
              <li key={line} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            {step < stepsToShow.length - 1 ? (
              <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={onBegin} className="gap-2 shadow-sm">
                Start test
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Prefer less motion? Your system&apos;s reduced-motion setting is respected for this flow.
      </p>
    </section>
  );
}
