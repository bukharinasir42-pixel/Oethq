import { cn } from "@/lib/utils";

type TaskDayMiniRingProps = {
  dayNumber: number;
  percent: number;
  featured?: boolean;
  className?: string;
};

export function TaskDayMiniRing({ dayNumber, percent, featured, className }: TaskDayMiniRingProps) {
  const safe = Math.min(100, Math.max(0, percent));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div
      className={cn(
        "relative flex h-12 w-12 shrink-0 items-center justify-center",
        featured && "drop-shadow-[0_0_12px_hsl(var(--primary)/0.35)]",
        className
      )}
      aria-hidden
    >
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} className="fill-none stroke-border/80" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          className={cn(
            "fill-none transition-all duration-500 ease-out",
            featured ? "stroke-primary" : safe > 0 ? "stroke-primary/70" : "stroke-muted-foreground/25"
          )}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={cn(
          "relative font-portal-display text-sm font-bold tabular-nums",
          featured ? "text-primary" : "text-foreground"
        )}
      >
        {dayNumber}
      </span>
    </div>
  );
}
