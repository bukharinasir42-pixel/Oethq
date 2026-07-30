"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileText,
  Headphones,
  Lock,
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { TaskItem } from "@/lib/types";
import {
  findNextOpenTask,
  getOpenItemCount,
  getTaskActivities,
  getTaskDayProgressPercent,
  getTaskDayState,
  type TaskActivityKind
} from "@/lib/portal-utils";
import { cn } from "@/lib/utils";
import { TaskDayMiniRing } from "./task-day-mini-ring";
import { TaskDayStateBadge } from "./task-day-state-badge";
import { TestTypeIcon } from "./test-type-icon";

const activityIcons: Record<TaskActivityKind, typeof Video> = {
  lecture: Video,
  article: FileText,
  reading: BookOpen,
  listening: Headphones,
  pastPaper: FileText,
  cheatSheet: FileText
};

type ContinuePlanPanelProps = {
  tasks: TaskItem[];
  maxDays?: number;
};

export function ContinuePlanPanel({ tasks, maxDays = 4 }: ContinuePlanPanelProps) {
  const sorted = [...tasks].sort((a, b) => a.dayNumber - b.dayNumber);
  const visible = sorted.slice(0, maxDays);
  const nextTask = findNextOpenTask(tasks);
  const highlightId = nextTask?.id;

  return (
    <Card className="portal-card portal-continue-plan equal-card overflow-hidden">
      <CardHeader className="relative space-y-3 border-b border-border bg-muted/60 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Study path</p>
            <CardTitle className="font-portal-display text-xl text-[hsl(var(--primary-deep))]">Continue your plan</CardTitle>
            <CardDescription>
              {sorted.length > 0
                ? `${sorted.filter((t) => getTaskDayState(t) === "open").length} days unlocked · scroll the trail or jump in`
                : "Your schedule will appear here once days are published."}
            </CardDescription>
          </div>
          {sorted.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {sorted.slice(0, 12).map((task) => {
                const state = getTaskDayState(task);
                const isNext = task.id === highlightId;
                return (
                  <Link
                    key={task.id}
                    href="/portal/tasks"
                    title={`Day ${task.dayNumber}`}
                    className={cn(
                      "flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-all duration-200",
                      isNext && "border-primary bg-primary/15 text-primary shadow-sm",
                      !isNext && state === "open" && "border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10",
                      state === "locked" && "border-dashed border-border/60 text-muted-foreground opacity-60"
                    )}
                  >
                    {task.dayNumber}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="equal-card-body p-0">
        {visible.length > 0 ? (
          <ol className="portal-plan-timeline divide-y divide-border/40">
            {visible.map((task, index) => {
              const state = getTaskDayState(task);
              const activities = getTaskActivities(task);
              const openCount = getOpenItemCount(task);
              const progress = getTaskDayProgressPercent(task);
              const featured = task.id === highlightId;
              const exams = activities.filter((a) => a.kind === "reading" || a.kind === "listening");

              return (
                <li
                  key={task.id}
                  className={cn(
                    "portal-plan-day motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2",
                    featured && "portal-plan-day--featured"
                  )}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="portal-plan-day-rail" aria-hidden>
                    <TaskDayMiniRing dayNumber={task.dayNumber} percent={progress} featured={featured} />
                    {index < visible.length - 1 ? <span className="portal-plan-day-connector" /> : null}
                  </div>

                  <article className="portal-plan-day-body min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TaskDayStateBadge state={state} />
                      {featured ? (
                        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          Up next
                        </span>
                      ) : null}
                      {openCount > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {openCount} item{openCount === 1 ? "" : "s"} ready
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-2 font-portal-display text-lg font-semibold leading-snug text-foreground">
                      {task.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {task.summary || `Lecture, article, and OET practice for day ${task.dayNumber}.`}
                    </p>

                    {activities.length > 0 ? (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {activities.map((activity) => {
                          const Icon = activityIcons[activity.kind];
                          const locked = activity.locked;
                          const chipClass = cn(
                            "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            locked && "border-dashed border-border/70 bg-muted/25 text-muted-foreground",
                            !locked &&
                              activity.kind === "reading" &&
                              "border-primary/30 bg-primary/10 text-primary",
                            !locked &&
                              activity.kind === "listening" &&
                              "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                            !locked &&
                              activity.kind !== "reading" &&
                              activity.kind !== "listening" &&
                              "border-border/60 bg-muted/30 text-foreground hover:bg-muted/50"
                          );

                          if (locked || !activity.href) {
                            return (
                              <li key={activity.kind}>
                                <span className={chipClass}>
                                  <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                                  {activity.kind === "reading" || activity.kind === "listening" ? (
                                    <TestTypeIcon
                                      type={activity.kind === "reading" ? "READING" : "LISTENING"}
                                      size="xs"
                                    />
                                  ) : (
                                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                  )}
                                  <span className="truncate">{activity.label}</span>
                                </span>
                              </li>
                            );
                          }

                          const external = activity.href.startsWith("http");
                          return (
                            <li key={activity.kind}>
                              <Link
                                href={activity.href}
                                className={chipClass}
                                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                              >
                                {activity.kind === "reading" || activity.kind === "listening" ? (
                                  <TestTypeIcon
                                    type={activity.kind === "reading" ? "READING" : "LISTENING"}
                                    size="xs"
                                  />
                                ) : (
                                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                )}
                                <span className="truncate">{activity.label}</span>
                                {external ? <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden /> : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    {exams.some((e) => !e.locked) ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {exams.map((exam) => {
                          if (exam.locked || !exam.href) return null;
                          const isReading = exam.kind === "reading";
                          return (
                            <Button
                              key={exam.kind}
                              asChild
                              size="sm"
                              variant={isReading ? "default" : "secondary"}
                              className={cn("cursor-pointer", featured && "shadow-sm")}
                            >
                              <Link href={exam.href} className="inline-flex items-center">
                                <TestTypeIcon type={isReading ? "READING" : "LISTENING"} size="xs" className="mr-1" />
                                {isReading ? "Start Reading" : "Start Listening"}
                              </Link>
                            </Button>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="p-6">
            <EmptyState
              icon={ClipboardList}
              title="No tasks published yet"
              description="Your plan overview will appear here once a day is released to your account."
            />
          </div>
        )}

        <div className="border-t border-border/40 bg-muted/15 px-5 py-4">
          <Button asChild variant="outline" className="w-full cursor-pointer border-primary/25 hover:bg-primary/5">
            <Link href="/portal/tasks">
              Open full task management
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
