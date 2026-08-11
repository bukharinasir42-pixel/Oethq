import { ExplanationStatus, Prisma, QuestionPart, TestType } from "@prisma/client";
import type { PrismaService } from "../../../common/prisma.service";

/**
 * explanations.service.ts — why the answer is the answer.
 *
 * Explanations reach students through two doors, and they are trusted
 * differently.
 *
 *  1. **Embedded in the paper's JSON.** The owner authors them alongside the
 *     paper. Published on import, because typing them into the import file and
 *     typing them into an admin form are the same act by the same person.
 *  2. **Drafted by Claude** for papers that predate the format. Held as DRAFT
 *     until a human approves. An explanation sits directly beside an answer key,
 *     so students read it as authoritative; one confidently wrong account of why
 *     an option is a distractor does more damage than having none at all.
 *
 * A student is never served a DRAFT. That rule lives here, not in the UI.
 */

export type OptionVerdict = "correct" | "distractor" | "partial";

export type ParsedExplanation = {
  evidence: string;
  evidenceLetter?: string | null;
  reasoning: string;
  stemFocus?: string | null;
  questionType?: string | null;
  difficulty?: string | null;
  counterfactual?: string | null;
  lesson?: string | null;
  skillTag?: string | null;
  options?: Record<string, { verdict: OptionVerdict; trap?: string; why: string }> | null;
};

/** The named distractor taxonomy. Anything outside it is dropped, not guessed. */
const TRAPS = new Set([
  "wrong_referent", "adjacent_entity", "partial_support", "superseded", "true_not_asked",
  "lexical_lure", "unstated_state", "absolute_language", "unlicensed_ranking",
  "sufficiency_overclaim", "function_mismatch", "speaker_attribution", "over_inference",
  "direct_information", "near_miss_form"
]);

const QUESTION_TYPES = new Set([
  "fact", "main_idea", "purpose", "inference", "reference",
  "vocabulary", "tone", "comparison", "cause_effect", "detail"
]);

const DIFFICULTIES = new Set(["C1", "C2", "C3"]);

const VERDICTS = new Set<OptionVerdict>(["correct", "distractor", "partial"]);

function clean(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Validate one explanation from untrusted JSON.
 *
 * Returns null rather than throwing: one malformed explanation in a 42-question
 * paper must not block the import of the paper. The count of what was accepted
 * is reported back so a silent shortfall is visible.
 */
export function parseExplanation(raw: unknown): ParsedExplanation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const evidence = clean(o.evidence);
  const reasoning = clean(o.reasoning);
  // Both are required. An "explanation" with no evidence is an assertion, and
  // the entire point of this feature is showing the student where it came from.
  if (!evidence || !reasoning) return null;

  const letter = clean(o.evidenceLetter, 1);
  const options: Record<string, { verdict: OptionVerdict; trap?: string; why: string }> = {};
  if (o.options && typeof o.options === "object") {
    for (const [key, value] of Object.entries(o.options as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      const verdict = clean(v.verdict, 20)?.toLowerCase() as OptionVerdict | undefined;
      const why = clean(v.why, 2000);
      if (!verdict || !VERDICTS.has(verdict) || !why) continue;
      // An unrecognised trap name is dropped rather than stored. The taxonomy is
      // the teaching, and a made-up category would teach the wrong shape.
      const trapRaw = clean(v.trap, 40)?.toLowerCase().replace(/[\s-]+/g, "_");
      const trap = trapRaw && TRAPS.has(trapRaw) ? trapRaw : undefined;
      options[key.trim().toUpperCase().slice(0, 2)] = { verdict, ...(trap ? { trap } : {}), why };
    }
  }

  const qt = clean(o.questionType, 30)?.toLowerCase().replace(/[\s-]+/g, "_");
  const diff = clean(o.difficulty, 4)?.toUpperCase();

  return {
    evidence,
    evidenceLetter: letter && /^[A-D]$/i.test(letter) ? letter.toUpperCase() : null,
    reasoning,
    stemFocus: clean(o.stemFocus, 500),
    questionType: qt && QUESTION_TYPES.has(qt) ? qt : null,
    difficulty: diff && DIFFICULTIES.has(diff) ? diff : null,
    counterfactual: clean(o.counterfactual, 1000),
    lesson: clean(o.lesson, 1000),
    skillTag: clean(o.skillTag, 60),
    options: Object.keys(options).length > 0 ? options : null
  };
}

/** Every question in a reading paper, flattened, with its explanation if present. */
export function walkQuestions(content: unknown): Array<{ n: number; part: QuestionPart; explanation: unknown }> {
  const c = content as {
    partA?: { questions?: Array<{ n: number; explanation?: unknown }> };
    partB?: { items?: Array<{ n: number; explanation?: unknown }> };
    partC?: { texts?: Array<{ questions?: Array<{ n: number; explanation?: unknown }> }> };
  };
  const out: Array<{ n: number; part: QuestionPart; explanation: unknown }> = [];
  for (const q of c?.partA?.questions ?? []) out.push({ n: q.n, part: QuestionPart.A, explanation: q.explanation });
  for (const q of c?.partB?.items ?? []) out.push({ n: q.n, part: QuestionPart.B, explanation: q.explanation });
  for (const t of c?.partC?.texts ?? []) {
    for (const q of t.questions ?? []) out.push({ n: q.n, part: QuestionPart.C, explanation: q.explanation });
  }
  return out;
}

export class ExplanationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist explanations that arrived inside a paper's JSON.
   *
   * Published immediately: the owner wrote them. Existing rows are updated
   * UNLESS a human has edited them here, which a re-import must not silently
   * discard — that edit is the most considered version of the text that exists.
   */
  async saveFromImport(testId: string, content: unknown): Promise<{ saved: number; skipped: number }> {
    const questions = walkQuestions(content);
    let saved = 0;
    let skipped = 0;

    for (const q of questions) {
      if (q.explanation === undefined || q.explanation === null) continue;
      const parsed = parseExplanation(q.explanation);
      if (!parsed) {
        skipped++;
        continue;
      }
      const existing = await this.prisma.testExplanation.findUnique({
        where: { testId_questionNumber: { testId, questionNumber: q.n } },
        select: { id: true, editedAt: true }
      });
      if (existing?.editedAt) {
        skipped++;
        continue;
      }

      const data = {
        part: q.part,
        evidence: parsed.evidence,
        evidenceLetter: parsed.evidenceLetter ?? null,
        reasoning: parsed.reasoning,
        stemFocus: parsed.stemFocus ?? null,
        questionType: parsed.questionType ?? null,
        difficulty: parsed.difficulty ?? null,
        counterfactual: parsed.counterfactual ?? null,
        lesson: parsed.lesson ?? null,
        skillTag: parsed.skillTag ?? null,
        options: (parsed.options ?? Prisma.DbNull) as Prisma.InputJsonValue,
        status: ExplanationStatus.APPROVED,
        approvedAt: new Date(),
        model: null,
        generatedAt: null
      };
      await this.prisma.testExplanation.upsert({
        where: { testId_questionNumber: { testId, questionNumber: q.n } },
        create: { testId, questionNumber: q.n, ...data },
        update: data
      });
      saved++;
    }
    return { saved, skipped };
  }

  /** Approved explanations for a paper, keyed by question number. */
  async forStudent(testId: string) {
    const rows = await this.prisma.testExplanation.findMany({
      where: { testId, status: ExplanationStatus.APPROVED },
      orderBy: { questionNumber: "asc" }
    });
    return rows.map((r) => ({
      questionNumber: r.questionNumber,
      part: r.part,
      evidence: r.evidence,
      evidenceLetter: r.evidenceLetter,
      reasoning: r.reasoning,
      stemFocus: r.stemFocus,
      questionType: r.questionType,
      difficulty: r.difficulty,
      counterfactual: r.counterfactual,
      lesson: r.lesson,
      skillTag: r.skillTag,
      options:
        (r.options as Record<string, { verdict: OptionVerdict; trap?: string; why: string }> | null) ?? null
    }));
  }

  /** How many of a paper's questions have an approved explanation. */
  async coverage(testId: string) {
    const [approved, draft] = await Promise.all([
      this.prisma.testExplanation.count({ where: { testId, status: ExplanationStatus.APPROVED } }),
      this.prisma.testExplanation.count({ where: { testId, status: ExplanationStatus.DRAFT } })
    ]);
    return { approved, draft };
  }

  /**
   * Record that a student opened the explanations.
   *
   * From this moment every LATER attempt at this paper is practice. Idempotent:
   * looking twice is still one act of looking.
   */
  async recordView(userId: string, testId: string) {
    await this.prisma.explanationView.upsert({
      where: { userId_testId: { userId, testId } },
      create: { userId, testId },
      update: {}
    });
  }

  /** True once this student has seen the answers for this paper. */
  async hasViewed(userId: string, testId: string): Promise<boolean> {
    const row = await this.prisma.explanationView.findUnique({
      where: { userId_testId: { userId, testId } },
      select: { id: true }
    });
    return Boolean(row);
  }

  // -------------------------------------------------------------------- admin

  async listForAdmin(testId: string) {
    const rows = await this.prisma.testExplanation.findMany({
      where: { testId },
      orderBy: { questionNumber: "asc" }
    });
    return rows;
  }

  async approve(id: string, adminId: string) {
    return this.prisma.testExplanation.update({
      where: { id },
      data: { status: ExplanationStatus.APPROVED, approvedAt: new Date(), approvedById: adminId }
    });
  }

  async approveAll(testId: string, adminId: string) {
    const out = await this.prisma.testExplanation.updateMany({
      where: { testId, status: ExplanationStatus.DRAFT },
      data: { status: ExplanationStatus.APPROVED, approvedAt: new Date(), approvedById: adminId }
    });
    return { approved: out.count };
  }

  async unapprove(id: string) {
    return this.prisma.testExplanation.update({
      where: { id },
      data: { status: ExplanationStatus.DRAFT, approvedAt: null, approvedById: null }
    });
  }

  /** An admin editing the text by hand. Marks it so a re-import cannot undo it. */
  async edit(id: string, patch: Partial<ParsedExplanation>) {
    const data: Prisma.TestExplanationUpdateInput = { editedAt: new Date() };
    if (patch.evidence !== undefined) data.evidence = clean(patch.evidence) ?? "";
    if (patch.reasoning !== undefined) data.reasoning = clean(patch.reasoning) ?? "";
    if (patch.evidenceLetter !== undefined) data.evidenceLetter = patch.evidenceLetter ?? null;
    if (patch.skillTag !== undefined) data.skillTag = patch.skillTag ?? null;
    if (patch.options !== undefined) data.options = (patch.options ?? Prisma.DbNull) as Prisma.InputJsonValue;
    return this.prisma.testExplanation.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.testExplanation.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * A paper as an import-shaped JSON file, with its explanations merged back
   * into the questions they belong to.
   *
   * The round trip is the point: export a paper, add or improve explanations in
   * the file, re-import it. Without this the only copy of a paper in the import
   * format is whatever file happened to be used to create it, which after a year
   * of edits is nobody's idea of a source of truth.
   */
  async exportPaper(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { id: true, type: true, title: true, description: true, contentJson: true }
    });
    if (!test?.contentJson) {
      throw Object.assign(new Error("That paper has no imported content to export."), { statusCode: 404 });
    }

    const rows = await this.prisma.testExplanation.findMany({ where: { testId } });
    const byNumber = new Map(rows.map((r) => [r.questionNumber, r]));

    // Deep clone so the stored contentJson is never mutated by this read path.
    const content = JSON.parse(JSON.stringify(test.contentJson)) as Record<string, unknown>;

    const attach = (q: Record<string, unknown>) => {
      const row = byNumber.get(Number(q.n));
      if (!row) return;
      q.explanation = {
        evidence: row.evidence,
        ...(row.evidenceLetter ? { evidenceLetter: row.evidenceLetter } : {}),
        reasoning: row.reasoning,
        ...(row.stemFocus ? { stemFocus: row.stemFocus } : {}),
        ...(row.questionType ? { questionType: row.questionType } : {}),
        ...(row.difficulty ? { difficulty: row.difficulty } : {}),
        ...(row.counterfactual ? { counterfactual: row.counterfactual } : {}),
        ...(row.lesson ? { lesson: row.lesson } : {}),
        ...(row.skillTag ? { skillTag: row.skillTag } : {}),
        ...(row.options ? { options: row.options } : {})
      };
    };

    const partA = content.partA as { questions?: Array<Record<string, unknown>> } | undefined;
    partA?.questions?.forEach(attach);
    const partB = content.partB as { items?: Array<Record<string, unknown>> } | undefined;
    partB?.items?.forEach(attach);
    const partC = content.partC as { texts?: Array<{ questions?: Array<Record<string, unknown>> }> } | undefined;
    partC?.texts?.forEach((t) => t.questions?.forEach(attach));

    return { content, explanationCount: rows.length, title: test.title };
  }

  /** Reading papers only — Listening explanations are not in scope. */
  async assertReading(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { id: true, type: true, contentJson: true, title: true }
    });
    if (!test) throw Object.assign(new Error("Test not found"), { statusCode: 404 });
    if (test.type !== TestType.READING) {
      throw Object.assign(new Error("Explanations are for Reading papers."), { statusCode: 400 });
    }
    return test;
  }
}
