import { NotFoundException } from "../../common/http-exception";
import { Blog, BlogStatus, BlogType, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { StorageService } from "../storage/storage.service";
import { CreateBlogDto } from "./dto/create-blog.dto";
import { PublishBlogDto } from "./dto/publish-blog.dto";
import { UpdateBlogDto } from "./dto/update-blog.dto";

export type PublicBlogDto = {
  id: string;
  title: string;
  description: string;
  blogType: BlogType;
  imageUrl: string | null;
  publishedAt: string | null;
};

export type PaginatedPublicBlogsDto = {
  items: PublicBlogDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Single published article for public reading (includes optional long-form HTML). */
export type PublicBlogDetailDto = PublicBlogDto & {
  content: string | null;
};

export class BlogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  async listPublishedPaginated(page: number, limit: number): Promise<PaginatedPublicBlogsDto> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.BlogWhereInput = { status: BlogStatus.PUBLISHED };

    const [total, rows] = await Promise.all([
      this.prisma.blog.count({ where }),
      this.prisma.blog.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take: safeLimit
      })
    ]);

    const items = await Promise.all(rows.map((row) => this.toPublicDto(row)));
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages
    };
  }

  async getPublishedById(id: string): Promise<PublicBlogDetailDto | null> {
    const blog = await this.prisma.blog.findFirst({
      where: { id, status: BlogStatus.PUBLISHED }
    });
    if (!blog) return null;
    const base = await this.toPublicDto(blog);
    return { ...base, content: blog.content };
  }

  async listForAdmin() {
    const rows = await this.prisma.blog.findMany({
      orderBy: { updatedAt: "desc" }
    });
    return Promise.all(rows.map((row) => this.toAdminDto(row)));
  }

  async getForAdmin(id: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException("Blog not found");
    return this.toAdminDto(blog);
  }

  async create(dto: CreateBlogDto) {
    return this.prisma.blog.create({
      data: {
        title: dto.title,
        description: dto.description,
        content: dto.content ?? null,
        blogType: dto.blogType,
        imageAssetId: dto.imageAssetId ?? null,
        status: BlogStatus.DRAFT
      }
    });
  }

  async update(id: string, dto: UpdateBlogDto) {
    const existing = await this.ensureBlog(id);
    const previousImageId = existing.imageAssetId;

    const updated = await this.prisma.blog.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.blogType !== undefined ? { blogType: dto.blogType } : {}),
        ...(dto.imageAssetId !== undefined ? { imageAssetId: dto.imageAssetId } : {})
      }
    });

    if (dto.imageAssetId !== undefined && previousImageId && dto.imageAssetId !== previousImageId) {
      await this.storage.deleteStorageObjectIfUnused(previousImageId);
    }

    return updated;
  }

  async remove(id: string) {
    const blog = await this.ensureBlog(id);
    const previousImageId = blog.imageAssetId;

    await this.prisma.blog.delete({ where: { id } });

    if (previousImageId) {
      await this.storage.deleteStorageObjectIfUnused(previousImageId);
    }

    return { ok: true };
  }

  async publish(id: string, dto: PublishBlogDto) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException("Blog not found");
    return this.prisma.blog.update({
      where: { id },
      data: {
        status: dto.publish ? BlogStatus.PUBLISHED : BlogStatus.DRAFT,
        publishedAt: dto.publish ? new Date() : null
      }
    });
  }

  private async ensureBlog(id: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException("Blog not found");
    return blog;
  }

  private async toPublicDto(blog: Blog): Promise<PublicBlogDto> {
    let imageUrl: string | null = null;
    if (blog.imageAssetId) {
      const signed = await this.storage.getSignedAsset(blog.imageAssetId);
      imageUrl = signed?.signedUrl ?? null;
    }
    return {
      id: blog.id,
      title: blog.title,
      description: blog.description,
      blogType: blog.blogType,
      imageUrl,
      publishedAt: blog.publishedAt ? blog.publishedAt.toISOString() : null
    };
  }

  private async toAdminDto(blog: Blog) {
    let imageUrl: string | null = null;
    if (blog.imageAssetId) {
      const signed = await this.storage.getSignedAsset(blog.imageAssetId);
      imageUrl = signed?.signedUrl ?? null;
    }
    return {
      id: blog.id,
      title: blog.title,
      description: blog.description,
      content: blog.content,
      blogType: blog.blogType,
      imageAssetId: blog.imageAssetId,
      status: blog.status,
      publishedAt: blog.publishedAt ? blog.publishedAt.toISOString() : null,
      createdAt: blog.createdAt.toISOString(),
      updatedAt: blog.updatedAt.toISOString(),
      imageUrl
    };
  }
}
