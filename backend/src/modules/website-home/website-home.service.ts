import { PrismaService } from "../../common/prisma.service";
import { StorageService } from "../storage/storage.service";
import { UpsertWebsiteHomeDto } from "./dto/upsert-website-home.dto";

export const WEBSITE_HOME_CONTENT_ID = "default";

const LEGACY_WEBSITE_INTRO_OBJECT_KEY =
  process.env.WEBSITE_INTRO_VIDEO_OBJECT_KEY?.trim() ||
  "manual-uploads/1782979785948-website-video-dr-nasir.mp4";

export type WebsiteHomeDto = {
  id: string;
  heroVideoAssetId: string | null;
  heroVideoAsset: Awaited<ReturnType<StorageService["getSignedAsset"]>>;
  heroVideoUrl: string | null;
  updatedAt: string;
};

export class WebsiteHomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  private async ensureRow() {
    return this.prisma.websiteHomeContent.upsert({
      where: { id: WEBSITE_HOME_CONTENT_ID },
      create: { id: WEBSITE_HOME_CONTENT_ID },
      update: {}
    });
  }

  async getForPublic(): Promise<WebsiteHomeDto> {
    const row = await this.ensureRow();
    return this.serialize(row);
  }

  async getForAdmin(): Promise<WebsiteHomeDto> {
    return this.getForPublic();
  }

  async upsert(dto: UpsertWebsiteHomeDto): Promise<WebsiteHomeDto> {
    const existing = await this.ensureRow();
    const previousHeroId = existing.heroVideoAssetId;

    const updated = await this.prisma.websiteHomeContent.update({
      where: { id: WEBSITE_HOME_CONTENT_ID },
      data: {
        ...(dto.heroVideoAssetId !== undefined ? { heroVideoAssetId: dto.heroVideoAssetId } : {})
      }
    });

    if (dto.heroVideoAssetId !== undefined && previousHeroId && dto.heroVideoAssetId !== previousHeroId) {
      await this.storage.deleteStorageObjectIfUnused(previousHeroId);
    }

    return this.serialize(updated);
  }

  async resolveHeroVideoLocation(): Promise<{ bucket: string; objectKey: string } | null> {
    const row = await this.ensureRow();
    if (row.heroVideoAssetId) {
      const asset = await this.prisma.storageObject.findUnique({ where: { id: row.heroVideoAssetId } });
      if (asset) {
        return { bucket: asset.bucket, objectKey: asset.objectKey };
      }
    }

    const envAssetId = process.env.WEBSITE_INTRO_VIDEO_ASSET_ID?.trim();
    if (envAssetId) {
      const asset = await this.prisma.storageObject.findUnique({ where: { id: envAssetId } });
      if (asset) {
        return { bucket: asset.bucket, objectKey: asset.objectKey };
      }
    }

    const bucket =
      process.env.S3_BUCKET_VIDEO?.trim() || process.env.MINIO_BUCKET_VIDEO?.trim() || "video";
    return { bucket, objectKey: LEGACY_WEBSITE_INTRO_OBJECT_KEY };
  }

  private async serialize(row: { id: string; heroVideoAssetId: string | null; updatedAt: Date }) {
    const heroVideoAsset = row.heroVideoAssetId
      ? await this.storage.getSignedAsset(row.heroVideoAssetId)
      : null;
    return {
      id: row.id,
      heroVideoAssetId: row.heroVideoAssetId,
      heroVideoAsset,
      heroVideoUrl: heroVideoAsset?.signedUrl || heroVideoAsset?.publicUrl || null,
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
