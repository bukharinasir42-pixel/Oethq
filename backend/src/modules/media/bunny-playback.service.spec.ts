import crypto from "crypto";
import type { AppConfig } from "../../common/app-config";
import { BunnyNotConfiguredError, BunnyPlaybackService } from "./bunny-playback.service";

function config(values: Record<string, string | undefined> = {}): AppConfig {
  return {
    get<T = string>(key: string, defaultValue?: T): T | undefined {
      const value = values[key];
      return (value === undefined || value === "" ? defaultValue : value) as T | undefined;
    }
  };
}

describe("BunnyPlaybackService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates Bunny's exact token-authenticated embed URL", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const tokenKey = "bunny-test-key";
    const videoId = "video / 123";
    const expires = 1_700_000_300;
    const token = crypto.createHash("sha256").update(`${tokenKey}${videoId}${expires}`).digest("hex");
    const service = new BunnyPlaybackService(
      config({
        BUNNY_STREAM_LIBRARY_ID: "library-123",
        BUNNY_STREAM_EMBED_TOKEN_KEY: tokenKey,
        BUNNY_STREAM_EMBED_HOST: "https://embed.example.test///",
        BUNNY_STREAM_EMBED_TTL_SECONDS: "300"
      })
    );

    expect(service.buildEmbedUrl(videoId)).toEqual({
      url: `https://embed.example.test/embed/library-123/${encodeURIComponent(videoId)}?token=${token}&expires=${expires}&autoplay=false&preload=true`,
      expiresAt: "2023-11-14T22:18:20.000Z"
    });
  });

  it("reports configuration only when both the library id and token key are set", () => {
    expect(
      new BunnyPlaybackService(
        config({ BUNNY_STREAM_LIBRARY_ID: "library-123", BUNNY_STREAM_EMBED_TOKEN_KEY: "bunny-test-key" })
      ).isConfigured()
    ).toBe(true);
    expect(new BunnyPlaybackService(config({ BUNNY_STREAM_LIBRARY_ID: "library-123" })).isConfigured()).toBe(false);
    expect(new BunnyPlaybackService(config({ BUNNY_STREAM_EMBED_TOKEN_KEY: "bunny-test-key" })).isConfigured()).toBe(false);
  });

  it("fails closed with a typed error when configuration or the video id is missing", () => {
    const configured = new BunnyPlaybackService(
      config({ BUNNY_STREAM_LIBRARY_ID: "library-123", BUNNY_STREAM_EMBED_TOKEN_KEY: "bunny-test-key" })
    );

    expect(() => new BunnyPlaybackService(config()).buildEmbedUrl("video-123")).toThrow(BunnyNotConfiguredError);
    expect(() => configured.buildEmbedUrl("   ")).toThrow(BunnyNotConfiguredError);
  });
});
