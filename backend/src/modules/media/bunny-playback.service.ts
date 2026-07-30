import crypto from "crypto";
import type { AppConfig } from "../../common/app-config";
import { BadRequestException } from "../../common/http-exception";

export class BunnyNotConfiguredError extends BadRequestException {
  constructor(message = "Bunny Stream playback is not configured") {
    super(message);
    this.name = "BunnyNotConfiguredError";
  }
}

export class BunnyPlaybackService {
  constructor(private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return Boolean(this.libraryId() && this.tokenKey());
  }

  buildEmbedUrl(
    videoId: string,
    options?: { autoplay?: boolean; muted?: boolean; preload?: boolean }
  ): { url: string; expiresAt: string } {
    if (!this.isConfigured()) {
      throw new BunnyNotConfiguredError();
    }

    if (!videoId.trim()) {
      throw new BunnyNotConfiguredError("Bunny Stream video id is required");
    }

    const expires = Math.floor(Date.now() / 1000) + Number(this.config.get("BUNNY_STREAM_EMBED_TTL_SECONDS") || 3600);
    const token = crypto
      .createHash("sha256")
      .update(`${this.tokenKey()}${videoId}${expires}`)
      .digest("hex");
    const embedHost = (this.config.get("BUNNY_STREAM_EMBED_HOST")?.trim() || "https://iframe.mediadelivery.net").replace(
      /\/+$/,
      ""
    );
    const autoplay = options?.autoplay ?? false;
    const muted = options?.muted ?? false;
    const preload = options?.preload ?? true;
    let url = `${embedHost}/embed/${this.libraryId()}/${encodeURIComponent(videoId)}?token=${token}&expires=${expires}&autoplay=${autoplay}&preload=${preload}`;
    if (muted) {
      url += "&muted=true";
    }

    return { url, expiresAt: new Date(expires * 1000).toISOString() };
  }

  private libraryId(): string | undefined {
    return this.config.get("BUNNY_STREAM_LIBRARY_ID");
  }

  private tokenKey(): string | undefined {
    return this.config.get("BUNNY_STREAM_EMBED_TOKEN_KEY");
  }
}
