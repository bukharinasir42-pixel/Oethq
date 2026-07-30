"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InlineLoader } from "@/components/loaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import type { PastPaperSummaryDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type PastPaperPublishControlsProps = {
  pastPaper: PastPaperSummaryDto;
  token: string;
  layout?: "header" | "panel";
  onPublishedChange?: (pastPaper: PastPaperSummaryDto) => void;
};

export function PastPaperPublishControls({
  pastPaper,
  token,
  layout = "header",
  onPublishedChange
}: PastPaperPublishControlsProps) {
  const [isPublished, setIsPublished] = useState(pastPaper.isPublished ?? false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setIsPublished(pastPaper.isPublished ?? false);
  }, [pastPaper.id, pastPaper.isPublished]);

  const updatePublished = async (next: boolean) => {
    setUpdating(true);
    try {
      const response = await apiFetch<PastPaperSummaryDto>(`/past-papers/${pastPaper.id}/publish`, {
        method: "PUT",
        token,
        body: { isPublished: next }
      });
      setIsPublished(response.isPublished);
      onPublishedChange?.(response);
      toast.success(
        response.isPublished ? `${pastPaper.title} published` : `${pastPaper.title} moved to draft`
      );
    } catch (caughtError: unknown) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to update publish status");
    } finally {
      setUpdating(false);
    }
  };

  if (layout === "header") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isPublished ? "default" : "outline"}>{isPublished ? "Published" : "Draft"}</Badge>
        <Switch
          id={`publish-past-paper-${pastPaper.id}`}
          checked={isPublished}
          disabled={updating}
          onCheckedChange={(checked) => void updatePublished(checked)}
          aria-label={`${pastPaper.title} published`}
        />
        {!isPublished ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 cursor-pointer"
            disabled={updating}
            onClick={() => void updatePublished(true)}
          >
            {updating ? <InlineLoader label="Publishing" size="sm" /> : "Publish"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Badge variant={isPublished ? "default" : "outline"}>{isPublished ? "Published" : "Draft"}</Badge>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`publish-past-paper-${pastPaper.id}`}
            checked={isPublished}
            disabled={updating}
            onCheckedChange={(checked) => void updatePublished(checked)}
          />
          <Label htmlFor={`publish-past-paper-${pastPaper.id}`} className="text-sm text-muted-foreground">
            Published
          </Label>
        </div>
        {!isPublished ? (
          <Button
            type="button"
            size="sm"
            className={cn("cursor-pointer")}
            disabled={updating}
            onClick={() => void updatePublished(true)}
          >
            {updating ? <InlineLoader label="Publishing" size="sm" /> : "Publish past paper"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
