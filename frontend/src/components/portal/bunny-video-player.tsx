"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";

type BunnyEmbedResponse = {
  provider: string;
  embedUrl: string;
  expiresAt: string;
};

type BunnyVideoPlayerProps = {
  dayNumber: number;
  slot: "lecture" | "coreskill";
  title?: string;
  poster?: string | null;
};

export function BunnyVideoPlayer({ dayNumber, slot, title }: BunnyVideoPlayerProps) {
  const { token } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEmbedUrl() {
      setLoading(true);
      setError(false);
      setEmbedUrl(null);

      try {
        const response = await apiFetch<BunnyEmbedResponse>(
          `/tasks/${dayNumber}/embed?slot=${slot}`,
          { token }
        );
        if (!cancelled) {
          setEmbedUrl(response.embedUrl);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEmbedUrl();

    return () => {
      cancelled = true;
    };
  }, [dayNumber, slot, token]);

  const containerClassName = "overflow-hidden rounded-lg border border-border/60 bg-black/5 shadow-inner";

  if (loading) {
    return (
      <div className={containerClassName}>
        <p className="aspect-video w-full content-center bg-black/5 px-4 text-center text-xs text-muted-foreground">
          Loading secure video…
        </p>
      </div>
    );
  }

  if (error || !embedUrl) {
    return (
      <div className={containerClassName}>
        <p className="aspect-video w-full content-center bg-black/5 px-4 text-center text-xs text-muted-foreground">
          Could not load this video. Refresh and try again.
        </p>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <iframe
        src={embedUrl}
        className="aspect-video w-full border-0"
        title={title || "Lesson video"}
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
