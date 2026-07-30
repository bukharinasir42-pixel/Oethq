"use client";

import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { apiFetch } from "@/lib/api";
import type { HowToIntroductionDto } from "@/lib/types";

type HowToIntroductionPanelProps = {
  intro: HowToIntroductionDto | null;
  loading: boolean;
  error: string | null;
};

function resolvePlaybackUrl(intro: HowToIntroductionDto | null) {
  if (!intro) return null;
  return (
    intro.videoAsset?.signedUrl?.trim() ||
    intro.videoUrl?.trim() ||
    intro.videoAsset?.publicUrl?.trim() ||
    null
  );
}

function resolveThumbnailUrl(intro: HowToIntroductionDto | null) {
  if (!intro) return null;
  return (
    intro.thumbnailAsset?.signedUrl?.trim() ||
    intro.thumbnailUrl?.trim() ||
    intro.thumbnailAsset?.publicUrl?.trim() ||
    null
  );
}

export function HowToIntroductionPanel({ intro, loading, error }: HowToIntroductionPanelProps) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const thumbnailUrl = resolveThumbnailUrl(intro);

  useEffect(() => {
    setPlaybackUrl(resolvePlaybackUrl(intro));

    const assetId = intro?.videoAssetId;
    if (!assetId) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch<{ signedUrl?: string | null }>(`/storage/${assetId}/signed-url`);
        const freshUrl = response.signedUrl?.trim();
        if (!cancelled && freshUrl) {
          setPlaybackUrl(freshUrl);
        }
      } catch {
        // Keep the URL from the introduction payload when refresh fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [intro]);

  if (loading) {
    return <WorkspaceLoadingState title="Loading introduction video..." layout="editor" />;
  }

  return (
    <Card className="w-full border-border shadow-[var(--shadow-card)]">
      <CardHeader className="text-center sm:text-left">
        <CardTitle className="flex items-center justify-center gap-2 text-lg sm:justify-start">
          <Video className="h-5 w-5 text-primary" aria-hidden />
          {intro?.title?.trim() || "Introduction (How to use)"}
        </CardTitle>
        <CardDescription className="mx-auto max-w-2xl sm:mx-0">
          Watch this short guide before you start your daily study plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {error ? (
          <div className="w-full">
            <EmptyState title="Unable to load introduction" description={error} />
          </div>
        ) : playbackUrl ? (
          <div className="w-full">
            <div className="overflow-hidden rounded-[16px] border border-border bg-[#0C2C55] shadow-[var(--shadow-card)]">
              <div className="relative aspect-video w-full bg-[linear-gradient(140deg,#134D93_0%,#0C2C55_100%)]">
                <video
                  className="oet-video-player absolute inset-0 h-full w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                  poster={thumbnailUrl || undefined}
                  src={playbackUrl}
                >
                  <track kind="captions" />
                </video>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Use the player controls to play, pause, or adjust volume.
            </p>
          </div>
        ) : (
          <div className="w-full">
            <EmptyState
              title="Introduction video coming soon"
              description="Your coach has not published the how-to video yet. Check back later and continue with your study plan."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
