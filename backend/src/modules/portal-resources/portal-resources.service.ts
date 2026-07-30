/**
 * PortalResourcesService — premium cheat-sheet PDFs + "how to use" lecture videos
 * (per skill) and the single "must watch" intro video above the Part C articles
 * reader. Access to the cheat-sheet lists is enforced by skill ownership, mirroring
 * CourseLecture; video embeds are resolved server-side (Bunny signed embed or a
 * plain URL). PDFs are pasted external URLs (they live on live S3).
 */
import { PortalResourceKind, PortalResourcePlacement, Prisma } from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";
import type { BunnyPlaybackService } from "../media/bunny-playback.service";
import type { ProductsService } from "../products/products.service";
import { skillModuleUnlocked } from "../products/portal-tier-access";

type Skill = "READING" | "LISTENING";

const CHEATSHEET_PLACEMENT: Record<Skill, PortalResourcePlacement> = {
  READING: PortalResourcePlacement.READING_CHEATSHEET,
  LISTENING: PortalResourcePlacement.LISTENING_CHEATSHEET
};

export type PortalResourceItem = {
  id: string;
  kind: PortalResourceKind;
  title: string;
  description: string | null;
  displayOrder: number;
  pdfUrl: string | null;
  embedUrl: string | null;
};

export class PortalResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyPlaybackService,
    private readonly products: ProductsService
  ) {}

  /** Resolve a VIDEO row to a playable embed URL (Bunny signed embed, else plain URL). */
  private resolveEmbed(row: { bunnyVideoId: string | null; videoUrl: string | null }): string | null {
    if (row.bunnyVideoId) {
      try { return this.bunny.buildEmbedUrl(row.bunnyVideoId, { autoplay: false }).url; }
      catch { return row.videoUrl ?? null; }
    }
    return row.videoUrl ?? null;
  }

  private toItem(row: {
    id: string; kind: PortalResourceKind; title: string; description: string | null;
    displayOrder: number; pdfUrl: string | null; bunnyVideoId: string | null; videoUrl: string | null;
  }): PortalResourceItem {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      displayOrder: row.displayOrder,
      pdfUrl: row.kind === PortalResourceKind.PDF ? row.pdfUrl : null,
      embedUrl: row.kind === PortalResourceKind.VIDEO ? this.resolveEmbed(row) : null
    };
  }

  /**
   * Cheat-sheet resources for a skill (PDFs + how-to lecture videos), gated by
   * the Precision tier (or Complete Course) for that skill — mirroring the
   * frontend portal-tier-access gate. Under-tier or not owned (incl. free trial)
   * → `locked: true`, empty items — the premium URLs are never leaked.
   */
  async listCheatSheets(userId: string, skill: Skill) {
    const { skillAccess } = await this.products.getOwnership(userId);
    const unlocked = skillModuleUnlocked(skillAccess, skill, "cheat-sheets");
    if (!unlocked) return { skill, locked: true, pdfs: [] as PortalResourceItem[], videos: [] as PortalResourceItem[] };
    const rows = await this.prisma.portalResource.findMany({
      where: { placement: CHEATSHEET_PLACEMENT[skill], isPublished: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    });
    const items = rows.map((r) => this.toItem(r));
    return {
      skill,
      locked: false,
      pdfs: items.filter((i) => i.kind === PortalResourceKind.PDF),
      videos: items.filter((i) => i.kind === PortalResourceKind.VIDEO)
    };
  }

  /**
   * The single published "must watch" intro video above the Reading Part C
   * articles reader (the reader itself is already gated by Reading ownership).
   */
  async articleIntro(): Promise<PortalResourceItem | null> {
    const row = await this.prisma.portalResource.findFirst({
      where: { placement: PortalResourcePlacement.READING_ARTICLE_INTRO, isPublished: true, kind: PortalResourceKind.VIDEO },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    });
    return row ? this.toItem(row) : null;
  }

  /**
   * The single published mandatory "how to use the course" intro video, plus
   * whether THIS student has already finished it. Gate the portal on `!watched`
   * only when an intro video actually exists.
   */
  async onboardingIntro(userId: string) {
    const [row, user] = await Promise.all([
      this.prisma.portalResource.findFirst({
        where: { placement: PortalResourcePlacement.ONBOARDING_INTRO, isPublished: true, kind: PortalResourceKind.VIDEO },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { onboardingWatchedAt: true } })
    ]);
    return {
      intro: row ? this.toItem(row) : null,
      watched: Boolean(user?.onboardingWatchedAt)
    };
  }

  /** Mark the mandatory intro as watched for this student (idempotent). */
  async markOnboardingWatched(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { onboardingWatchedAt: true } });
    if (!user?.onboardingWatchedAt) {
      await this.prisma.user.update({ where: { id: userId }, data: { onboardingWatchedAt: new Date() } });
    }
    return { ok: true, watched: true };
  }

  // ------------------------------------------------------------- admin
  async listAll(placement?: PortalResourcePlacement) {
    return this.prisma.portalResource.findMany({
      where: placement ? { placement } : undefined,
      orderBy: [{ placement: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async create(data: {
    placement: PortalResourcePlacement; kind: PortalResourceKind; title: string;
    description?: string | null; displayOrder?: number; pdfUrl?: string | null;
    bunnyVideoId?: string | null; videoUrl?: string | null; isPublished?: boolean;
  }) {
    return this.prisma.portalResource.create({
      data: {
        placement: data.placement,
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
        displayOrder: data.displayOrder ?? 0,
        pdfUrl: data.kind === PortalResourceKind.PDF ? data.pdfUrl ?? null : null,
        bunnyVideoId: data.kind === PortalResourceKind.VIDEO ? data.bunnyVideoId ?? null : null,
        videoUrl: data.kind === PortalResourceKind.VIDEO ? data.videoUrl ?? null : null,
        isPublished: data.isPublished ?? true
      }
    });
  }

  async update(id: string, data: Prisma.PortalResourceUpdateInput) {
    const exists = await this.prisma.portalResource.findUnique({ where: { id } });
    if (!exists) throw Object.assign(new Error("Resource not found"), { statusCode: 404 });
    return this.prisma.portalResource.update({ where: { id }, data });
  }

  async remove(id: string) {
    const exists = await this.prisma.portalResource.findUnique({ where: { id } });
    if (!exists) throw Object.assign(new Error("Resource not found"), { statusCode: 404 });
    await this.prisma.portalResource.delete({ where: { id } });
    return { ok: true };
  }
}
