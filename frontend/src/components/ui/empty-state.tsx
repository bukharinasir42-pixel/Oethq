import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** `comfortable` adds vertical room for primary workspace placeholders (e.g. before a selection is made). */
  size?: "default" | "comfortable";
  className?: string;
  children?: React.ReactNode;
};

/** Empty lists, no results, and friendly error placeholders (Phase 3 UX). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  size = "default",
  className,
  children
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "surface-panel-dashed flex flex-col items-center justify-center gap-2 px-6 text-center",
        size === "comfortable"
          ? "min-h-[min(22rem,52vh)] gap-3 py-14 sm:py-16"
          : "py-12",
        className
      )}
      role="status"
    >
      {Icon ? (
        <Icon className="h-10 w-10 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
