"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Play, TrendingUp } from "lucide-react";
import { CohortClasses } from "@/components/cohort/cohort-classes";
import { OwnedCoursesSection } from "@/components/portal/owned-courses";
import { TodaysReadingPassageCard } from "@/components/portal/todays-reading-passage-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  findNextOpenTask,
  getOpenItemCount,
  isDayPracticeComplete
} from "@/lib/portal-utils";
import type { DashboardDto, TaskItem } from "@/lib/types";

type PortalHomeDashboardProps = {
  profileName?: string;
  dashboard: DashboardDto | null;
  tasks: TaskItem[];
  completedTestIds: ReadonlySet<string>;
};

function DayProgressRing({ current, total }: { current: number; total: number }) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((current / safeTotal) * 100));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative h-[5.5rem] w-[5.5rem] shrink-0 sm:h-28 sm:w-28">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={radius} className="fill-none stroke-white/15" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="fill-none stroke-[#7CC4FF] transition-all duration-700 ease-out"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="font-portal-display text-lg font-bold tabular-nums leading-none text-white sm:text-xl">
          {current}
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9EC4E8]">
          of {total} days
        </span>
      </div>
    </div>
  );
}

function ReadinessRing({ percent }: { percent: number }) {
  const safe = Math.min(100, Math.max(0, percent));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={radius} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="fill-none stroke-primary transition-all duration-700 ease-out"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-portal-display text-xl font-bold tabular-nums text-[hsl(var(--primary-deep))]">
          {safe}%
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">ready</span>
      </div>
    </div>
  );
}

export function PortalHomeDashboard({
  profileName,
  dashboard,
  tasks,
  completedTestIds
}: PortalHomeDashboardProps) {
  const sorted = useMemo(() => [...tasks].sort((a, b) => a.dayNumber - b.dayNumber), [tasks]);
  const defaultDayNumber = useMemo(
    () => findNextOpenTask(tasks)?.dayNumber ?? sorted[0]?.dayNumber ?? null,
    [tasks, sorted]
  );
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(defaultDayNumber);

  useEffect(() => {
    if (selectedDayNumber != null && sorted.some((task) => task.dayNumber === selectedDayNumber)) {
      return;
    }
    setSelectedDayNumber(defaultDayNumber);
  }, [defaultDayNumber, selectedDayNumber, sorted]);

  const focusTask = sorted.find((task) => task.dayNumber === selectedDayNumber) ?? null;
  const recommendedDay = defaultDayNumber;
  const completedDays = sorted.filter((task) => isDayPracticeComplete(task, completedTestIds)).length;
  const totalDays = sorted.length;
  const currentDayNumber = focusTask?.dayNumber ?? null;
  const openItemCount = focusTask ? getOpenItemCount(focusTask) : 0;
  const firstName = profileName?.trim().split(/\s+/)[0];

  const readingAvg = dashboard?.breakdown.readingAverage ?? 0;
  const listeningAvg = dashboard?.breakdown.listeningAverage ?? 0;
  const passProbability = dashboard?.summary.passProbability ?? 0;
  const averageScore = dashboard?.summary.averageScore ?? 0;
  const retainedResults = dashboard?.summary.retainedResults ?? 0;
  const totalAttempts = dashboard?.summary.totalAttempts ?? 0;
  const nasirBand = dashboard?.summary.nasirBand;

  return (
    <div className="portal-home-dashboard space-y-6">
      <section className="navy-panel relative overflow-hidden rounded-[18px] px-5 py-6 sm:px-7 sm:py-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(520px 240px at 85% 0%, rgba(124,196,255,.22), transparent 55%), radial-gradient(380px 200px at 10% 100%, rgba(63,160,240,.18), transparent 50%)"
          }}
          aria-hidden
        />
        <div className="relative z-[1] flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center">
            {totalDays > 0 ? (
              <DayProgressRing current={currentDayNumber || completedDays || 0} total={totalDays} />
            ) : null}
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7CC4FF]">
                {focusTask
                  ? `${recommendedDay === focusTask.dayNumber ? "Today's focus" : "Day focus"} — Day ${focusTask.dayNumber}`
                  : firstName
                    ? `Welcome back, ${firstName}`
                    : "Welcome back"}
              </p>
              <h2 className="font-portal-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {focusTask?.title?.trim() ||
                  (focusTask ? `Day ${focusTask.dayNumber} study session` : "Your study overview")}
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-[#B9CEE8]">
                {focusTask?.summary?.trim() ||
                  "Track readiness, continue open tasks, and jump into today’s practice from your plan."}
              </p>
              {focusTask ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-[#D7E8FA]">
                    {openItemCount} open item{openItemCount === 1 ? "" : "s"}
                  </span>
                  {focusTask.readingTest && !focusTask.readingLocked ? (
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-[#D7E8FA]">
                      Reading linked
                    </span>
                  ) : null}
                  {focusTask.listeningTest && !focusTask.listeningLocked ? (
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-[#D7E8FA]">
                      Listening linked
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Button
              type="button"
              className="h-11 cursor-pointer rounded-full bg-white px-6 font-semibold text-[#0C2C55] hover:bg-[#EAF2FC]"
              onClick={() => {
                if (focusTask) {
                  document.getElementById("dashboard-day-content")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }
              }}
              disabled={!focusTask}
            >
              <Play className="mr-2 h-4 w-4 fill-current" aria-hidden />
              Continue today&apos;s session
            </Button>
            {focusTask ? (
              <p className="text-center text-xs text-[#9EC4E8] sm:text-right">
                Showing Day {focusTask.dayNumber} content below
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="portal-stat-grid">
        <Card className="portal-card equal-card">
          <CardContent className="flex h-full flex-col gap-1 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Days completed</p>
            <p className="font-portal-display text-2xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">
              {completedDays}
              <span className="text-base font-medium text-muted-foreground"> / {totalDays || 0}</span>
            </p>
            <p className="mt-auto text-xs text-[hsl(var(--success))]">
              {totalDays > 0 ? (completedDays > 0 ? "Progress saved" : "Start with Day 1") : "Plan loading"}
            </p>
          </CardContent>
        </Card>
        <Card className="portal-card equal-card">
          <CardContent className="flex h-full flex-col gap-1 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Tests submitted</p>
            <p className="font-portal-display text-2xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">
              {retainedResults}
              <span className="text-base font-medium text-muted-foreground"> retained</span>
            </p>
            <p className="mt-auto text-xs text-muted-foreground">
              {totalAttempts} attempt{totalAttempts === 1 ? "" : "s"} · R {readingAvg} · L {listeningAvg}
            </p>
          </CardContent>
        </Card>
        <Card className="portal-card equal-card">
          <CardContent className="flex h-full flex-col gap-1 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Average score</p>
            <p className="font-portal-display text-2xl font-semibold tabular-nums text-[hsl(var(--primary-deep))]">
              {averageScore}
            </p>
            <p className="mt-auto text-xs text-muted-foreground">
              NASIR band: {nasirBand || "No result yet"}
            </p>
          </CardContent>
        </Card>
        <Card className="portal-card equal-card">
          <CardContent className="flex h-full flex-col gap-1 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Pass probability</p>
            <p className="font-portal-display text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {passProbability}%
            </p>
            <p className="mt-auto text-xs text-muted-foreground">Based on retained results</p>
          </CardContent>
        </Card>
      </section>

      <OwnedCoursesSection />

      {/* Journey days + lecture/core-skill videos = the live cohort classes (same component). */}
      <div id="dashboard-day-content" className="scroll-mt-6">
        <CohortClasses variant="dashboard" />
      </div>

      {focusTask ? <TodaysReadingPassageCard task={focusTask} /> : null}

      <section className="flex flex-col gap-5 rounded-[16px] border border-border bg-card px-5 py-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:px-6">
        <ReadinessRing percent={passProbability} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="font-portal-display text-lg font-semibold text-[hsl(var(--primary-deep))]">
              Exam readiness
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pass probability is calculated from your retained reading and listening results. Keep completing timed
            practice to improve this score.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              <span className="font-semibold tabular-nums text-foreground">{readingAvg}</span>
              <span className="text-muted-foreground"> avg reading</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums text-foreground">{listeningAvg}</span>
              <span className="text-muted-foreground"> avg listening</span>
            </span>
            <span>
              <span className="font-semibold text-foreground">{nasirBand || "—"}</span>
              <span className="text-muted-foreground"> NASIR band</span>
            </span>
          </div>
        </div>
        <Button asChild variant="outline" className="h-10 shrink-0 cursor-pointer">
          <Link href="/portal/dashboard" className="inline-flex items-center">
            View full progress
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
