import { Router } from "express";
import { UpsertWebsiteHomeDto } from "../../modules/website-home/dto/upsert-website-home.dto";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";
import { validateDto } from "../validation";

export function createWebsiteHomeRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();

  r.get(
    "/website/home-video",
    asyncHandler(async (_req, res) => {
      res.json(await c.websiteHomeService.getForPublic());
    })
  );

  /** Public signed Bunny embed URL for the homepage hero (avoids 403 when token auth is on). */
  r.get(
    "/website/home-video/embed",
    asyncHandler(async (_req, res) => {
      const videoId =
        c.config.get("WEBSITE_HERO_BUNNY_VIDEO_ID")?.trim() ||
        "e62723b1-a68d-445e-a821-0bc3ec7a1ea4";

      if (!c.bunnyPlaybackService.isConfigured()) {
        const libraryId = c.config.get("BUNNY_STREAM_LIBRARY_ID")?.trim() || "697843";
        const embedHost = (
          c.config.get("BUNNY_STREAM_EMBED_HOST")?.trim() || "https://iframe.mediadelivery.net"
        ).replace(/\/+$/, "");
        const embedUrl = `${embedHost}/embed/${libraryId}/${encodeURIComponent(videoId)}?autoplay=true&muted=true&preload=true`;
        res.set("Cache-Control", "public, max-age=60").json({
          provider: "bunny",
          embedUrl,
          expiresAt: null,
          signed: false
        });
        return;
      }

      const { url: embedUrl, expiresAt } = c.bunnyPlaybackService.buildEmbedUrl(videoId, {
        autoplay: true,
        muted: true,
        preload: true
      });
      res.set("Cache-Control", "private, no-store").json({
        provider: "bunny",
        embedUrl,
        expiresAt,
        signed: true
      });
    })
  );

  r.get(
    "/website/home-video/admin",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await c.websiteHomeService.getForAdmin());
    })
  );

  r.put(
    "/website/home-video",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpsertWebsiteHomeDto, req.body);
      res.json(await c.websiteHomeService.upsert(dto));
    })
  );

  return r;
}
