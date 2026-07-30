import { cn } from "@/lib/utils";

export type LoadingPulseStripProps = {
  className?: string;
};

/**
 * Thin top-of-panel pulse — use under headers or above skeleton blocks.
 */
export function LoadingPulseStrip({ className }: LoadingPulseStripProps) {
  return (
    <div
      className={cn(
        "relative h-0.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-primary/75 to-transparent animate-oet-loader-shimmer" />
    </div>
  );
}
