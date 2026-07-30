"use client";

import { ArrowRight, Clock3, LineChart } from "lucide-react";
import { OetBrandLogo } from "@/components/brand/oet-brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReadingTestIntroProps = {
  title?: string;
  partATimer?: number | null;
  partBCTimer?: number | null;
  totalQuestions?: number;
  onStart: () => void;
  className?: string;
};

const HOW_IT_RUNS = [
  "Part A has its own 15-minute timer. When time expires, Part A auto-submits and you cannot return to it.",
  "Parts B and C share one 45-minute timer. Use the tabs to move between Part B and C at any time.",
  "Part A uses typed or selected answers. Parts B and C use multiple choice — select one option per question.",
  "The test auto-submits when all timers expire. You can also submit early using the Submit test button."
] as const;

export function ReadingTestIntro({
  title = "Reading Test",
  partATimer = 15,
  partBCTimer = 45,
  totalQuestions = 42,
  onStart,
  className
}: ReadingTestIntroProps) {
  const partAQuestions = 20;
  const partBQuestions = 6;
  const partCQuestions = 16;
  const partBCQuestions = partBQuestions + partCQuestions;

  return (
    <div className={cn("reading-test-intro flex min-h-dvh flex-col sm:min-h-full", className)}>
      <header className="reading-test-intro__topbar shrink-0 px-4 py-3 text-white sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="inline-flex shrink-0 rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
              <OetBrandLogo href="/portal" className="w-[84px] max-h-7 sm:w-[92px] sm:max-h-8" />
            </div>
            <div className="min-w-0 border-l border-white/20 pl-3 sm:pl-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 sm:text-[11px]">
                Reading Test
              </p>
              <p className="truncate text-xs text-white/95 sm:text-sm">Occupational English Test</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle className="h-9 w-9 rounded-full border-white/25 bg-white/10 text-white shadow-none hover:border-white/40 hover:bg-white/15 hover:text-white" />
            <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-medium text-white/95 ring-1 ring-white/20">
              Not started
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 sm:py-10">
        <article className="reading-test-intro__card w-full max-w-4xl overflow-hidden rounded-2xl">
          <div className="reading-test-intro__hero px-6 py-8 text-white sm:px-8 sm:py-10">
            <div className="inline-flex rounded-xl bg-white px-4 py-2.5 shadow-sm">
              <OetBrandLogo asLink={false} className="w-[100px] max-h-9 sm:w-[110px]" />
            </div>
            <h1 className="mt-5 font-portal-display text-3xl font-semibold tracking-tight sm:text-[2rem]">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-white/85 sm:text-base">
              Full paper · Parts A, B &amp; C · {totalQuestions} questions
            </p>
          </div>

          <div className="grid gap-4 px-4 py-6 sm:grid-cols-2 sm:gap-5 sm:px-6 sm:py-7">
            <section className="reading-test-intro__part-box rounded-xl p-4 sm:p-5">
              <span className="reading-test-intro__part-badge inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Part A
              </span>
              <h2 className="reading-test-intro__part-title mt-3 font-portal-display text-lg font-semibold">
                Expeditious reading
              </h2>
              <p className="reading-test-intro__part-desc mt-2 text-sm leading-relaxed">
                Four short texts on one clinical topic. Skim and scan for specific information.
              </p>
              <p className="reading-test-intro__part-meta mt-4 flex items-center gap-1.5 text-sm font-medium">
                <Clock3 className="h-4 w-4 shrink-0" aria-hidden />
                {partATimer ?? 15} minutes · {partAQuestions} questions
              </p>
            </section>

            <section className="reading-test-intro__part-box rounded-xl p-4 sm:p-5">
              <span className="reading-test-intro__part-badge inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Parts B &amp; C
              </span>
              <h2 className="reading-test-intro__part-title mt-3 font-portal-display text-lg font-semibold">
                Careful reading — one shared {partBCTimer ?? 45}-minute timer
              </h2>
              <div className="reading-test-intro__part-desc mt-3 grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
                <p>
                  <span className="reading-test-intro__part-emphasis">Part B</span> — six workplace extracts, one
                  question each ({partBQuestions}).
                </p>
                <p>
                  <span className="reading-test-intro__part-emphasis">Part C</span> — two long texts, eight questions
                  each ({partCQuestions}).
                </p>
              </div>
              <p className="reading-test-intro__part-meta mt-4 flex items-center gap-1.5 text-sm font-medium">
                <Clock3 className="h-4 w-4 shrink-0" aria-hidden />
                {partBCTimer ?? 45} minutes · {partBCQuestions} questions — move freely between B and C
              </p>
            </section>
          </div>

          <div className="reading-test-intro__score-box mx-4 mb-6 flex gap-3 rounded-xl px-4 py-4 sm:mx-6 sm:px-5">
            <span className="reading-test-intro__score-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <LineChart className="h-4 w-4" aria-hidden />
            </span>
            <p className="reading-test-intro__score-text text-sm leading-relaxed">
              Your score is calculated using a <strong>Rasch-based equating model</strong> and reported on the{" "}
              <strong>OET 0–500 scale</strong> with grade bands (A highest through E lowest). This is a practice
              environment — results help you track readiness, not an official OET certificate.
            </p>
          </div>

          <section className="border-t border-border/60 px-4 py-6 sm:px-6 sm:py-7 dark:border-[hsl(211_28%_22%)]">
            <h3 className="reading-test-intro__section-label text-xs font-semibold uppercase tracking-[0.2em]">
              How the test runs
            </h3>
            <ol className="mt-4 space-y-3">
              {HOW_IT_RUNS.map((line, index) => (
                <li key={line} className="flex gap-3 text-sm leading-relaxed">
                  <span
                    className="reading-test-intro__step-num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="reading-test-intro__step-text">{line}</span>
                </li>
              ))}
            </ol>
          </section>

          <footer className="reading-test-intro__footer flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="reading-test-intro__footer-note max-w-xl text-xs leading-relaxed">
              Once you begin, Part A&apos;s timer starts immediately and cannot be paused. Set aside about an hour to
              work without interruption.
            </p>
            <Button
              type="button"
              size="lg"
              className="shrink-0 gap-2 rounded-xl bg-[#1e6fc4] px-6 text-base text-white shadow-sm hover:bg-[#1a63b0] dark:bg-[hsl(205_86%_56%)] dark:text-[hsl(211_75%_12%)] dark:hover:bg-[hsl(205_86%_62%)]"
              onClick={onStart}
            >
              Start Part A
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </footer>
        </article>
      </div>
    </div>
  );
}
