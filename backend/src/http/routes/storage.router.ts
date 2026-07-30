import { AssetKind } from "@prisma/client";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { BadRequestException, NotFoundException } from "../../common/http-exception";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";
import type { AuthedRequest } from "../middleware";
import { validateDto } from "../validation";
import { CompleteUploadDto, PresignUploadDto } from "../../modules/storage/dto/presign-upload.dto";

const upload = multer({
  storage: multer.memoryStorage()
});

function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, next);
}

function parseAssetKind(param: string): AssetKind {
  const upper = param.toUpperCase();
  if ((Object.values(AssetKind) as string[]).includes(upper)) {
    return upper as AssetKind;
  }
  throw new BadRequestException(`Invalid upload kind: ${param}`);
}

function resolveTaskMediaObjectKey(
  storageService: AppContainer["storageService"],
  kind: AssetKind,
  dto: PresignUploadDto,
  filename: string
) {
  const slot = dto.slot?.trim() || "";
  if (slot === "how-to-video" && kind === AssetKind.VIDEO) {
    return storageService.buildHowToIntroductionVideoObjectKey(filename);
  }
  if (slot === "how-to-thumbnail" && kind === AssetKind.IMAGE) {
    return storageService.buildHowToIntroductionThumbnailObjectKey(filename);
  }
  if (slot === "website-hero-video" && kind === AssetKind.VIDEO) {
    return storageService.buildWebsiteHeroVideoObjectKey(filename);
  }
  const dayNumber = dto.dayNumber;
  if (!dayNumber || !Number.isFinite(dayNumber) || dayNumber <= 0) {
    return undefined;
  }
  if (slot === "lecture-video" || slot === "coreskill-video") {
    return storageService.buildDailyTaskVideoObjectKey(dayNumber, slot, filename);
  }
  if (kind === AssetKind.IMAGE && slot === "lecture-thumbnail") {
    return storageService.buildDailyTaskLectureThumbnailObjectKey(dayNumber, filename);
  }
  if (kind === AssetKind.IMAGE && slot === "coreskill-thumbnail") {
    return storageService.buildDailyTaskCoreSkillThumbnailObjectKey(dayNumber, filename);
  }
  if (kind === AssetKind.PDF && slot === "cheat-sheet") {
    return storageService.buildDailyTaskCheatSheetObjectKey(dayNumber, filename);
  }
  if (kind === AssetKind.PDF && slot === "article-pdf") {
    return storageService.buildDailyTaskArticlePdfObjectKey(dayNumber, filename);
  }
  throw new BadRequestException(
    'slot must be "lecture-video", "coreskill-video", "lecture-thumbnail", "coreskill-thumbnail", "cheat-sheet", or "article-pdf" when dayNumber is set'
  );
}

export function createStorageRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);

  r.get(
    "/storage/public/website-intro-video",
    asyncHandler(async (req, res) => {
      const location = await c.websiteHomeService.resolveHeroVideoLocation();
      if (!location) {
        throw new NotFoundException("Homepage video is not configured");
      }

      const accept = String(req.headers.accept || "");
      if (accept.includes("application/json") || req.query.format === "json") {
        const signedUrl = await c.storageService.getSignedUrl(location.bucket, location.objectKey);
        res.json({ signedUrl, ...location });
        return;
      }

      await c.storageService.streamObjectToResponse(location.bucket, location.objectKey, req, res);
    })
  );

  r.post(
    "/storage/presign/:kind",
    auth,
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const kind = parseAssetKind(req.params.kind);
      const dto = await validateDto(PresignUploadDto, req.body);
      const filename = dto.filename.trim() || "upload";
      const title = dto.title.trim() || filename;
      const objectKey = resolveTaskMediaObjectKey(c.storageService, kind, dto, filename);

      const presigned = await c.storageService.createPresignedUpload({
        kind,
        filename,
        contentType: dto.contentType.trim() || "application/octet-stream",
        objectKey
      });

      res.json({
        ...presigned,
        title
      });
    })
  );

  r.post(
    "/storage/complete/:kind",
    auth,
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const kind = parseAssetKind(req.params.kind);
      const dto = await validateDto(CompleteUploadDto, req.body);
      const u = (req as AuthedRequest).user;
      const asset = await c.storageService.completePresignedUpload({
        kind,
        objectKey: dto.objectKey,
        title: dto.title.trim() || dto.objectKey,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        uploadedById: u.id
      });
      res.status(asset.replaced ? 200 : 201).json(asset);
    })
  );

  r.post(
    "/storage/upload/:kind",
    auth,
    requireAdmin(),
    uploadSingle,
    asyncHandler(async (req, res) => {
      const file = req.file;
      if (!file?.buffer) {
        throw new BadRequestException("Missing file field");
      }
      const kind = parseAssetKind(req.params.kind);
      const title =
        typeof req.body?.title === "string" && req.body.title.trim()
          ? req.body.title.trim()
          : file.originalname || "upload";
      const dayNumberRaw = req.body?.dayNumber;
      const dayNumber =
        dayNumberRaw !== undefined && dayNumberRaw !== null && String(dayNumberRaw).trim() !== ""
          ? Number(dayNumberRaw)
          : undefined;
      const slot = typeof req.body?.slot === "string" ? req.body.slot.trim() : "";
      let objectKey: string | undefined;
      if (slot === "how-to-video" && kind === AssetKind.VIDEO) {
        objectKey = c.storageService.buildHowToIntroductionVideoObjectKey(file.originalname || "video.mp4");
      } else if (slot === "how-to-thumbnail" && kind === AssetKind.IMAGE) {
        objectKey = c.storageService.buildHowToIntroductionThumbnailObjectKey(file.originalname || "thumbnail.jpg");
      } else if (slot === "website-hero-video" && kind === AssetKind.VIDEO) {
        objectKey = c.storageService.buildWebsiteHeroVideoObjectKey(file.originalname || "video.mp4");
      } else if (dayNumber && Number.isFinite(dayNumber) && dayNumber > 0) {
        if (slot === "lecture-video" || slot === "coreskill-video") {
          objectKey = c.storageService.buildDailyTaskVideoObjectKey(dayNumber, slot, file.originalname || "video.mp4");
        } else if (kind === AssetKind.IMAGE && slot === "lecture-thumbnail") {
          objectKey = c.storageService.buildDailyTaskLectureThumbnailObjectKey(
            dayNumber,
            file.originalname || "thumbnail.jpg"
          );
        } else if (kind === AssetKind.IMAGE && slot === "coreskill-thumbnail") {
          objectKey = c.storageService.buildDailyTaskCoreSkillThumbnailObjectKey(
            dayNumber,
            file.originalname || "thumbnail.jpg"
          );
        } else if (kind === AssetKind.PDF && slot === "cheat-sheet") {
          objectKey = c.storageService.buildDailyTaskCheatSheetObjectKey(
            dayNumber,
            file.originalname || "cheat-sheet.pdf"
          );
        } else if (kind === AssetKind.PDF && slot === "article-pdf") {
          objectKey = c.storageService.buildDailyTaskArticlePdfObjectKey(
            dayNumber,
            file.originalname || "article.pdf"
          );
        } else {
          throw new BadRequestException(
            'slot must be "lecture-video", "coreskill-video", "lecture-thumbnail", "coreskill-thumbnail", "cheat-sheet", or "article-pdf" when dayNumber is set'
          );
        }
      }
      const u = (req as AuthedRequest).user;
      const asset = await c.storageService.uploadAsset({
        file,
        kind,
        title,
        uploadedById: u.id,
        objectKey
      });
      res.status(asset.replaced ? 200 : 201).json(asset);
    })
  );

  r.get(
    "/storage/:id/signed-url",
    auth,
    asyncHandler(async (req, res) => {
      const asset = await c.storageService.getSignedAsset(req.params.id);
      if (!asset) {
        throw new NotFoundException("Storage object not found");
      }
      res.json({ signedUrl: asset.signedUrl, id: asset.id });
    })
  );

  return r;
}
