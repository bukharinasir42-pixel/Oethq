import { cn } from "@/lib/utils";

const BANDS = ["CRITICAL", "AT_RISK", "DEVELOPING", "COMPETITIVE", "STRONG", "EXCELLENT"] as const;

type NasirBandScaleProps = {
  activeBand?: string | null;
  className?: string;
};

export function NasirBandScale({ activeBand, className }: NasirBandScaleProps) {
  const normalized = activeBand?.toUpperCase().replace(/\s+/g, "_");

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">NASIR band scale</p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {BANDS.map((band) => {
          const isActive = normalized === band;
          return (
            <div
              key={band}
              className={cn(
                "rounded-md border px-1.5 py-2 text-center text-[9px] font-semibold uppercase leading-tight tracking-wide",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-muted/30 text-muted-foreground"
              )}
            >
              {band.replace("_", " ")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
