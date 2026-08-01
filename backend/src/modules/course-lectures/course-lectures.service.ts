/**
 * CourseLecturesService — per-skill lecture library for the standalone courses.
 * A lecture is unlocked for a user who owns a course including its skill;
 * playback (the signed embed) is enforced server-side.
 */
import { Skill, TestType } from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";
import type { BunnyPlaybackService } from "../media/bunny-playback.service";
import type { ProductsService } from "../products/products.service";
import { isPastPaperTestTitle } from "../past-papers/past-paper-title.utils";
import { resolveTrialAccess } from "../subscriptions/trial-access";

export class CourseLecturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyPlaybackService,
    private readonly products: ProductsService
  ) {}

  /** Published lectures, annotated with `locked` for the signed-in user. */
  async listForUser(userId: string) {
    const [ownedSkills, lectures, trial] = await Promise.all([
      this.products.getOwnedSkills(userId),
      this.prisma.courseLecture.findMany({
        where: { isPublished: true },
        orderBy: [{ skill: "asc" }, { displayOrder: "asc" }]
      }),
      resolveTrialAccess(this.prisma, userId)
    ]);
    const owned = new Set(ownedSkills);
    return {
      ownedSkills,
      isFreeTrial: trial.isTrial,
      lectures: lectures.map((l) => ({
        id: l.id,
        skill: l.skill,
        title: l.title,
        description: l.description,
        durationMin: l.durationMin,
        displayOrder: l.displayOrder,
        hasVideo: Boolean(l.bunnyVideoId || l.videoUrl),
        // Ownership FIRST, trial sample second. Written as a ternary on isTrial
        // this locked every lecture but the sample for anyone who still held a
        // STARTER row — which a single-skill course purchase does not clear.
        locked: !(owned.has(l.skill) || (trial.isTrial && l.id === trial.lectureId))
      }))
    };
  }

  /** Signed embed for a lecture — ONLY if the user owns the skill. */
  async getPlayback(userId: string, lectureId: string) {
    const lecture = await this.prisma.courseLecture.findUnique({ where: { id: lectureId } });
    if (!lecture || !lecture.isPublished) {
      throw Object.assign(new Error("Lecture not found"), { statusCode: 404 });
    }
    const [ownedSkills, trial] = await Promise.all([
      this.products.getOwnedSkills(userId),
      resolveTrialAccess(this.prisma, userId)
    ]);
    // Ownership FIRST — owning the skill must never be overridden by a leftover
    // STARTER subscription, which is what returned 403 to paying course buyers.
    const allowed = ownedSkills.includes(lecture.skill) || (trial.isTrial && lecture.id === trial.lectureId);
    if (!allowed) {
      throw Object.assign(new Error(`${lecture.skill} is not part of your plan`), { statusCode: 403 });
    }
    let embedUrl: string | null = lecture.videoUrl ?? null;
    if (lecture.bunnyVideoId) {
      try { embedUrl = this.bunny.buildEmbedUrl(lecture.bunnyVideoId, { autoplay: false }).url; }
      catch { embedUrl = lecture.videoUrl ?? null; }
    }
    return { id: lecture.id, title: lecture.title, skill: lecture.skill, embedUrl };
  }

  /**
   * Course tests for a skill — published Reading/Listening practice + mock tests
   * (past-paper tests are excluded; they live on the Past Papers page). Annotated
   * `locked` for the user by owned skill.
   */
  async listCourseTests(userId: string, skill: "READING" | "LISTENING") {
    const type = skill === "READING" ? TestType.READING : TestType.LISTENING;
    const [ownership, ppTests, tests, trial] = await Promise.all([
      this.products.getOwnership(userId),
      this.prisma.pastPaper.findMany({ select: { readingTestId: true, listeningTestId: true } }),
      this.prisma.test.findMany({
        where: { type, isPublished: true },
        select: { id: true, title: true, description: true, totalQuestions: true, timerDuration: true },
        orderBy: { createdAt: "asc" }
      }),
      resolveTrialAccess(this.prisma, userId)
    ]);
    const ppIds = new Set(ppTests.flatMap((p) => [p.readingTestId, p.listeningTestId]));
    const ownsSkill = ownership.ownedSkills.includes(skill);
    // Single-skill tier: only the tier's mock-test count is unlocked. Complete
    // (plan-driven, capped elsewhere) and legacy/retired single-skill products
    // (tierRank 0) are NOT capped here — only genuine Foundation→Mega tiers.
    const acc = ownership.skillAccess?.[skill];
    const mockLimit = acc && acc.source === "PRODUCT" && acc.tierRank > 0
      ? acc.mockTestLimit
      : Number.POSITIVE_INFINITY;
    const trialTestId = skill === "READING" ? trial.readingTestId : trial.listeningTestId;
    let unlockedCount = 0;
    const testLocked = (id: string) => {
      // Ownership FIRST. Testing isTrial first locked every test but the sample
      // for a course buyer who still carried the signup STARTER row.
      if (!ownsSkill) return !(trial.isTrial && id === trialTestId);
      if (unlockedCount >= mockLimit) return true; // over the tier's allowance
      unlockedCount += 1;
      return false;
    };
    return {
      skill,
      locked: !ownsSkill && !trial.isTrial,
      mockLimit: Number.isFinite(mockLimit) ? mockLimit : null,
      tests: tests
        .filter((t) => !ppIds.has(t.id) && !isPastPaperTestTitle(t.title))
        .map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          totalQuestions: t.totalQuestions,
          timerDuration: t.timerDuration,
          locked: testLocked(t.id)
        }))
    };
  }

  // ------------------------------------------------------------- admin
  async listAll() {
    return this.prisma.courseLecture.findMany({ orderBy: [{ skill: "asc" }, { displayOrder: "asc" }] });
  }

  async create(data: {
    skill: Skill; title: string; description?: string | null; displayOrder?: number;
    bunnyVideoId?: string | null; videoUrl?: string | null; durationMin?: number | null; isPublished?: boolean;
  }) {
    return this.prisma.courseLecture.create({
      data: {
        skill: data.skill,
        title: data.title,
        description: data.description ?? null,
        displayOrder: data.displayOrder ?? 0,
        bunnyVideoId: data.bunnyVideoId ?? null,
        videoUrl: data.videoUrl ?? null,
        durationMin: data.durationMin ?? null,
        isPublished: data.isPublished ?? false
      }
    });
  }

  async update(id: string, data: Partial<{
    skill: Skill; title: string; description: string | null; displayOrder: number;
    bunnyVideoId: string | null; videoUrl: string | null; durationMin: number | null; isPublished: boolean;
  }>) {
    const exists = await this.prisma.courseLecture.findUnique({ where: { id } });
    if (!exists) throw Object.assign(new Error("Lecture not found"), { statusCode: 404 });
    return this.prisma.courseLecture.update({ where: { id }, data });
  }

  async remove(id: string) {
    const exists = await this.prisma.courseLecture.findUnique({ where: { id } });
    if (!exists) throw Object.assign(new Error("Lecture not found"), { statusCode: 404 });
    await this.prisma.courseLecture.delete({ where: { id } });
    return { ok: true };
  }
}
