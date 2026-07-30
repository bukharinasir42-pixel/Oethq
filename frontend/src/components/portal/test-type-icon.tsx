import { BookOpen, Headphones, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TestType = "READING" | "LISTENING";

const config: Record<TestType, { icon: LucideIcon; label: string; className: string }> = {
  READING: {
    icon: BookOpen,
    label: "Reading",
    className: "bg-primary/12 text-primary ring-primary/20"
  },
  LISTENING: {
    icon: Headphones,
    label: "Listening",
    className: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
  }
};

const sizeStyles = {
  xs: { box: "", icon: "h-3.5 w-3.5", bare: true },
  sm: { box: "h-6 w-6", icon: "h-3.5 w-3.5", bare: false },
  md: { box: "h-8 w-8", icon: "h-4 w-4", bare: false }
} as const;

type TestTypeIconProps = {
  type: TestType;
  size?: keyof typeof sizeStyles;
  showLabel?: boolean;
  className?: string;
};

export function TestTypeIcon({ type, size = "sm", showLabel = false, className }: TestTypeIconProps) {
  const { icon: Icon, label, className: tone } = config[type];
  const { box, icon: iconSize, bare } = sizeStyles[size];

  if (bare) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)} title={label}>
        <Icon className={iconSize} aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-md ring-1", box, tone)}>
        <Icon className={iconSize} aria-hidden />
      </span>
      {showLabel ? <span className="text-sm font-medium">{label}</span> : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}
