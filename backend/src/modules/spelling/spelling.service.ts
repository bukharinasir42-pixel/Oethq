/**
 * SpellingService — the OET Listening Part A spelling bank.
 *
 * getBank() returns the compact shape the provided assessment engine expects:
 *   { cats: [{ n: name, h: category hint }], items: [[term, catIndex, difficulty]] }
 * built live from the DB, so the engine always runs the current bank.
 * Admin methods manage the bank (search/filter, add, bulk import, edit, delete).
 */
import type { PrismaClient } from "@prisma/client";

// Preferred display order (matches the seeded bank); unknown categories append after.
const CATEGORY_ORDER = [
  "Symptoms", "Signs", "Conditions", "Viruses", "Microbes", "Occupations",
  "Investigations", "Treatments", "Drug classes", "Measurements", "Nutrition", "Anatomy"
];

export class SpellingService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Build the engine's compact { cats, items, count } shape from a set of terms. */
  private buildCompact(terms: Array<{ term: string; category: string; hint: string; difficulty: number }>) {
    // Representative hint per category = most common hint among its terms.
    const hintCounts = new Map<string, Map<string, number>>();
    const present = new Set<string>();
    for (const t of terms) {
      present.add(t.category);
      if (!hintCounts.has(t.category)) hintCounts.set(t.category, new Map());
      const m = hintCounts.get(t.category)!;
      m.set(t.hint, (m.get(t.hint) ?? 0) + 1);
    }
    const catNames = [
      ...CATEGORY_ORDER.filter((c) => present.has(c)),
      ...[...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort()
    ];
    const catIndex = new Map(catNames.map((c, i) => [c, i]));
    const cats = catNames.map((n) => {
      const m = hintCounts.get(n)!;
      let best = "", bestN = -1;
      for (const [h, c] of m) if (c > bestN) { best = h; bestN = c; }
      return { n, h: best };
    });
    const items = terms.map((t) => [t.term, catIndex.get(t.category)!, t.difficulty] as [string, number, number]);
    return { cats, items, count: items.length };
  }

  /** Candidate: the live bank in the engine's compact format (full bank). */
  async getBank() {
    const terms = await this.prisma.spellingTerm.findMany({
      where: { isActive: true },
      select: { term: true, category: true, hint: true, difficulty: true },
      orderBy: { id: "asc" }
    });
    return this.buildCompact(terms);
  }

  /**
   * Candidate: today's spelling set — a deterministic window of `perDay` NEW terms
   * that rotates every 24h (same for everyone, mirrors the drill/article of the day).
   * The window walks the whole bank so terms don't repeat until the bank is
   * exhausted (~65 days at 30/day for the 1,938-term bank), then cycles.
   */
  async getDailyBank(now: number = Date.now(), perDay = 30) {
    const DAY_MS = 86_400_000;
    const all = await this.prisma.spellingTerm.findMany({
      where: { isActive: true },
      select: { term: true, category: true, hint: true, difficulty: true },
      orderBy: { id: "asc" }
    });
    const total = all.length;
    const dayIndex = Math.floor(now / DAY_MS);
    if (total === 0) {
      return { cats: [], items: [], count: 0, total: 0, perDay, dayKey: dayIndex, nextRotatesInMs: (dayIndex + 1) * DAY_MS - now };
    }
    const n = Math.min(perDay, total);
    const start = (((dayIndex * n) % total) + total) % total;
    const daily = Array.from({ length: n }, (_, i) => all[(start + i) % total]);
    return {
      ...this.buildCompact(daily),
      total,
      perDay: n,
      dayKey: dayIndex,
      nextRotatesInMs: (dayIndex + 1) * DAY_MS - now
    };
  }

  // ---------- Admin ----------
  async list(opts: { search?: string; category?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    const where = {
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.search ? { term: { contains: opts.search, mode: "insensitive" as const } } : {})
    };
    const [rows, total] = await Promise.all([
      this.prisma.spellingTerm.findMany({
        where,
        orderBy: [{ category: "asc" }, { term: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.spellingTerm.count({ where })
    ]);
    return {
      rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
      total, page, pageSize
    };
  }

  async counts() {
    const grouped = await this.prisma.spellingTerm.groupBy({ by: ["category"], _count: { _all: true } });
    const active = await this.prisma.spellingTerm.count({ where: { isActive: true } });
    const total = await this.prisma.spellingTerm.count();
    const byCategory: Record<string, number> = {};
    for (const g of grouped) byCategory[g.category] = g._count._all;
    return { total, active, byCategory };
  }

  async createMany(terms: Array<{ term: string; category: string; hint?: string; difficulty?: number; words?: number }>) {
    const clean = terms
      .filter((t) => t && typeof t.term === "string" && t.term.trim() && typeof t.category === "string" && t.category.trim())
      .map((t) => ({
        term: t.term.trim().slice(0, 120),
        category: t.category.trim().slice(0, 60),
        hint: (t.hint ?? "").slice(0, 200),
        difficulty: Math.min(5, Math.max(1, Number(t.difficulty) || 1)),
        words: Math.max(1, Number(t.words) || t.term.trim().split(/\s+/).length)
      }));
    if (!clean.length) return { created: 0 };
    await this.prisma.spellingTerm.createMany({ data: clean });
    return { created: clean.length };
  }

  async update(id: string, data: Partial<{ term: string; category: string; hint: string; difficulty: number; isActive: boolean }>) {
    return this.prisma.spellingTerm.update({
      where: { id },
      data: {
        ...(data.term !== undefined ? { term: data.term.slice(0, 120) } : {}),
        ...(data.category !== undefined ? { category: data.category.slice(0, 60) } : {}),
        ...(data.hint !== undefined ? { hint: data.hint.slice(0, 200) } : {}),
        ...(data.difficulty !== undefined ? { difficulty: Math.min(5, Math.max(1, data.difficulty)) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });
  }

  async remove(id: string) {
    await this.prisma.spellingTerm.delete({ where: { id } });
    return { ok: true };
  }
}
