/**
 * SkillDrillsService — the core-skill drill library + global "drill of the day".
 *
 * Admins upload a library of 60–100 self-contained interactive HTML drills per
 * module. Candidates see ONE drill per day (same for everyone), rotating every
 * 24h. Rotation is deterministic: within each full cycle through the library
 * every drill appears exactly once, in a random order that reshuffles each cycle
 * — so it feels random but never repeats until the whole library has been seen.
 */
import type { PrismaClient } from "@prisma/client";

const DAY_MS = 86_400_000;

export const DRILL_MODULES = ["part-a-core", "part-bc-core", "spellings", "part-c-podcasts"] as const;
export type DrillModule = (typeof DRILL_MODULES)[number];

export function isDrillModule(v: unknown): v is DrillModule {
  return typeof v === "string" && (DRILL_MODULES as readonly string[]).includes(v);
}

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

export class SkillDrillsService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Admin: list drills for a module (metadata only — omit the heavy html). */
  async listByModule(module: string) {
    const rows = await this.prisma.skillDrill.findMany({
      where: { module },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, displayOrder: true, isActive: true, createdAt: true, html: false }
    });
    // size for the UI without shipping the whole html back
    const sizes = await this.prisma.skillDrill.findMany({ where: { module }, select: { id: true, html: true } });
    const sizeById = new Map(sizes.map((r) => [r.id, r.html.length]));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      sizeKb: Math.round((sizeById.get(r.id) ?? 0) / 1024)
    }));
  }

  /** Admin: counts of active drills per module (for the overview). */
  async counts() {
    const grouped = await this.prisma.skillDrill.groupBy({
      by: ["module", "isActive"],
      _count: { _all: true }
    });
    const out: Record<string, { total: number; active: number }> = {};
    for (const m of DRILL_MODULES) out[m] = { total: 0, active: 0 };
    for (const g of grouped) {
      if (!out[g.module]) out[g.module] = { total: 0, active: 0 };
      out[g.module].total += g._count._all;
      if (g.isActive) out[g.module].active += g._count._all;
    }
    return out;
  }

  /** Admin: bulk-create drills for a module. */
  async createMany(module: string, drills: Array<{ title: string; html: string }>) {
    const max = await this.prisma.skillDrill.aggregate({ where: { module }, _max: { displayOrder: true } });
    let order = (max._max.displayOrder ?? -1) + 1;
    const clean = drills
      .filter((d) => d && typeof d.html === "string" && d.html.trim().length > 0)
      .map((d) => ({
        module,
        title: (d.title || "Untitled drill").slice(0, 200),
        html: d.html,
        displayOrder: order++
      }));
    if (clean.length === 0) return { created: 0 };
    await this.prisma.skillDrill.createMany({ data: clean });
    return { created: clean.length };
  }

  /** Admin: full drill (including html) for preview/edit. */
  async getOne(id: string) {
    return this.prisma.skillDrill.findUnique({ where: { id } });
  }

  async update(id: string, data: { title?: string; isActive?: boolean; displayOrder?: number }) {
    return this.prisma.skillDrill.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.slice(0, 200) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {})
      }
    });
  }

  async remove(id: string) {
    await this.prisma.skillDrill.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Candidate: the global drill of the day for a module, or null if the library
   * is empty. `now` is injectable for testing.
   */
  async drillOfDay(module: string, now: number = Date.now()) {
    const active = await this.prisma.skillDrill.findMany({
      where: { module, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, html: true }
    });
    const n = active.length;
    if (n === 0) return null;
    const dayIndex = Math.floor(now / DAY_MS); // UTC days since epoch
    const cycle = Math.floor(dayIndex / n);
    const pos = ((dayIndex % n) + n) % n;
    const perm = seededPermutation(n, cycle);
    const drill = active[perm[pos]];
    return {
      id: drill.id,
      title: drill.title,
      html: drill.html,
      total: n,
      // stable id for "today" so the client can cache / detect the daily change
      dayKey: dayIndex,
      nextRotatesInMs: (dayIndex + 1) * DAY_MS - now
    };
  }
}
