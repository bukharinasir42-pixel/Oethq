/**
 * OetImportService — the contentJson-driven OET test subsystem: one-paste import
 * (admin), plus the candidate take/submit/review flow with official OET scoring.
 * Imported tests live as normal `Test` rows (so they appear in course-tests
 * lists, past-paper bundles and publish gating) but are rendered + scored from
 * their `contentJson` document instead of Question rows.
 */
import { AttemptSection, AttemptStatus, Prisma, TestType } from "@prisma/client";
import type { PrismaService } from "../../../common/prisma.service";
import type { ProductsService } from "../../products/products.service";
import type { GradingService } from "../../grading/grading.service";
import type { StorageService } from "../../storage/storage.service";
import { resolveTrialAccess } from "../../subscriptions/trial-access";
import { validateOetImport } from "./oet-test-validator";
import { scoreOetAttempt, oetGradeLabel } from "./oet-scoring";
import type { OetTestImport, OetQuestion } from "./oet-test-schema";
import { MAX_PAST_PAPERS, isPastPaperTestTitle } from "../../past-papers/past-paper-title.utils";

function httpError(message: string, statusCode: number, extra?: Record<string, unknown>) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

/** Remove the answer key from a doc before sending it to a candidate. */
function stripAnswers(doc: OetTestImport): OetTestImport {
  const clone: OetTestImport = JSON.parse(JSON.stringify(doc));
  const scrub = (q: Partial<OetQuestion> & Record<string, unknown>) => {
    delete (q as { answer?: unknown }).answer;
  };
  if (clone.type === "READING") {
    clone.partA.questions.forEach(scrub);
    clone.partB.items.forEach(scrub);
    clone.partC.texts.forEach((t) => t.questions.forEach(scrub));
  } else {
    clone.partA.extracts.forEach((e) => e.questions.forEach(scrub));
    clone.partB.items.forEach(scrub);
    clone.partC.extracts.forEach((e) => e.questions.forEach(scrub));
  }
  return clone;
}

export class OetImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly grading: GradingService,
    private readonly storage: StorageService
  ) {}

  // ------------------------------------------------------------- audio

  /**
   * Resolve the single session-audio URL for a listening test. An uploaded file
   * (Test.audioAssetId → signed URL) wins; otherwise a pasted URL kept on the
   * contentJson document (`audioUrl`). Returns null when no audio is attached.
   */
  private async resolveAudioUrl(test: {
    audioAssetId: string | null;
    contentJson: unknown;
  }): Promise<string | null> {
    if (test.audioAssetId) {
      const asset = await this.storage.getSignedAsset(test.audioAssetId);
      if (asset?.signedUrl) return asset.signedUrl;
    }
    const doc = test.contentJson as { type?: string; audioUrl?: string } | null;
    if (doc && doc.type === "LISTENING" && typeof doc.audioUrl === "string" && doc.audioUrl.trim()) {
      return doc.audioUrl.trim();
    }
    return null;
  }

  /** Current audio state for the admin screen (kind + resolved url + label). */
  async getAudio(testId: string) {
    const test = await this.loadImported(testId);
    if (test.type !== TestType.LISTENING) {
      return { kind: null as null | "asset" | "url", url: null as string | null, title: null as string | null };
    }
    if (test.audioAssetId) {
      const asset = await this.storage.getSignedAsset(test.audioAssetId);
      return { kind: "asset" as const, url: asset?.signedUrl ?? null, title: asset?.title ?? "Uploaded audio" };
    }
    const url = await this.resolveAudioUrl(test);
    return { kind: url ? ("url" as const) : null, url, title: url ? "Linked URL" : null };
  }

  /**
   * Attach / replace / remove the listening session audio.
   *  - `audioAssetId` (from a prior file upload) → stored on the Test row.
   *  - `audioUrl` (pasted link) → stored on the contentJson document.
   *  - both empty → audio removed.
   * The two sources are mutually exclusive; setting one clears the other.
   */
  async setAudio(testId: string, input: { audioAssetId?: string | null; audioUrl?: string | null }) {
    const test = await this.loadImported(testId);
    if (test.type !== TestType.LISTENING) {
      throw httpError("Audio can only be attached to a listening test", 400);
    }
    const assetId = input.audioAssetId?.trim() || null;
    const url = input.audioUrl?.trim() || null;

    const doc = JSON.parse(JSON.stringify(test.contentJson)) as { audioUrl?: string };
    if (assetId) {
      delete doc.audioUrl; // uploaded file takes over; drop any pasted url
    } else if (url) {
      doc.audioUrl = url;
    } else {
      delete doc.audioUrl; // removal
    }

    await this.prisma.test.update({
      where: { id: testId },
      data: {
        audioAssetId: assetId,
        contentJson: doc as unknown as Prisma.InputJsonValue
      }
    });
    return this.getAudio(testId);
  }

  // ------------------------------------------------------------- admin import

  /** Validate a pasted JSON blob and create (or replace) a draft Test. */
  async importTest(rawJson: unknown, testId?: string) {
    let parsed: unknown = rawJson;
    if (typeof rawJson === "string") {
      try {
        parsed = JSON.parse(rawJson);
      } catch (e) {
        throw httpError(`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`, 400);
      }
    }
    const result = validateOetImport(parsed);
    if (!result.ok) {
      throw httpError("The pasted test has validation errors.", 422, { errors: result.errors });
    }
    const doc = result.doc;
    const isReading = doc.type === "READING";
    const data = {
      type: doc.type as TestType,
      title: doc.title.trim(),
      description: doc.description ?? null,
      instructions: doc.instructions ?? null,
      totalQuestions: result.totalQuestions,
      timerDuration: Math.max(1, Math.round(doc.timing.totalMinutes)),
      partATimer: isReading ? doc.timing.partAMinutes ?? 15 : null,
      partBCTimer: isReading ? doc.timing.partBCMinutes ?? 45 : null,
      contentJson: doc as unknown as Prisma.InputJsonValue,
      contentSchemaVersion: doc.schemaVersion
    };

    let test;
    if (testId) {
      const existing = await this.prisma.test.findUnique({ where: { id: testId } });
      if (!existing) throw httpError("Test not found", 404);
      test = await this.prisma.test.update({ where: { id: testId }, data });
    } else {
      test = await this.prisma.test.create({ data: { ...data, isPublished: false } });
    }
    return { id: test.id, type: test.type, title: test.title, totalQuestions: test.totalQuestions, isPublished: test.isPublished };
  }

  private buildTestData(doc: OetTestImport, titleOverride?: string, totalQuestions?: number) {
    const isReading = doc.type === "READING";
    return {
      type: doc.type as TestType,
      title: (titleOverride ?? doc.title).trim(),
      description: doc.description ?? null,
      instructions: doc.instructions ?? null,
      totalQuestions: totalQuestions ?? 42,
      timerDuration: Math.max(1, Math.round(doc.timing.totalMinutes)),
      partATimer: isReading ? doc.timing.partAMinutes ?? 15 : null,
      partBCTimer: isReading ? doc.timing.partBCMinutes ?? 45 : null,
      contentJson: doc as unknown as Prisma.InputJsonValue,
      contentSchemaVersion: doc.schemaVersion
    };
  }

  /**
   * Import a full past paper in one go: paste a READING JSON + a LISTENING JSON.
   * Creates two imported Test rows (titled so they're excluded from the
   * standalone course-test lists) and bundles them into a draft PastPaper.
   */
  async importPastPaper(input: { readingJson: unknown; listeningJson: unknown; title?: string }) {
    const parse = (v: unknown) => {
      if (typeof v !== "string") return v;
      try { return JSON.parse(v); } catch (e) {
        throw httpError(`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`, 400);
      }
    };
    const r = validateOetImport(parse(input.readingJson));
    const l = validateOetImport(parse(input.listeningJson));
    const errors: string[] = [];
    if (!r.ok) errors.push(...r.errors.map((e) => `Reading: ${e}`));
    else if (r.doc.type !== "READING") errors.push("The reading slot must contain a READING test.");
    if (!l.ok) errors.push(...l.errors.map((e) => `Listening: ${e}`));
    else if (l.doc.type !== "LISTENING") errors.push("The listening slot must contain a LISTENING test.");
    if (errors.length) throw httpError("The past paper has validation errors.", 422, { errors });

    const count = await this.prisma.pastPaper.count();
    if (count >= MAX_PAST_PAPERS) throw httpError(`Cannot create more than ${MAX_PAST_PAPERS} past papers`, 400);

    let title = (input.title?.trim() || `Past Paper ${count + 1}`).trim();
    if (!isPastPaperTestTitle(title)) title = `Past Paper — ${title}`;

    const readingDoc = (r as { doc: OetTestImport }).doc;
    const listeningDoc = (l as { doc: OetTestImport }).doc;

    const created = await this.prisma.$transaction(async (tx) => {
      const readingTest = await tx.test.create({
        data: { ...this.buildTestData(readingDoc, `${title} — Reading`, (r as { totalQuestions: number }).totalQuestions), isPublished: false }
      });
      const listeningTest = await tx.test.create({
        data: { ...this.buildTestData(listeningDoc, `${title} — Listening`, (l as { totalQuestions: number }).totalQuestions), isPublished: false }
      });
      return tx.pastPaper.create({
        data: { title, listeningTestId: listeningTest.id, readingTestId: readingTest.id, isPublished: false }
      });
    });
    return { id: created.id, title: created.title, isPublished: created.isPublished };
  }

  /** Dry-run validation only (no DB write) — for live paste feedback. */
  validateOnly(rawJson: unknown) {
    let parsed: unknown = rawJson;
    if (typeof rawJson === "string") {
      try {
        parsed = JSON.parse(rawJson);
      } catch (e) {
        return { ok: false as const, errors: [`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`] };
      }
    }
    const result = validateOetImport(parsed);
    if (!result.ok) return { ok: false as const, errors: result.errors };
    return {
      ok: true as const,
      type: result.doc.type,
      title: result.doc.title,
      totalQuestions: result.totalQuestions
    };
  }

  /** Admin detail for an imported test (meta + full content for preview). */
  async getAdmin(testId: string) {
    const test = await this.loadImported(testId);
    const audio =
      test.type === TestType.LISTENING
        ? test.audioAssetId
          ? await (async () => {
              const asset = await this.storage.getSignedAsset(test.audioAssetId as string);
              return { kind: "asset" as const, url: asset?.signedUrl ?? null, title: asset?.title ?? "Uploaded audio" };
            })()
          : await (async () => {
              const url = await this.resolveAudioUrl(test);
              return { kind: url ? ("url" as const) : null, url, title: url ? "Linked URL" : null };
            })()
        : null;
    return {
      id: test.id,
      type: test.type,
      title: test.title,
      description: test.description,
      totalQuestions: test.totalQuestions,
      timerDuration: test.timerDuration,
      partATimer: test.partATimer,
      partBCTimer: test.partBCTimer,
      isPublished: test.isPublished,
      contentSchemaVersion: test.contentSchemaVersion,
      audio,
      content: test.contentJson as unknown as OetTestImport
    };
  }

  // ------------------------------------------------------------- candidate

  private async loadImported(testId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test || !test.contentJson) throw httpError("Test not found", 404);
    return test;
  }

  private async assertAccess(userId: string, type: TestType, isPublished: boolean, isAdmin: boolean, testId?: string) {
    if (isAdmin) return;
    if (!isPublished) throw httpError("This test is not available yet", 403);
    const skills = await this.products.getOwnedSkills(userId);
    if (skills.includes(type)) return;
    // Free trial: allow exactly the one sample Reading / Listening test.
    const trial = await resolveTrialAccess(this.prisma, userId);
    if (trial.isTrial && testId) {
      const allowedId = type === TestType.READING ? trial.readingTestId : trial.listeningTestId;
      if (allowedId && testId === allowedId) return;
    }
    throw httpError(`${type === TestType.READING ? "Reading" : "Listening"} is not part of your plan`, 403);
  }

  /** Candidate-facing test payload (answer key stripped) + any in-progress attempt. */
  async getPlayable(testId: string, userId: string, isAdmin: boolean) {
    const test = await this.loadImported(testId);
    await this.assertAccess(userId, test.type, test.isPublished, isAdmin, test.id);
    const doc = test.contentJson as unknown as OetTestImport;
    const attempt = await this.prisma.testAttempt.findFirst({
      where: { testId, userId, status: AttemptStatus.IN_PROGRESS },
      orderBy: { startedAt: "desc" }
    });
    const audioUrl = test.type === TestType.LISTENING ? await this.resolveAudioUrl(test) : null;
    return {
      test: {
        id: test.id,
        type: test.type,
        title: test.title,
        timerDuration: test.timerDuration,
        partATimer: test.partATimer,
        partBCTimer: test.partBCTimer,
        audioUrl
      },
      content: stripAnswers(doc),
      attempt: attempt
        ? {
            id: attempt.id,
            expiresAt: attempt.expiresAt,
            answers: (attempt.answersJson as Record<string, string> | null) ?? {},
            startedAt: attempt.startedAt
          }
        : null
    };
  }

  /** Start a fresh attempt (or resume the open one). */
  async startAttempt(testId: string, userId: string, isAdmin: boolean) {
    const test = await this.loadImported(testId);
    await this.assertAccess(userId, test.type, test.isPublished, isAdmin, test.id);
    const open = await this.prisma.testAttempt.findFirst({
      where: { testId, userId, status: AttemptStatus.IN_PROGRESS },
      orderBy: { startedAt: "desc" }
    });
    if (open && open.expiresAt.getTime() > Date.now()) {
      return { attemptId: open.id, expiresAt: open.expiresAt, answers: (open.answersJson as Record<string, string>) ?? {} };
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + test.timerDuration * 60 * 1000);
    // A student who has already read the explanations for this paper knows the
    // answers. They are welcome to re-sit it, but the score is not evidence of
    // anything and must not reach progress or the Pass Predictor.
    const seenAnswers = await this.prisma.explanationView.findUnique({
      where: { userId_testId: { userId, testId } },
      select: { id: true }
    });
    const attempt = await this.prisma.testAttempt.create({
      data: {
        userId,
        testId,
        status: AttemptStatus.IN_PROGRESS,
        section: AttemptSection.COMPLETE,
        startedAt: now,
        expiresAt,
        answersJson: {},
        isPractice: Boolean(seenAnswers)
      }
    });
    return { attemptId: attempt.id, expiresAt, answers: {}, isPractice: Boolean(seenAnswers) };
  }

  async saveProgress(attemptId: string, userId: string, answers: Record<string, string>) {
    const attempt = await this.prisma.testAttempt.findFirst({ where: { id: attemptId, userId } });
    if (!attempt) throw httpError("Attempt not found", 404);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) return { ok: true, alreadyFinal: true };
    await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: { answersJson: answers as Prisma.InputJsonValue, questionCountAnswered: Object.values(answers).filter(Boolean).length }
    });
    return { ok: true };
  }

  /** Submit + grade (official OET) and persist the result. */
  async submitAttempt(attemptId: string, userId: string, answers: Record<string, string>, auto = false) {
    const attempt = await this.prisma.testAttempt.findFirst({ where: { id: attemptId, userId }, include: { test: true } });
    if (!attempt) throw httpError("Attempt not found", 404);
    if (!attempt.test.contentJson) throw httpError("Not an imported test", 400);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      return this.getResult(attemptId, userId);
    }
    const doc = attempt.test.contentJson as unknown as OetTestImport;
    const merged = { ...((attempt.answersJson as Record<string, string>) ?? {}), ...answers };
    const scored = scoreOetAttempt(doc, merged);
    // Existing N.A.S.I.R. band still populated for the required TestResult column.
    const band = this.grading.getBandForScore(scored.correct);
    const now = new Date();

    await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: auto ? AttemptStatus.AUTO_SUBMITTED : AttemptStatus.SUBMITTED,
        submittedAt: now,
        autoSubmittedAt: auto ? now : null,
        answersJson: merged as Prisma.InputJsonValue,
        score: scored.correct,
        partAScore: scored.partACorrect,
        partBScore: scored.partBCorrect,
        partCScore: scored.partCCorrect,
        scaledScore: scored.scaledScore,
        oetGrade: scored.grade,
        bandLabel: band.label,
        passProbability: band.passProbability
      }
    });

    await this.prisma.testResult.upsert({
      where: { userId_testId: { userId, testId: attempt.testId } },
      create: {
        userId,
        testId: attempt.testId,
        latestAttemptId: attemptId,
        score: scored.correct,
        partAScore: scored.partACorrect,
        partBScore: scored.partBCorrect,
        partCScore: scored.partCCorrect,
        scaledScore: scored.scaledScore,
        oetGrade: scored.grade,
        bandLabel: band.label,
        passProbability: band.passProbability,
        completedAt: now
      },
      update: {
        latestAttemptId: attemptId,
        score: scored.correct,
        partAScore: scored.partACorrect,
        partBScore: scored.partBCorrect,
        partCScore: scored.partCCorrect,
        scaledScore: scored.scaledScore,
        oetGrade: scored.grade,
        bandLabel: band.label,
        passProbability: band.passProbability,
        completedAt: now,
        attemptsCount: { increment: 1 }
      }
    });

    return this.getResult(attemptId, userId);
  }

  /** Full result + review (correct answers revealed) for a submitted attempt. */
  async getResult(attemptId: string, userId: string) {
    const attempt = await this.prisma.testAttempt.findFirst({ where: { id: attemptId, userId }, include: { test: true } });
    if (!attempt) throw httpError("Attempt not found", 404);
    const doc = attempt.test.contentJson as unknown as OetTestImport;
    const answers = (attempt.answersJson as Record<string, string>) ?? {};
    const scored = scoreOetAttempt(doc, answers);
    return {
      attemptId: attempt.id,
      testId: attempt.testId,
      title: attempt.test.title,
      type: attempt.test.type,
      status: attempt.status,
      submitted: attempt.status !== AttemptStatus.IN_PROGRESS,
      answers,
      scaledScore: scored.scaledScore,
      grade: scored.grade,
      gradeLabel: oetGradeLabel(scored.grade),
      pass: scored.pass,
      correct: scored.correct,
      total: scored.total,
      partACorrect: scored.partACorrect,
      partBCorrect: scored.partBCorrect,
      partCCorrect: scored.partCCorrect,
      perQuestion: scored.perQuestion,
      // full content WITH answers for the review screen
      content: doc
    };
  }
}
