/**
 * ListeningPodcastsService — the daily listening-podcast library + global
 * "podcast of the day", plus per-student listen tracking (streak / count).
 *
 * Admins upload a library of ~100+ podcasts (audio file or hosted URL).
 * Candidates get ONE podcast per day (same for everyone), rotating every 24h
 * with the same deterministic algorithm as SkillDrill. When a student finishes
 * the day's podcast we record a PodcastListen row (one per user per UTC day).
 */
import type { PrismaClient } from "@prisma/client";
import type { StorageService } from "../storage/storage.service";

const DAY_MS = 86_400_000;

export type PodcastInput = {
  kicker?: string | null;
  title: string;
  description?: string | null;
  audioAssetId?: string | null;
  audioUrl?: string | null;
  durationSec?: number | null;
};

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

type PodcastRow = { id: string; audioAssetId: string | null; audioUrl: string | null };

export class ListeningPodcastsService {
  constructor(private readonly prisma: PrismaClient, private readonly storage: StorageService) {}

  private async resolveAudioUrl(p: PodcastRow): Promise<string | null> {
    if (p.audioAssetId) {
      const asset = await this.storage.getSignedAsset(p.audioAssetId);
      if (asset?.signedUrl) return asset.signedUrl;
    }
    return p.audioUrl && p.audioUrl.trim() ? p.audioUrl.trim() : null;
  }

  /** Admin: list podcasts (metadata + whether audio is attached). */
  async list() {
    const rows = await this.prisma.listeningPodcast.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, kicker: true, title: true, description: true, audioAssetId: true, audioUrl: true, durationSec: true, displayOrder: true, isActive: true, createdAt: true }
    });
    return rows.map((r) => ({
      id: r.id,
      kicker: r.kicker,
      title: r.title,
      description: r.description,
      durationSec: r.durationSec,
      hasAudio: !!(r.audioAssetId || (r.audioUrl && r.audioUrl.trim())),
      audioKind: r.audioAssetId ? ("asset" as const) : r.audioUrl ? ("url" as const) : null,
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString()
    }));
  }

  async counts() {
    const [total, active] = await Promise.all([
      this.prisma.listeningPodcast.count(),
      this.prisma.listeningPodcast.count({ where: { isActive: true } })
    ]);
    return { total, active };
  }

  /** Admin: bulk-create podcasts (from uploaded files and/or pasted URLs). */
  async createMany(podcasts: PodcastInput[]) {
    const max = await this.prisma.listeningPodcast.aggregate({ _max: { displayOrder: true } });
    let order = (max._max.displayOrder ?? -1) + 1;
    const clean = (Array.isArray(podcasts) ? podcasts : [])
      .filter((p) => p && typeof p.title === "string" && p.title.trim().length > 0 && (p.audioAssetId || (typeof p.audioUrl === "string" && p.audioUrl.trim().length > 0)))
      .map((p) => ({
        kicker: trimOrNull(p.kicker),
        title: p.title.trim().slice(0, 300),
        description: trimOrNull(p.description),
        audioAssetId: trimOrNull(p.audioAssetId),
        audioUrl: p.audioAssetId ? null : trimOrNull(p.audioUrl),
        durationSec: typeof p.durationSec === "number" && p.durationSec > 0 ? Math.round(p.durationSec) : null,
        displayOrder: order++
      }));
    if (clean.length === 0) return { created: 0 };
    await this.prisma.listeningPodcast.createMany({ data: clean });
    return { created: clean.length };
  }

  async getOne(id: string) {
    const p = await this.prisma.listeningPodcast.findUnique({ where: { id } });
    if (!p) return null;
    return { ...p, resolvedAudioUrl: await this.resolveAudioUrl(p) };
  }

  async update(id: string, data: Partial<PodcastInput & { isActive: boolean; displayOrder: number }>) {
    // audio: if a new asset is given, clear url; if a url is given (no asset), clear asset.
    const audioPatch: { audioAssetId?: string | null; audioUrl?: string | null } = {};
    if (data.audioAssetId !== undefined) { audioPatch.audioAssetId = trimOrNull(data.audioAssetId); if (audioPatch.audioAssetId) audioPatch.audioUrl = null; }
    if (data.audioUrl !== undefined && !data.audioAssetId) { audioPatch.audioUrl = trimOrNull(data.audioUrl); if (audioPatch.audioUrl) audioPatch.audioAssetId = null; }
    return this.prisma.listeningPodcast.update({
      where: { id },
      data: {
        ...(data.kicker !== undefined ? { kicker: trimOrNull(data.kicker) } : {}),
        ...(data.title !== undefined ? { title: data.title.slice(0, 300) } : {}),
        ...(data.description !== undefined ? { description: trimOrNull(data.description) } : {}),
        ...(data.durationSec !== undefined ? { durationSec: typeof data.durationSec === "number" && data.durationSec > 0 ? Math.round(data.durationSec) : null } : {}),
        ...audioPatch,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {})
      }
    });
  }

  async remove(id: string) {
    await this.prisma.podcastListen.deleteMany({ where: { podcastId: id } });
    await this.prisma.listeningPodcast.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------- candidate ----------------

  private pickForDay<T>(active: T[], dayIndex: number): T {
    const n = active.length;
    const cycle = Math.floor(dayIndex / n);
    const pos = ((dayIndex % n) + n) % n;
    const perm = seededPermutation(n, cycle);
    return active[perm[pos]];
  }

  /** Per-student listen stats: total distinct podcasts, streak, and today. */
  private async listenStats(userId: string, todayIndex: number) {
    const listens = await this.prisma.podcastListen.findMany({ where: { userId }, select: { dayKey: true, podcastId: true } });
    const days = new Set(listens.map((l) => l.dayKey));
    const listenedToday = days.has(todayIndex);
    let streak = 0;
    let d = listenedToday ? todayIndex : todayIndex - 1;
    while (days.has(d)) { streak += 1; d -= 1; }
    const count = new Set(listens.map((l) => l.podcastId)).size;
    return { listenedToday, streak, count };
  }

  async podcastOfDay(userId: string, now: number = Date.now()) {
    const active = await this.prisma.listeningPodcast.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, kicker: true, title: true, description: true, durationSec: true, audioAssetId: true, audioUrl: true }
    });
    const n = active.length;
    if (n === 0) return null;
    const dayIndex = Math.floor(now / DAY_MS);
    const p = this.pickForDay(active, dayIndex);
    const audioUrl = await this.resolveAudioUrl(p);
    const stats = await this.listenStats(userId, dayIndex);
    return {
      id: p.id,
      kicker: p.kicker,
      title: p.title,
      description: p.description,
      durationSec: p.durationSec,
      audioUrl,
      total: n,
      dayKey: dayIndex,
      nextRotatesInMs: (dayIndex + 1) * DAY_MS - now,
      ...stats
    };
  }

  /** Record that the student finished today's podcast. Idempotent per day. */
  async markListened(userId: string, now: number = Date.now()) {
    const active = await this.prisma.listeningPodcast.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true }
    });
    const dayIndex = Math.floor(now / DAY_MS);
    if (active.length > 0) {
      const p = this.pickForDay(active, dayIndex);
      await this.prisma.podcastListen.upsert({
        where: { userId_dayKey: { userId, dayKey: dayIndex } },
        create: { userId, dayKey: dayIndex, podcastId: p.id },
        update: { podcastId: p.id, listenedAt: new Date(now) }
      });
    }
    return this.listenStats(userId, dayIndex);
  }
}
