import { cn } from "@/lib/utils";

export type InlineLoaderProps = {
  /** Screen-reader label */
  label?: string;
  className?: string;
  size?: "sm" | "md";
};

/**
 * Compact loader for buttons, table rows, and inline UI — same blue bar language as route loading.
 */
export function InlineLoader({ label = "Loading", className, size = "sm" }: InlineLoaderProps) {
  const bar = size === "sm" ? "h-3 w-0.5" : "h-4 w-1";

  return (
    <span
      className={cn("inline-flex items-end justify-center gap-0.5", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className={cn(
          "origin-bottom rounded-full bg-primary animate-oet-loader-bars",
          bar
        )}
      />
      <span
        className={cn(
          "origin-bottom rounded-full bg-primary animate-oet-loader-bars [animation-delay:150ms]",
          bar
        )}
      />
      <span
        className={cn(
          "origin-bottom rounded-full bg-primary animate-oet-loader-bars [animation-delay:300ms]",
          bar
        )}
      />
    </span>
  );
}
