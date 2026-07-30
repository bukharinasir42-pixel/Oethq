/**
 * ReadingArticlesService — the premium reading-article bank + global "article of
 * the day" for the Reading Part B/C core-skill surface.
 *
 * Admins upload a library of ~100 structured articles (title + standfirst +
 * paragraphs). Candidates see ONE article per day (same for everyone), rotating
 * every 24h. Rotation is deterministic and mirrors SkillDrill: within each full
 * cycle through the library every article appears exactly once, in a random
 * order that reshuffles each cycle — random-feeling but never repeats until the
 * whole library has been read.
 */
import type { PrismaClient } from "@prisma/client";

const DAY_MS = 86_400_000;

export type ArticleInput = {
  kicker?: string | null;
  title: string;
  standfirst?: string | null;
  bodyText: string;
  attribution?: string | null;
};

/** Deterministic Fisher–Yates permutation of [0..n) from an integer seed. */
function seededPermutation(n: number, seed: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  let s = (seed * 2654435761 + 12345) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const trimOrNull = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
};

export class ReadingArticlesService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Admin: list articles (metadata only — omit the heavy body). */
  async list() {
    const rows = await this.prisma.readingArticle.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, kicker: true, title: true, standfirst: true, bodyText: true, displayOrder: true, isActive: true, createdAt: true }
    });
    return rows.map((r) => ({
      id: r.id,
      kicker: r.kicker,
      title: r.title,
      standfirst: r.standfirst,
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      words: r.bodyText.trim() ? r.bodyText.trim().split(/\s+/).length : 0
    }));
  }

  /** Admin: total + active counts (for the overview badge). */
  async counts() {
    const [total, active] = await Promise.all([
      this.prisma.readingArticle.count(),
      this.prisma.readingArticle.count({ where: { isActive: true } })
    ]);
    return { total, active };
  }

  /** Admin: bulk-create articles. */
  async createMany(articles: ArticleInput[]) {
    const max = await this.prisma.readingArticle.aggregate({ _max: { displayOrder: true } });
    let order = (max._max.displayOrder ?? -1) + 1;
    const clean = (Array.isArray(articles) ? articles : [])
      .filter((a) => a && typeof a.bodyText === "string" && a.bodyText.trim().length > 0 && typeof a.title === "string" && a.title.trim().length > 0)
      .map((a) => ({
        kicker: trimOrNull(a.kicker),
        title: a.title.trim().slice(0, 300),
        standfirst: trimOrNull(a.standfirst),
        bodyText: a.bodyText.trim(),
        attribution: trimOrNull(a.attribution),
        displayOrder: order++,
        // Bulk imports land as drafts (the admin UI states this) — the admin
        // reviews and publishes them explicitly before they enter rotation.
        isActive: false
      }));
    if (clean.length === 0) return { created: 0 };
    await this.prisma.readingArticle.createMany({ data: clean });
    return { created: clean.length };
  }

  /** Admin: full article (for preview/edit). */
  async getOne(id: string) {
    return this.prisma.readingArticle.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: { kicker?: string | null; title?: string; standfirst?: string | null; bodyText?: string; attribution?: string | null; isActive?: boolean; displayOrder?: number }
  ) {
    return this.prisma.readingArticle.update({
      where: { id },
      data: {
        ...(data.kicker !== undefined ? { kicker: trimOrNull(data.kicker) } : {}),
        ...(data.title !== undefined ? { title: data.title.slice(0, 300) } : {}),
        ...(data.standfirst !== undefined ? { standfirst: trimOrNull(data.standfirst) } : {}),
        ...(data.bodyText !== undefined ? { bodyText: data.bodyText } : {}),
        ...(data.attribution !== undefined ? { attribution: trimOrNull(data.attribution) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {})
      }
    });
  }

  async remove(id: string) {
    await this.prisma.readingArticle.delete({ where: { id } });
    return { ok: true };
  }

  /** Candidate: the global article of the day, or null if the bank is empty. */
  async articleOfDay(now: number = Date.now()) {
    const active = await this.prisma.readingArticle.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, kicker: true, title: true, standfirst: true, bodyText: true, attribution: true }
    });
    const n = active.length;
    if (n === 0) return null;
    const dayIndex = Math.floor(now / DAY_MS);
    const cycle = Math.floor(dayIndex / n);
    const pos = ((dayIndex % n) + n) % n;
    const perm = seededPermutation(n, cycle);
    const a = active[perm[pos]];
    return {
      id: a.id,
      kicker: a.kicker,
      title: a.title,
      standfirst: a.standfirst,
      bodyText: a.bodyText,
      attribution: a.attribution,
      total: n,
      dayKey: dayIndex,
      nextRotatesInMs: (dayIndex + 1) * DAY_MS - now
    };
  }
}
