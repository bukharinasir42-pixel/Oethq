"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { RetainedResultDto } from "@/lib/types";

type ExamResultPanelProps = {
  result: RetainedResultDto;
};

export function ExamResultPanel({ result }: ExamResultPanelProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-primary/20 bg-primary/5 p-6">
      <p className="font-portal-display text-lg font-semibold text-foreground">Result retained</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Score {result.score} · {result.bandLabel} · Pass probability {result.passProbability}%
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Part A", value: result.partAScore ?? 0 },
          { label: "Part B", value: result.partBScore ?? 0 },
          { label: "Part C", value: result.partCScore ?? 0 }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border/60 bg-card/80 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/portal/results">View results</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/portal/tasks">Back to Task Management</Link>
        </Button>
      </div>
    </div>
  );
}
