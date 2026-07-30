"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import type { RetainedResultDto } from "@/lib/types";

const chartConfig = {
  score: { label: "Score" },
  reading: {
    label: "Reading",
    color: "hsl(199 89% 48%)"
  },
  listening: {
    label: "Listening",
    color: "hsl(160 84% 39%)"
  }
} satisfies ChartConfig;

function truncateLabel(title: string, max = 22) {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

type RetainedScoresChartProps = {
  results: RetainedResultDto[];
  className?: string;
};

export function RetainedScoresChart({ results, className }: RetainedScoresChartProps) {
  const { data, average, domainMax } = useMemo(() => {
    const rows = results.map((result) => ({
      name: truncateLabel(result.test.title),
      fullName: result.test.title,
      score: result.score,
      type: result.test.type,
      band: result.bandLabel,
      fill: result.test.type === "READING" ? "var(--color-reading)" : "var(--color-listening)"
    }));
    const scores = rows.map((r) => r.score);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const peak = scores.length ? Math.max(...scores) : 100;
    const max = Math.max(50, Math.ceil(peak * 1.15));
    return { data: rows, average: avg, domainMax: max };
  }, [results]);

  if (data.length === 0) return null;

  const chartHeight = Math.max(160, data.length * 52 + 48);

  return (
    <ChartContainer config={chartConfig} className={className} style={{ height: chartHeight }}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
        barCategoryGap="18%"
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis
          type="number"
          domain={[0, domainMax]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) => String(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={108}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{item.payload.fullName}</span>
                  <span className="text-muted-foreground">
                    {item.payload.type === "READING" ? "Reading" : "Listening"} · {item.payload.band}
                  </span>
                  <span className="tabular-nums">Score: {value}</span>
                </div>
              )}
            />
          }
        />
        {average > 0 ? (
          <ReferenceLine
            x={average}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            label={{
              value: `Avg ${average}`,
              position: "insideTopRight",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 11
            }}
          />
        ) : null}
        <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={32} background={{ fill: "hsl(var(--muted) / 0.25)", radius: 6 }}>
          {data.map((entry) => (
            <Cell key={entry.fullName} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
