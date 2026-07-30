"use client";

import { useMemo } from "react";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const gaugeConfig = {
  probability: {
    label: "Pass probability",
    color: "hsl(var(--primary))"
  },
  track: {
    label: "Remaining",
    color: "hsl(var(--muted))"
  }
} satisfies ChartConfig;

type PassReadinessChartProps = {
  passProbability: number;
  readingAverage: number;
  listeningAverage: number;
  totalAttempts: number;
  retainedCount: number;
  className?: string;
};

export function PassReadinessChart({
  passProbability,
  readingAverage,
  listeningAverage,
  totalAttempts,
  retainedCount,
  className
}: PassReadinessChartProps) {
  const safe = Math.min(100, Math.max(0, passProbability));

  const gaugeData = useMemo(() => [{ name: "probability", value: safe }], [safe]);

  const skills = [
    { key: "reading", label: "Reading avg", value: readingAverage, color: "bg-primary" },
    { key: "listening", label: "Listening avg", value: listeningAverage, color: "bg-emerald-500" }
  ];

  const skillMax = Math.max(50, ...skills.map((s) => s.value), 1);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="relative mx-auto h-[200px] w-full max-w-[220px]">
        <ChartContainer config={gaugeConfig} className="aspect-square h-full w-full">
          <RadialBarChart
            data={gaugeData}
            startAngle={90}
            endAngle={-270}
            innerRadius="72%"
            outerRadius="100%"
            barSize={14}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={8}
              fill="var(--color-probability)"
              background={{ fill: "hsl(var(--muted) / 0.45)" }}
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-portal-display text-4xl font-bold tabular-nums text-foreground">{safe}%</span>
          <span className="text-xs font-medium text-muted-foreground">pass probability</span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skill averages</p>
        {skills.map((skill) => (
          <div key={skill.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{skill.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{skill.value || "—"}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/50">
              <div
                className={cn("h-full rounded-full transition-all duration-700 ease-out", skill.color)}
                style={{ width: `${Math.min(100, (skill.value / skillMax) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-foreground">{totalAttempts}</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Attempts</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-foreground">{retainedCount}</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Retained</p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Retakes stay in history; your latest retained score per test drives this readiness signal.
      </p>
    </div>
  );
}
