"use client";

import { cn } from "@/lib/utils";

export type UploadProgressRingProps = {
  value: number;
  label?: string;
  size?: number;
  className?: string;
};

export function UploadProgressRing({ value, label, size = 44, className }: UploadProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted-foreground/20"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-primary transition-[stroke-dashoffset] duration-150"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-foreground">
          {clamped}%
        </span>
      </div>
      {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
    </div>
  );
}
