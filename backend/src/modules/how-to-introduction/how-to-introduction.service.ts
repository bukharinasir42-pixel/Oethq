import { PrismaService } from "../../common/prisma.service";
import { StorageService } from "../storage/storage.service";
import { UpsertHowToIntroductionDto } from "./dto/upsert-how-to-introduction.dto";

export const HOW_TO_INTRODUCTION_ID = "default";

export type HowToIntroductionDto = {
  id: string;
  title: string;
  videoAssetId: string | null;
  videoAsset: Awaited<ReturnType<StorageService["getSignedAsset"]>>;
  videoUrl: string | null;
  thumbnailAssetId: string | null;
  thumbnailAsset: Awaited<ReturnType<StorageService["getSignedAsset"]>>;
  thumbnailUrl: string | null;
  updatedAt: string;
};

export class HowToIntroductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  private async ensureRow() {
    return this.prisma.howToIntroduction.upsert({
      where: { id: HOW_TO_INTRODUCTION_ID },
      create: { id: HOW_TO_INTRODUCTION_ID },
      update: {}
    });
  }

  async getForPortal(): Promise<HowToIntroductionDto> {
    const row = await this.ensureRow();
    return this.serialize(row);
  }

  async getForAdmin(): Promise<HowToIntroductionDto> {
    return this.getForPortal();
  }

  async upsert(dto: UpsertHowToIntroductionDto): Promise<HowToIntroductionDto> {
    const existing = await this.ensureRow();
    const previousVideoId = existing.videoAssetId;
    const previousThumbnailId = existing.thumbnailAssetId;

    const updated = await this.prisma.howToIntroduction.update({
      where: { id: HOW_TO_INTRODUCTION_ID },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.videoAssetId !== undefined ? { videoAssetId: dto.videoAssetId } : {}),
        ...(dto.thumbnailAssetId !== undefined ? { thumbnailAssetId: dto.thumbnailAssetId } : {})
      }
    });

    if (dto.videoAssetId !== undefined && previousVideoId && dto.videoAssetId !== previousVideoId) {
      await this.storage.deleteStorageObjectIfUnused(previousVideoId);
    }

    if (
      dto.thumbnailAssetId !== undefined &&
      previousThumbnailId &&
      dto.thumbnailAssetId !== previousThumbnailId
    ) {
      await this.storage.deleteStorageObjectIfUnused(previousThumbnailId);
    }

    return this.serialize(updated);
  }

  private async serialize(row: {
    id: string;
    title: string;
    videoAssetId: string | null;
    thumbnailAssetId: string | null;
    updatedAt: Date;
  }) {
    const [videoAsset, thumbnailAsset] = await Promise.all([
      row.videoAssetId ? this.storage.getSignedAsset(row.videoAssetId) : Promise.resolve(null),
      row.thumbnailAssetId ? this.storage.getSignedAsset(row.thumbnailAssetId) : Promise.resolve(null)
    ]);
    return {
      id: row.id,
      title: row.title,
      videoAssetId: row.videoAssetId,
      videoAsset,
      videoUrl: videoAsset?.signedUrl || videoAsset?.publicUrl || null,
      thumbnailAssetId: row.thumbnailAssetId,
      thumbnailAsset,
      thumbnailUrl: thumbnailAsset?.signedUrl || thumbnailAsset?.publicUrl || null,
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
