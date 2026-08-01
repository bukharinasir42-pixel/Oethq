"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Layers,
  PencilLine,
  Radio,
  Search,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { TaskBuilderItem } from "@/lib/types";
import { formatTaskDayTitle } from "@/lib/task-day-utils";
import { cn } from "@/lib/utils";

type TaskControlDeckProps = {
  mode?: "admin" | "candidate";
  taskCount: number;
  visibleCount: number;
  publishedCount: number;
  configuredCount: number;
  unsavedCount: number;
  openDayCount?: number;
  lockedDayCount?: number;
  query: string;
  onQueryChange: (value: string) => void;
  pageIndex: number;
  totalPages: number;
  pageStart: number;
  onPagePrev: () => void;
  onPageNext: () => void;
  pagedTasks: TaskBuilderItem[];
  selectedDayNumber: number | null;
  onSelectDay: (dayNumber: number) => void;
  dirtyDays: number[];
  isTaskConfigured: (task: TaskBuilderItem) => boolean;
  isDayOpen?: (task: TaskBuilderItem) => boolean;
  /** Candidate: day has retained Reading + Listening results */
  isDayComplete?: (task: TaskBuilderItem) => boolean;
};

export function TaskControlDeck({
  mode = "admin",
  taskCount,
  visibleCount,
  publishedCount,
  configuredCount,
  unsavedCount,
  openDayCount = 0,
  lockedDayCount = 0,
  query,
  onQueryChange,
  pageIndex,
  totalPages,
  pageStart,
  onPagePrev,
  onPageNext,
  pagedTasks,
  selectedDayNumber,
  onSelectDay,
  dirtyDays,
  isTaskConfigured,
  isDayOpen,
  isDayComplete
}: TaskControlDeckProps) {
  const isCandidate = mode === "candidate";
  const rangeEndInclusive = pageStart + pagedTasks.length;
  const rangeLabel =
    visibleCount === 0
      ? "No days match"
      : pagedTasks.length === 0
        ? "Nothing on this page"
        : `${pageStart + 1}–${rangeEndInclusive} of ${visibleCount}`;

  return (
    <div
      className={cn(
        "flex w-full flex-col rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]"
      )}
    >
      <div className="shrink-0 border-b border-border bg-muted/50 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="editorial-kicker mb-2 text-[10px]">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {isCandidate ? "Study plan" : "Plan runway"}
            </p>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[hsl(var(--primary-deep))] sm:text-xl">
              Day picker
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {isCandidate
                ? "Select a day to view lecture, core skills, article, and exams."
                : "Select a row to load the editor. Search only changes this list."}
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3 text-primary" aria-hidden />
                <span className="font-semibold text-foreground">{taskCount}</span> days
              </span>
              {isCandidate ? (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Radio className="h-3 w-3 text-primary" aria-hidden />
                    <span className="font-semibold text-foreground">{openDayCount}</span> open
                  </span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1">
                    <CircleDashed className="h-3 w-3 text-muted-foreground" aria-hidden />
                    <span className="font-semibold text-foreground">{lockedDayCount}</span> coming soon
                  </span>
                </>
              ) : (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Radio className="h-3 w-3 text-primary" aria-hidden />
                    <span className="font-semibold text-foreground">{publishedCount}</span> live
                  </span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-primary" aria-hidden />
                    <span className="font-semibold text-foreground">{configuredCount}</span> ready
                  </span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1">
                    <PencilLine className="h-3 w-3 text-[hsl(var(--warning))]" aria-hidden />
                    <span className="font-semibold text-foreground">{unsavedCount}</span> unsaved
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={
              isCandidate ? "Search day, lecture, core skills…" : "Search day, title, lecture, core skills…"
            }
            className="h-10 border-border/70 bg-background/85 pl-9 pr-10 text-sm shadow-inner"
            aria-label="Filter days by search"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Natural height with page scroll; cap list on narrow viewports so the editor stays closer */}
      <div className="thin-scrollbar max-h-[min(70vh,28rem)] overflow-y-auto overflow-x-hidden overscroll-contain sm:max-h-[min(75vh,34rem)] lg:max-h-none lg:overflow-visible">
        <div className="p-2 sm:p-3">
          {pagedTasks.length > 0 ? (
            <ul className="space-y-1">
              {pagedTasks.map((task) => {
                const isSelected = selectedDayNumber === task.dayNumber;
                const isDirty = dirtyDays.includes(task.dayNumber);
                const isConfigured = isTaskConfigured(task);
                const dayOpen = isDayOpen?.(task) ?? false;
                const dayComplete = isCandidate && (isDayComplete?.(task) ?? false);
                const title = formatTaskDayTitle(task.dayNumber);

                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onSelectDay(task.dayNumber)}
                      aria-label={
                        isCandidate
                          ? `Day ${task.dayNumber}, ${dayComplete ? "done" : dayOpen ? "open" : "lecture coming soon"}`
                          : `Day ${task.dayNumber}, ${task.isPublished ? "published" : "draft"}, ${isConfigured ? "content ready" : "needs content"}${isDirty ? ", unsaved changes" : ""}`
                      }
                      aria-pressed={isSelected}
                      className={cn(
                        "group flex w-full items-stretch gap-3 rounded-[11px] border px-2.5 py-2.5 text-left transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "motion-reduce:transition-none",
                        isSelected
                          ? "border-primary/40 bg-primary/[0.08] shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                          : "border-transparent bg-transparent hover:border-border hover:bg-muted/70"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border text-center",
                          isCandidate
                            ? dayComplete
                              ? "border-[hsl(var(--navy))] bg-[hsl(var(--navy))] text-white"
                              : dayOpen
                                ? "border-primary/35 bg-primary/10 text-primary"
                                : "border-border bg-muted text-muted-foreground"
                            : task.isPublished
                              ? "border-primary/35 bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground"
                        )}
                      >
                        <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
                          Day
                        </span>
                        <span className="font-display text-base font-bold tabular-nums leading-none">
                          {String(task.dayNumber).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="truncate text-sm font-medium text-foreground">{title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {isCandidate ? (
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                dayComplete
                                  ? "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]"
                                  : dayOpen
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground"
                              )}
                            >
                              {dayComplete ? "Done" : dayOpen ? "Open" : "Coming soon"}
                            </span>
                          ) : (
                            <>
                              <span
                                className={cn(
                                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  task.isPublished
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {task.isPublished ? "Live" : "Draft"}
                              </span>
                              {isConfigured ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                                  Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                                  <CircleDashed className="h-3 w-3" aria-hidden />
                                  Incomplete
                                </span>
                              )}
                              {isDirty ? (
                                <span className="rounded bg-[hsl(var(--warning-bg))] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[hsl(var(--warning))]">
                                  Edited
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="No matching days"
              description="Clear search to see all days in the plan."
            />
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/50 bg-muted/20 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{rangeLabel}</span>
            {taskCount ? <span> · {taskCount} total</span> : null}
          </p>
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={onPagePrev}
              disabled={pageIndex === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[5.5rem] text-center font-mono text-[11px] tabular-nums text-muted-foreground">
              {pageIndex + 1}/{totalPages}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={onPageNext}
              disabled={pageIndex >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
