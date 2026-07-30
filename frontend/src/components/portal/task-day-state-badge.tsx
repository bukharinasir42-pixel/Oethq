import { Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskDayState } from "@/lib/portal-utils";
import { cn } from "@/lib/utils";

const styles: Record<TaskDayState, { label: string; className: string; icon: typeof Lock }> = {
  locked: {
    label: "Locked",
    className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    icon: Lock
  },
  open: {
    label: "Open",
    className: "border-primary/35 bg-primary/10 text-primary",
    icon: Sparkles
  }
};

type TaskDayStateBadgeProps = {
  state: TaskDayState;
  className?: string;
};

export function TaskDayStateBadge({ state, className }: TaskDayStateBadgeProps) {
  const { label, className: tone, icon: Icon } = styles[state];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", tone, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
