import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AssetKind } from "@prisma/client";
import type { Request, Response } from "express";
import type { Readable } from "node:stream";
import type { AppConfig } from "../../common/app-config";
import { BadRequestException, NotFoundException } from "../../common/http-exception";
import { formatDbUnavailableMessage, withTransientDbRetry } from "../../common/db-retry";
import { createLogger } from "../../common/logger";
import { PrismaService } from "../../common/prisma.service";

/** AWS SDK errors are not always plain `Error` with a non-empty `message`. */
function formatS3ClientError(error: unknown): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];

  const push = (msg: string) => {
    const t = msg.trim();
    if (t && !parts.includes(t)) {
      parts.push(t);
    }
  };

  const walk = (e: unknown): void => {
    if (e == null || seen.has(e)) {
      return;
    }
    seen.add(e);

    if (typeof e === "string") {
      push(e);
      return;
    }

    if (e instanceof AggregateError && Array.isArray(e.errors)) {
      for (const sub of e.errors) {
        walk(sub);
      }
      return;
    }

    if (e instanceof Error) {
      push(e.message);
    }

    if (e && typeof e === "object") {
      const o = e as Record<string, unknown>;
      if (typeof o.name === "string") {
        push(o.name);
      }
      if (typeof o.Code === "string") {
        push(o.Code);
      }
      if (typeof o.Message === "string") {
        push(o.Message);
      }
      if (typeof o.message === "string") {
        push(String(o.message));
      }
      const meta = o.$metadata as Record<string, unknown> | undefined;
      if (meta && typeof meta.httpStatusCode === "number") {
        push(`HTTP ${String(meta.httpStatusCode)}`);
      }
      if (meta && typeof meta.requestId === "string") {
        push(`requestId=${meta.requestId}`);
      }
      if ("cause" in o) {
        walk(o.cause);
      }
    }
  };

  walk(error);

  if (parts.length > 0) {
    return parts.join(" — ");
  }
  const s = String(error);
  return s !== "[object Object]"
    ? s
    : "Unknown error (empty message from S3 client; check AWS_REGION, credentials, and network)";
}

function encodeS3ObjectKeyPath(key: string): string {
  return key.split("/").map((s) => encodeURIComponent(s)).join("/");
}

export class StorageService {
  private readonly logger = createLogger("StorageService");
  private readonly client: S3Client;
  private readonly region: string;

  constructor(
    private readonly configService: AppConfig,
    private readonly prisma: PrismaService
  ) {
    this.region =
      this.configService.get<string>("AWS_REGION")?.trim() ||
      this.configService.get<string>("AWS_DEFAULT_REGION")?.trim() ||
      "us-east-1";
    this.client = this.createS3Client();
  }

  private resolveStorageCredentials() {
    const accessKeyId =
      this.configService.get<string>("AWS_ACCESS_KEY_ID")?.trim() ||
      this.configService.get<string>("MINIO_ROOT_USER")?.trim();
    const secretAccessKey =
      this.configService.get<string>("AWS_SECRET_ACCESS_KEY")?.trim() ||
      this.configService.get<string>("MINIO_ROOT_PASSWORD")?.trim();

    if (accessKeyId && secretAccessKey) {
      return { accessKeyId, secretAccessKey };
    }
    return null;
  }

  private getCustomEndpoint() {
    return (
      this.configService.get<string>("S3_ENDPOINT")?.trim() ||
      this.configService.get<string>("MINIO_ENDPOINT")?.trim() ||
      null
    );
  }

  /** ECS Fargate / Lambda task role — no access keys in env; SDK uses the default credential chain. */
  private usesManagedAwsCredentials() {
    return Boolean(
      process.env.ECS_CONTAINER_METADATA_URI ||
        process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
        process.env.AWS_EXECUTION_ENV
    );
  }

  private assertUploadStorageReady() {
    const endpoint = this.getCustomEndpoint();
    if (endpoint) {
      if (!this.resolveStorageCredentials()) {
        throw new BadRequestException(
          "Storage is not configured: set MINIO_ROOT_USER/MINIO_ROOT_PASSWORD (or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY) in .env, start MinIO, then restart the API."
        );
      }
      return;
    }

    if (this.resolveStorageCredentials() || this.usesManagedAwsCredentials()) {
      return;
    }

    throw new BadRequestException(
      "Storage is not configured: add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env (create an IAM access key — not your AWS console password), then restart the API."
    );
  }

  private storageSetupHint(kindLabel?: string, bucket?: string) {
    const endpoint = this.getCustomEndpoint();
    const bucketHint = bucket ? ` (bucket: ${bucket})` : "";
    const prefix = kindLabel ? `Storage upload failed (${kindLabel})${bucketHint}: ` : "";
    if (endpoint) {
      return `${prefix}Could not reach object storage at ${endpoint}. Start MinIO (docker compose -f docker/docker-compose.yml up -d minio), set MINIO_ROOT_USER/MINIO_ROOT_PASSWORD (or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY), create buckets named in S3_BUCKET_* (defaults: audio, video, pdfs, images), and restart the API.`;
    }
    return `${prefix}Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env (IAM → Users → Security credentials → Create access key — not your console sign-in password), ensure AWS_REGION and S3_BUCKET_* match your S3 buckets, grant s3:PutObject on the target bucket, then restart the API.`;
  }

  private createS3Client(): S3Client {
    const endpoint = this.getCustomEndpoint();
    const credentials = this.resolveStorageCredentials();

    if (endpoint) {
      if (!credentials) {
        this.logger.warn(
          "S3_ENDPOINT/MINIO_ENDPOINT is set but no credentials found (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or MINIO_ROOT_USER/MINIO_ROOT_PASSWORD)."
        );
      }
      return new S3Client({
        region: this.region,
        endpoint,
        forcePathStyle: true,
        ...(credentials ? { credentials } : {})
      });
    }

    if (!credentials && !this.usesManagedAwsCredentials()) {
      this.logger.warn(
        "AWS S3: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY are not set. Uploads will fail until IAM access keys are added to .env and the API is restarted."
      );
    }

    /** Retries on 301 when `AWS_REGION` does not match the bucket’s real region (common with mixed env / CLI defaults). */
    return new S3Client({
      region: this.region,
      followRegionRedirects: true,
      ...(credentials ? { credentials } : {})
    });
  }

  /** Stable S3 path per task day + slot so re-uploads replace the same object (DB row upserted by objectKey). */
  buildDailyTaskVideoObjectKey(
    dayNumber: number,
    slot: "lecture-video" | "coreskill-video",
    originalFilename: string
  ) {
    const extension = this.extractExtension(originalFilename);
    return `day${dayNumber}/Lecture/${slot}${extension}`;
  }

  buildDailyTaskLectureThumbnailObjectKey(dayNumber: number, originalFilename: string) {
    const extension = this.extractExtension(originalFilename);
    return `day${dayNumber}/Lecture/lecture-thumbnail${extension}`;
  }

  buildDailyTaskCoreSkillThumbnailObjectKey(dayNumber: number, originalFilename: string) {
    const extension = this.extractExtension(originalFilename);
    return `day${dayNumber}/Lecture/coreskill-thumbnail${extension}`;
  }

  buildDailyTaskCheatSheetObjectKey(dayNumber: number, originalFilename: string) {
    const extension = this.extractExtension(originalFilename) || ".pdf";
    return `day${dayNumber}/cheat-sheet${extension}`;
  }

  buildDailyTaskArticlePdfObjectKey(dayNumber: number, originalFilename: string) {
    const extension = this.extractExtension(originalFilename) || ".pdf";
    return `day${dayNumber}/article${extension}`;
  }

  buildHowToIntroductionVideoObjectKey(originalFilename: string) {
    const extension = this.extractExtension(originalFilename);
    return `how-to-introduction/intro-video${extension}`;
  }

  buildHowToIntroductionThumbnailObjectKey(originalFilename: string) {
    const extension = this.extractExtension(originalFilename);
    return `how-to-introduction/intro-thumbnail${extension}`;
  }

  buildWebsiteHeroVideoObjectKey(originalFilename: string) {
    const extension = this.extractExtension(originalFilename);
    return `video/website-home-hero${extension}`;
  }

  getPublicAssetUrl(bucket: string, objectKey: string) {
    return this.virtualHostedObjectUrl(bucket, objectKey);
  }

  resolveUploadObjectKey(params: {
    kind: AssetKind;
    filename: string;
    objectKey?: string;
  }) {
    return (
      params.objectKey?.trim() ||
      `${params.kind.toLowerCase()}/${Date.now()}-${this.sanitize(params.filename)}`
    );
  }

  async createPresignedUpload(params: {
    kind: AssetKind;
    filename: string;
    contentType: string;
    objectKey?: string;
  }) {
    this.assertUploadStorageReady();

    const bucket = this.getBucketForKind(params.kind);
    const objectKey = this.resolveUploadObjectKey(params);
    const contentType = params.contentType?.trim() || "application/octet-stream";

    try {
      const uploadUrl = await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          ContentType: contentType
        }),
        { expiresIn: 15 * 60 }
      );

      return { uploadUrl, objectKey, bucket, contentType, expiresIn: 15 * 60 };
    } catch (error) {
      const msg = formatS3ClientError(error);
      this.logger.error(`S3 presign failed (bucket=${bucket}, key=${objectKey}): ${msg}`);
      throw new BadRequestException(`${this.storageSetupHint(params.kind.toLowerCase(), bucket)} ${msg}`);
    }
  }

  async completePresignedUpload(params: {
    kind: AssetKind;
    objectKey: string;
    title: string;
    contentType: string;
    sizeBytes: number;
    uploadedById?: string;
  }) {
    this.assertUploadStorageReady();

    const bucket = this.getBucketForKind(params.kind);
    const objectKey = params.objectKey.trim();
    if (!objectKey) {
      throw new BadRequestException("objectKey is required");
    }

    let sizeBytes = params.sizeBytes;
    let contentType = params.contentType?.trim() || "application/octet-stream";

    try {
      const head = await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey
        })
      );
      if (typeof head.ContentLength === "number" && head.ContentLength > 0) {
        sizeBytes = head.ContentLength;
      }
      if (head.ContentType?.trim()) {
        contentType = head.ContentType.trim();
      }
    } catch (error) {
      const msg = formatS3ClientError(error);
      throw new BadRequestException(`Upload not found in storage. Finish the direct upload first. ${msg}`);
    }

    return this.persistStorageObject({
      kind: params.kind,
      bucket,
      objectKey,
      title: params.title,
      contentType,
      sizeBytes,
      uploadedById: params.uploadedById
    });
  }

  async uploadAsset(params: {
    file: Express.Multer.File;
    kind: AssetKind;
    title: string;
    uploadedById?: string;
    objectKey?: string;
  }) {
    this.assertUploadStorageReady();

    const bucket = this.getBucketForKind(params.kind);
    const objectKey = this.resolveUploadObjectKey({
      kind: params.kind,
      filename: params.file.originalname,
      objectKey: params.objectKey
    });

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: params.file.buffer,
          ContentType: params.file.mimetype
        })
      );
    } catch (error) {
      const msg = formatS3ClientError(error);
      this.logger.error(`S3 PutObject failed (bucket=${bucket}, key=${objectKey}): ${msg}`);
      const kindLabel = params.kind.toLowerCase();
      throw new BadRequestException(`${this.storageSetupHint(kindLabel, bucket)} ${msg}`);
    }

    return this.persistStorageObject({
      kind: params.kind,
      bucket,
      objectKey,
      title: params.title,
      contentType: params.file.mimetype,
      sizeBytes: params.file.size,
      uploadedById: params.uploadedById
    });
  }

  private async persistStorageObject(params: {
    kind: AssetKind;
    bucket: string;
    objectKey: string;
    title: string;
    contentType: string;
    sizeBytes: number;
    uploadedById?: string;
  }) {
    try {
      return await withTransientDbRetry(async () => {
        const existing = await this.prisma.storageObject.findUnique({
          where: { objectKey: params.objectKey },
          select: { id: true }
        });
        const replaced = Boolean(existing);

        const row = await this.prisma.storageObject.upsert({
          where: { objectKey: params.objectKey },
          create: {
            kind: params.kind,
            bucket: params.bucket,
            objectKey: params.objectKey,
            title: params.title,
            contentType: params.contentType,
            sizeBytes: params.sizeBytes,
            uploadedById: params.uploadedById
          },
          update: {
            kind: params.kind,
            bucket: params.bucket,
            title: params.title,
            contentType: params.contentType,
            sizeBytes: params.sizeBytes,
            uploadedById: params.uploadedById
          }
        });
        const withUrl = await this.getSignedAsset(row.id);
        return { ...(withUrl ?? row), replaced };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Can't reach database server")) {
        throw new BadRequestException(
          `${formatDbUnavailableMessage("File uploaded to storage, but saving asset metadata failed.")} Retry the upload once the database is reachable.`
        );
      }
      throw error;
    }
  }

  async getSignedAsset(storageObjectId: string) {
    const asset = await this.prisma.storageObject.findUnique({
      where: { id: storageObjectId }
    });
    if (!asset) {
      return null;
    }

    const signedUrl = await this.getSignedUrl(asset.bucket, asset.objectKey);
    const publicUrl = this.getPublicAssetUrl(asset.bucket, asset.objectKey);
    return { ...asset, signedUrl, publicUrl };
  }

  async getSignedUrl(bucket: string, objectKey: string) {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey
        }),
        { expiresIn: 60 * 60 }
      );
    } catch (error) {
      this.logger.warn(`Signed URL failed for ${objectKey}: ${formatS3ClientError(error)}`);
      const base = this.configService.get<string>("S3_PUBLIC_ASSET_BASE_URL")?.trim();
      if (base) {
        return `${base.replace(/\/$/, "")}/${bucket}/${encodeS3ObjectKeyPath(objectKey)}`;
      }
      return this.virtualHostedObjectUrl(bucket, objectKey);
    }
  }

  async streamObjectToResponse(bucket: string, objectKey: string, req: Request, res: Response) {
    let head;
    try {
      head = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    } catch (error) {
      this.logger.warn(`HeadObject failed for ${objectKey}: ${formatS3ClientError(error)}`);
      throw new NotFoundException("Video not found");
    }

    const size = head.ContentLength ?? 0;
    const contentType = head.ContentType || "video/mp4";
    const range = req.headers.range;

    if (range && size > 0) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = Number.parseInt(parts[0], 10);
      const end = parts[1] ? Number.parseInt(parts[1], 10) : size - 1;
      if (Number.isNaN(start) || start >= size || end >= size || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${size}`).end();
        return;
      }

      const obj = await this.client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Range: `bytes=${start}-${end}`
        })
      );
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", chunkSize);
      res.setHeader("Content-Type", contentType);
      this.pipeObjectBody(obj.Body, res);
      return;
    }

    const obj = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    res.status(200);
    res.setHeader("Accept-Ranges", "bytes");
    if (size > 0) {
      res.setHeader("Content-Length", size);
    }
    res.setHeader("Content-Type", contentType);
    this.pipeObjectBody(obj.Body, res);
  }

  private pipeObjectBody(body: unknown, res: Response) {
    if (body && typeof body === "object" && "pipe" in body && typeof (body as Readable).pipe === "function") {
      (body as Readable).pipe(res);
      return;
    }
    throw new NotFoundException("Video stream unavailable");
  }

  /**
   * Removes the object from S3 and the DB row when nothing references this id (Blog, Test, DailyTask).
   */
  async deleteStorageObjectIfUnused(storageObjectId: string): Promise<void> {
    const [blogs, tests, listeningTracks, tasks, howToIntro, websiteHome] = await Promise.all([
      this.prisma.blog.count({ where: { imageAssetId: storageObjectId } }),
      this.prisma.test.count({
        where: {
          OR: [
            { audioAssetId: storageObjectId },
            { bookletAssetId: storageObjectId },
            { partBBookletAssetId: storageObjectId },
            { partCBookletAssetId: storageObjectId }
          ]
        }
      }),
      this.prisma.listeningAudioTrack.count({ where: { assetId: storageObjectId } }),
      this.prisma.dailyTask.count({
        where: {
          OR: [
            { lectureAssetId: storageObjectId },
            { lectureThumbnailAssetId: storageObjectId },
            { articleAssetId: storageObjectId },
            { articleThumbnailAssetId: storageObjectId },
            { articlePdfAssetId: storageObjectId },
            { pastPaperAssetId: storageObjectId },
            { cheatSheetAssetId: storageObjectId }
          ]
        }
      }),
      this.prisma.howToIntroduction.count({
        where: {
          OR: [{ videoAssetId: storageObjectId }, { thumbnailAssetId: storageObjectId }]
        }
      }),
      this.prisma.websiteHomeContent.count({
        where: { heroVideoAssetId: storageObjectId }
      })
    ]);
    if (blogs + tests + listeningTracks + tasks + howToIntro + websiteHome > 0) {
      return;
    }

    const asset = await this.prisma.storageObject.findUnique({ where: { id: storageObjectId } });
    if (!asset) {
      return;
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: asset.bucket,
          Key: asset.objectKey
        })
      );
    } catch (error) {
      this.logger.warn(
        `S3 DeleteObject failed (${asset.bucket}/${asset.objectKey}): ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      await this.prisma.storageObject.delete({ where: { id: storageObjectId } });
    } catch (error) {
      this.logger.warn(`Prisma delete StorageObject ${storageObjectId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private virtualHostedObjectUrl(bucket: string, objectKey: string): string {
    const path = encodeS3ObjectKeyPath(objectKey);
    if (this.region === "us-east-1") {
      return `https://${bucket}.s3.amazonaws.com/${path}`;
    }
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${path}`;
  }

  private getBucketForKind(kind: AssetKind) {
    switch (kind) {
      case AssetKind.AUDIO:
        return (
          this.configService.get<string>("S3_BUCKET_AUDIO") ||
          this.configService.get<string>("MINIO_BUCKET_AUDIO") ||
          "audio"
        );
      case AssetKind.VIDEO:
        return (
          this.configService.get<string>("S3_BUCKET_VIDEO") ||
          this.configService.get<string>("MINIO_BUCKET_VIDEO") ||
          "video"
        );
      case AssetKind.PDF:
        return (
          this.configService.get<string>("S3_BUCKET_PDFS") ||
          this.configService.get<string>("MINIO_BUCKET_PDFS") ||
          "pdfs"
        );
      case AssetKind.LINK:
        return (
          this.configService.get<string>("S3_BUCKET_PDFS") ||
          this.configService.get<string>("MINIO_BUCKET_PDFS") ||
          "pdfs"
        );
      case AssetKind.IMAGE:
        return (
          this.configService.get<string>("S3_BUCKET_IMAGES") ||
          this.configService.get<string>("MINIO_BUCKET_IMAGES") ||
          "images"
        );
      default: {
        const exhaustiveCheck: never = kind;
        return exhaustiveCheck;
      }
    }
  }

  private sanitize(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  }

  private extractExtension(filename: string) {
    const match = filename.match(/(\.[a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : ".mp4";
  }
}
