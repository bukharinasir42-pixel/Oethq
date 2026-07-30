import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestSummaryDto } from "@/lib/types";
import { formatDuration } from "@/components/exam/exam-utils";
import { TestTypeIcon } from "./test-type-icon";

type ResumeExamBannerProps = {
  attempt: {
    test: TestSummaryDto;
    timeRemainingSeconds?: number | null;
  };
};

export function ResumeExamBanner({ attempt }: ResumeExamBannerProps) {
  const type = attempt.test.type as "READING" | "LISTENING";

  return (
    <div
      className="flex flex-col gap-4 rounded-[16px] border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] px-5 py-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-[11px] bg-[hsl(var(--warning)/0.15)] p-2 text-[hsl(var(--warning))]">
          <Clock3 className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Exam in progress</p>
          <p className="text-sm text-muted-foreground">
            <TestTypeIcon type={type} size="sm" className="mr-1.5 inline-flex align-middle" />
            {attempt.test.title} · {formatDuration(attempt.timeRemainingSeconds ?? 0)} left
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0 cursor-pointer">
        <Link href={`/portal/tests/${attempt.test.id}`}>Resume now</Link>
      </Button>
    </div>
  );
}
