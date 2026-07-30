import { cn } from "@/lib/utils";

export type RouteLoadingScreenProps = {
  /** Shown as the main header title */
  title?: string;
  /** Shown under the title, e.g. route context */
  subtitle?: string;
  className?: string;
  progressLabel?: string;
  progressValueLabel?: string;
  footerText?: string;
};

/**
 * Full-viewport loading shell for Next.js `loading.tsx` and similar transitions.
 * Matches OET HQ white & blue tokens (Inter + Sora).
 */
export function RouteLoadingScreen({
  title = "Preparing your workspace",
  subtitle = "Syncing content",
  className,
  progressLabel = "Loading",
  progressValueLabel = "pending",
  footerText = "OET HQ · secure session"
}: RouteLoadingScreenProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-hidden bg-background/90 backdrop-blur-md",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div
        className="pointer-events-none absolute -left-24 -top-28 h-[22rem] w-[22rem] rounded-full hero-orb hero-orb-teal opacity-80"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-16 h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,hsl(var(--cyan)/0.18),transparent_68%)] blur-2xl"
        aria-hidden
      />

      <div className="relative z-10 mx-4 w-full max-w-md px-6">
        <div
          className={cn(
            "relative overflow-hidden rounded-[16px] border border-border bg-card p-8 shadow-[var(--shadow-card)]",
            "animate-oet-loader-fade-up opacity-0"
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-oet-loader-shimmer"
            aria-hidden
          />

          <div className="relative flex flex-col items-center gap-7 text-center">
            <span className="editorial-kicker text-[10px] tracking-[0.16em]">OET HQ</span>

            <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden>
              <div className="absolute inset-0 animate-oet-loader-orbit rounded-full border-2 border-primary/20 border-t-primary" />
              <div className="absolute inset-2 animate-oet-loader-orbit rounded-full border border-dashed border-border opacity-80 [animation-direction:reverse] [animation-duration:1.85s]" />
              <div className="flex h-10 items-end justify-center gap-1.5">
                <span className="h-6 w-1 origin-bottom rounded-full bg-primary/90 animate-oet-loader-bars" />
                <span className="h-6 w-1 origin-bottom rounded-full bg-primary/90 animate-oet-loader-bars [animation-delay:150ms]" />
                <span className="h-6 w-1 origin-bottom rounded-full bg-primary/90 animate-oet-loader-bars [animation-delay:300ms]" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-display text-xl font-semibold tracking-tight text-[hsl(var(--primary-deep))] md:text-2xl">
                {title}
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{subtitle}</p>
            </div>

            <div className="w-full space-y-2 text-[12px] leading-relaxed text-muted-foreground">
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="font-medium text-primary">{progressLabel}</span>
                <span className="tabular-nums opacity-80">{progressValueLabel}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[38%] animate-pulse rounded-full bg-[image:var(--grad)]" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
          {footerText}
        </p>
      </div>
    </div>
  );
}
