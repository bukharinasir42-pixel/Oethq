"use client";

import Link from "next/link";
import type { PastPaperSummaryDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PastPaperPublishControls } from "./past-paper-publish-controls";
import { cn } from "@/lib/utils";

type PastPaperPublicationPanelProps = {
  pastPaper: PastPaperSummaryDto;
  pastPaperId: string;
  currentTestId?: string;
  token: string;
  onPastPaperChange: (pastPaper: PastPaperSummaryDto) => void;
};

export function PastPaperPublicationPanel({
  pastPaper,
  pastPaperId,
  currentTestId,
  token,
  onPastPaperChange
}: PastPaperPublicationPanelProps) {
  return (
    <div className="surface-panel-subtle space-y-3 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{pastPaper.title}</p>
        <p className="text-xs text-muted-foreground">
          Publish the full past paper when both listening and reading content are ready.
        </p>
      </div>

      <PastPaperPublishControls
        pastPaper={pastPaper}
        token={token}
        layout="panel"
        onPublishedChange={onPastPaperChange}
      />

      <div className="flex flex-wrap gap-2">
        {[pastPaper.listeningTest, pastPaper.readingTest].map((test) => {
          const isActive = currentTestId === test.id;
          const typeLabel = test.type === "LISTENING" ? "Listening" : "Reading";

          return (
            <Button
              key={test.id}
              asChild
              size="sm"
              variant={isActive ? "default" : "outline"}
              className={cn("cursor-pointer", isActive && "pointer-events-none")}
            >
              <Link href={`/admin/past-paper/${pastPaperId}/test/${test.id}`}>Edit {typeLabel.toLowerCase()}</Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
