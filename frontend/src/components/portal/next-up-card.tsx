import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaskItem } from "@/lib/types";
import { formatTestDurationMinutes } from "@/lib/portal-utils";
import { TestTypeIcon } from "./test-type-icon";

type NextUpCardProps = {
  task: TaskItem;
};

export function NextUpCard({ task }: NextUpCardProps) {
  return (
    <Card className="portal-card overflow-hidden border-border">
      <div className="navy-panel px-6 py-5">
        <div className="flex items-center gap-2 text-[#7CC4FF]">
          <CalendarDays className="h-4 w-4" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Your next step</p>
        </div>
        <h3 className="mt-2 font-portal-display text-xl font-semibold text-white sm:text-2xl">
          Day {task.dayNumber}: {task.title}
        </h3>
        <p className="mt-1.5 text-sm text-[#B9CEE8]">
          {task.summary || "Open today’s materials and complete your practice tests."}
        </p>
      </div>
      <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:flex-wrap">
        {task.readingTest && !task.readingLocked ? (
          <Button asChild className="h-11 flex-1 cursor-pointer sm:min-w-[150px] sm:flex-none">
            <Link href={`/portal/tests/${task.readingTest.id}`} className="inline-flex items-center">
              <TestTypeIcon type="READING" size="xs" className="mr-1.5" />
              Start Reading
              <span className="ml-2 text-xs opacity-80">~{formatTestDurationMinutes(task.readingTest)} min</span>
            </Link>
          </Button>
        ) : null}
        {task.listeningTest && !task.listeningLocked ? (
          <Button asChild variant="outline" className="h-11 flex-1 cursor-pointer sm:min-w-[150px] sm:flex-none">
            <Link href={`/portal/tests/${task.listeningTest.id}`} className="inline-flex items-center">
              <TestTypeIcon type="LISTENING" size="xs" className="mr-1.5" />
              Start Listening
              <span className="ml-2 text-xs opacity-80">~{formatTestDurationMinutes(task.listeningTest)} min</span>
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost" className="h-11 cursor-pointer sm:ml-auto">
          <Link href="/portal/tasks">
            Study plan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
