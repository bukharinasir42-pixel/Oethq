import { cn } from "@/lib/utils";

type PlanProgressRingProps = {
  percent: number;
  label: string;
  sublabel?: string;
  className?: string;
};

export function PlanProgressRing({ percent, label, sublabel, className }: PlanProgressRingProps) {
  const safe = Math.min(100, Math.max(0, percent));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative h-28 w-28 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r={radius} className="fill-none stroke-muted/50" strokeWidth="8" />
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-portal-display text-2xl font-bold tabular-nums text-foreground">{safe}%</span>
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-portal-display text-lg font-semibold text-foreground">{label}</p>
        {sublabel ? <p className="text-sm text-muted-foreground">{sublabel}</p> : null}
      </div>
    </div>
  );
}
