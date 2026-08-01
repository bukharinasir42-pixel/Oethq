"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/lib/types";
import { getOpenItemCount, getTaskDayState } from "@/lib/portal-utils";
import { TaskDayStateBadge } from "./task-day-state-badge";

type TaskDayTimelineProps = {
  tasks: TaskItem[];
  className?: string;
};

export function TaskDayTimeline({ tasks, className }: TaskDayTimelineProps) {
  const sorted = [...tasks].sort((a, b) => a.dayNumber - b.dayNumber);

  if (sorted.length === 0) return null;

  return (
    <div className={cn("portal-inset-panel overflow-hidden p-0", className)}>
      <p className="border-b border-border/50 px-5 py-3 text-sm font-semibold text-foreground">40-day plan overview</p>
      <div className="thin-scrollbar flex gap-2 overflow-x-auto px-4 py-4">
        {sorted.map((task) => {
          const state = getTaskDayState(task);
          const open = getOpenItemCount(task);
          return (
            <Link
              key={task.id}
              href="/portal/tasks"
              className={cn(
                "flex min-w-[5.5rem] shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-colors duration-200",
                state === "open" && "border-primary/40 bg-primary/[0.07] hover:bg-primary/10",
                state === "coming-soon" && "border-dashed border-border/70 bg-muted/20 opacity-70",
              )}
            >
              <span className="font-portal-display text-lg font-bold tabular-nums text-foreground">{task.dayNumber}</span>
              <TaskDayStateBadge state={state} className="text-[10px]" />
              {open > 0 ? (
                <span className="text-[10px] text-muted-foreground">{open} open</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
