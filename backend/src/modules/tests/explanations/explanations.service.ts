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

/** One located quote. `loc` is a label for the student: "Text B", "¶3", "Email". */
export type EvidenceQuote = { loc: string | null; quote: string };

/** One row of the paraphrase mapping: the stem's word, and the text's word. */
export type BridgePair = { stem: string; text: string };

/** A wrong answer a short-answer item attracts, and why it scores nothing. */
export type CommonWrong = { wrote: string; why: string };

export type ParsedOption = {
  verdict: OptionVerdict;
  trap?: string;
  /** The exact phrase in the option that breaks. Quoted back at the student. */
  fails?: string;
  why: string;
};

export type ParsedExplanation = {
  evidence: string;
  evidenceLetter?: string | null;
  evidenceQuotes?: EvidenceQuote[] | null;
  reasoning: string;
  bridge?: BridgePair[] | null;
  stemFocus?: string | null;
  questionType?: string | null;
  typeLabel?: string | null;
  difficulty?: string | null;
  counterfactual?: string | null;
  lesson?: string | null;
  skillTag?: string | null;
  skillLabel?: string | null;
  trapNote?: string | null;
  note?: string | null;
  confidence?: string | null;
  options?: Record<string, ParsedOption> | null;
  commonWrong?: CommonWrong[] | null;
};

/** The named distractor taxonomy. Anything outside it is dropped, not guessed. */
const TRAPS = new Set([
  "wrong_referent", "adjacent_entity", "partial_support", "superseded", "true_not_asked",
  "lexical_lure", "unstated_state", "absolute_language", "unlicensed_ranking",
  "sufficiency_overclaim", "function_mismatch", "speaker_attribution", "over_inference",
  "direct_information", "near_miss_form", "not_stated"
]);

/**
 * Short names accepted for the same traps.
 *
 * The authoring tool writes `absolute`, `notasked`, `absent`; the store keeps
 * the long names. Accepting both means a file drafted in either vocabulary
 * imports without a find and replace pass, which is exactly the kind of chore
 * that ends with a taxonomy quietly going unused.
 */
const TRAP_ALIASES: Record<string, string> = {
  referent: "wrong_referent",
  adjacent: "adjacent_entity",
  partial: "partial_support",
  notasked: "true_not_asked",
  not_asked: "true_not_asked",
  lure: "lexical_lure",
  state: "unstated_state",
  absolute: "absolute_language",
  ranking: "unlicensed_ranking",
  completeness: "sufficiency_overclaim",
  function: "function_mismatch",
  speaker: "speaker_attribution",
  absent: "not_stated",
  overinfer: "over_inference",
  form: "near_miss_form",
  direct: "direct_information"
};

const QUESTION_TYPES = new Set([
  "fact", "main_idea", "purpose", "inference", "reference",
  "vocabulary", "tone", "comparison", "cause_effect", "detail"
]);

const DIFFICULTIES = new Set(["C1", "C2", "C3"]);

const CONFIDENCES = new Set(["high", "medium", "low"]);

const VERDICTS = new Set<OptionVerdict>(["correct", "distractor", "partial"]);

/**
 * Inline emphasis, and nothing else.
 *
 * The explanations lean on emphasis to carry the method: the failing component
 * of an option is bolded so it is read as the point rather than as one more
 * clause. That means these strings cannot be escaped wholesale on the way out,
 * so the tags are restricted on the way in. Everything not on this list has its
 * angle brackets neutralised, which is what makes it safe to render as HTML.
 */
const INLINE_TAGS = /^\/?(b|i|em|strong)$/i;

function sanitiseInline(s: string): string {
  return s.replace(/<([^>]*)>/g, (whole, inner: string) =>
    INLINE_TAGS.test(inner.trim()) ? `<${inner.trim().toLowerCase()}>` : `&lt;${inner}&gt;`
  );
}

function clean(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** A prose field: trimmed, capped, and safe to render with inline emphasis. */
function prose(v: unknown, max = 4000): string | null {
  const t = clean(v, max);
  return t ? sanitiseInline(t) : null;
}

function normaliseTrap(v: unknown): string | undefined {
  const raw = clean(v, 40)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return undefined;
  const mapped = TRAP_ALIASES[raw] ?? raw;
  return TRAPS.has(mapped) ? mapped : undefined;
}

/**
 * The quotes, from either shape.
 *
 * A paper may give `evidence` as a plain string (the original contract, still
 * valid and still the common case) or as an array of located quotes. Both end
 * up as an array here so nothing downstream has to ask which it got.
 */
function parseEvidence(raw: unknown, fallbackLetter: string | null): EvidenceQuote[] {
  if (typeof raw === "string") {
    const q = clean(raw);
    return q ? [{ loc: fallbackLetter ? `Text ${fallbackLetter}` : null, quote: q }] : [];
  }
  if (!Array.isArray(raw)) return [];
  const out: EvidenceQuote[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const q = clean(item);
      if (q) out.push({ loc: null, quote: q });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const quote = clean(o.quote);
    if (!quote) continue;
    out.push({ loc: clean(o.loc, 40), quote });
  }
  return out;
}

function parseBridge(raw: unknown): BridgePair[] | null {
  if (!Array.isArray(raw)) return null;
  const out: BridgePair[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const stem = clean(o.stem, 200);
    const text = clean(o.text, 200);
    if (stem && text) out.push({ stem, text });
  }
  return out.length > 0 ? out : null;
}

function parseCommonWrong(raw: unknown): CommonWrong[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CommonWrong[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const wrote = clean(o.wrote, 300);
    const why = prose(o.why, 1000);
    if (wrote && why) out.push({ wrote, why });
  }
  return out.length > 0 ? out : null;
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

  const letterRaw = clean(o.evidenceLetter, 1);
  const letter = letterRaw && /^[A-D]$/i.test(letterRaw) ? letterRaw.toUpperCase() : null;

  const quotes = parseEvidence(o.evidence, letter);
  const reasoning = prose(o.reasoning) ?? "";
  // Evidence is what cannot be missing. An "explanation" with no evidence is an
  // assertion, and the whole point of the feature is showing the student where
  // the answer came from.
  //
  // The written analysis CAN be missing, because a paper is authored in two
  // passes: the evidence for all 42 items is located and machine-verified
  // first, then the prose is written. A located-but-unwritten item is real
  // work worth storing. It is held as a draft, so nothing half-written reaches
  // a student, and the admin queue shows exactly what is still owed.
  if (quotes.length === 0) return null;

  const options: Record<string, ParsedOption> = {};
  if (o.options && typeof o.options === "object") {
    for (const [key, value] of Object.entries(o.options as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      // `ok: true | false` is the authoring tool's shorthand. It cannot express
      // a partial, so it only ever produces correct or distractor; an explicit
      // verdict always wins over it.
      const declared = clean(v.verdict, 20)?.toLowerCase() as OptionVerdict | undefined;
      const verdict: OptionVerdict | undefined =
        declared && VERDICTS.has(declared)
          ? declared
          : typeof v.ok === "boolean"
            ? v.ok ? "correct" : "distractor"
            : undefined;
      const why = prose(v.why, 2000) ?? "";
      if (!verdict) continue;
      // An unrecognised trap name is dropped rather than stored. The taxonomy is
      // the teaching, and a made-up category would teach the wrong shape.
      const trap = normaliseTrap(v.trap ?? v.tag);
      const fails = clean(v.fails, 400);
      options[key.trim().toUpperCase().slice(0, 2)] = {
        verdict,
        ...(trap ? { trap } : {}),
        ...(fails ? { fails } : {}),
        why
      };
    }
  }

  const qt = clean(o.questionType, 60)?.toLowerCase().replace(/[\s-]+/g, "_");
  const diff = clean(o.difficulty, 4)?.toUpperCase();
  const conf = clean(o.confidence, 10)?.toLowerCase();

  // A questionType outside the ten-way enum is not discarded, it becomes the
  // display label. The enum drives the per-type analytics; the label is what a
  // student reads, and "Locating a stated instruction" tells them more than
  // "fact" does.
  const knownType = qt && QUESTION_TYPES.has(qt) ? qt : null;
  const typeLabel = clean(o.typeLabel, 80) ?? (!knownType ? clean(o.questionType, 80) : null);

  return {
    evidence: quotes[0].quote,
    evidenceLetter: letter,
    evidenceQuotes: quotes,
    reasoning,
    bridge: parseBridge(o.bridge),
    commonWrong: parseCommonWrong(o.commonWrong),
    skillLabel: prose(o.skillLabel ?? o.skill, 300),
    typeLabel,
    trapNote: prose(o.trapNote ?? o.trap, 1000),
    note: prose(o.note, 1000),
    confidence: conf && CONFIDENCES.has(conf) ? conf : null,
    stemFocus: prose(o.stemFocus, 500),
    questionType: knownType,
    difficulty: diff && DIFFICULTIES.has(diff) ? diff : null,
    counterfactual: prose(o.counterfactual, 1000),
    lesson: prose(o.lesson, 1000),
    skillTag: clean(o.skillTag, 60),
    options: Object.keys(options).length > 0 ? options : null
  };
}

/**
 * Is the written analysis actually there?
 *
 * The distinction the two-pass authoring process needs. An item can be fully
 * located, typed and graded for difficulty while its prose is still owed, and
 * the difference decides whether a student may see it. Judged on the fields a
 * student would notice missing: the reasoning, and a why on every option.
 */
export function isWritten(p: ParsedExplanation): boolean {
  if (!p.reasoning.trim()) return false;
  if (p.options) {
    for (const o of Object.values(p.options)) if (!o.why.trim()) return false;
  }
  return true;
}

/**
 * One paper's explanations, delivered as their own file.
 *
 * Explanations arrive separately from the paper on purpose. The papers carry
 * structure that took real work to get right, and re-importing a paper to
 * attach an explanation would put all of that back in the blast radius of an
 * editorial change. The two travel apart, and the question number joins them.
 *
 * Accepts the authoring format directly: `items` keyed "A1", "B21", "C27", each
 * carrying its own `n`. Keys are only a label here; `n` is what binds.
 */
export function parseExplanationFile(raw: unknown): Array<{ n: number; part: QuestionPart | null; explanation: ParsedExplanation; draft: boolean }> {
  const file = raw as { items?: Record<string, unknown>; meta?: Record<string, unknown> } | null;
  const items = file?.items;
  if (!items || typeof items !== "object") return [];

  const out: Array<{ n: number; part: QuestionPart | null; explanation: ParsedExplanation; draft: boolean }> = [];
  for (const [key, value] of Object.entries(items)) {
    if (!value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    // `n` is authoritative; the key is a fallback for a file that omits it.
    const n = Number(o.n ?? key.replace(/^[A-Za-z]+/, ""));
    if (!Number.isFinite(n) || n <= 0) continue;

    const parsed = parseExplanation(o);
    if (!parsed) continue;

    const partRaw = String(o.part ?? key[0] ?? "").toUpperCase();
    const part = partRaw === "A" ? QuestionPart.A : partRaw === "B" ? QuestionPart.B : partRaw === "C" ? QuestionPart.C : null;

    // A file that declares an item a draft is believed, even where the prose
    // happens to be present. The author's own status beats an inference.
    const declaredDraft = String(o.status ?? "").toLowerCase() === "draft";
    out.push({ n, part, explanation: parsed, draft: declaredDraft || !isWritten(parsed) });
  }
  return out.sort((a, b) => a.n - b.n);
}

/**
 * A parsed explanation as columns.
 *
 * One place, because a new field must land in the import path, the generator
 * path and the admin edit path together. A field that only reaches one of them
 * is not visibly broken, it is just quietly absent for half the papers.
 */
export function columnsFor(parsed: ParsedExplanation) {
  return {
    evidence: parsed.evidence,
    evidenceLetter: parsed.evidenceLetter ?? null,
    evidenceQuotes: (parsed.evidenceQuotes ?? Prisma.DbNull) as Prisma.InputJsonValue,
    reasoning: parsed.reasoning,
    bridge: (parsed.bridge ?? Prisma.DbNull) as Prisma.InputJsonValue,
    commonWrong: (parsed.commonWrong ?? Prisma.DbNull) as Prisma.InputJsonValue,
    stemFocus: parsed.stemFocus ?? null,
    questionType: parsed.questionType ?? null,
    typeLabel: parsed.typeLabel ?? null,
    difficulty: parsed.difficulty ?? null,
    counterfactual: parsed.counterfactual ?? null,
    lesson: parsed.lesson ?? null,
    skillTag: parsed.skillTag ?? null,
    skillLabel: parsed.skillLabel ?? null,
    trapNote: parsed.trapNote ?? null,
    note: parsed.note ?? null,
    confidence: parsed.confidence ?? null,
    options: (parsed.options ?? Prisma.DbNull) as Prisma.InputJsonValue
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
        ...columnsFor(parsed),
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

  /**
   * Attach a standalone explanations file to a paper.
   *
   * The paper is not touched. Fully written items are published; items whose
   * prose is still owed are stored as drafts, so the located evidence is not
   * lost and the admin queue shows precisely what is outstanding.
   *
   * A hand edit is never overwritten. That edit is the most considered version
   * of the text that exists, and a re-import is routine.
   */
  async saveFromFile(testId: string, file: unknown): Promise<{ published: number; drafted: number; skipped: number; total: number }> {
    const rows = parseExplanationFile(file);
    let published = 0;
    let drafted = 0;
    let skipped = 0;

    for (const row of rows) {
      const existing = await this.prisma.testExplanation.findUnique({
        where: { testId_questionNumber: { testId, questionNumber: row.n } },
        select: { id: true, editedAt: true }
      });
      if (existing?.editedAt) {
        skipped++;
        continue;
      }

      const publish = !row.draft;
      const data = {
        part: row.part,
        ...columnsFor(row.explanation),
        status: publish ? ExplanationStatus.APPROVED : ExplanationStatus.DRAFT,
        approvedAt: publish ? new Date() : null,
        model: null,
        generatedAt: null
      };
      await this.prisma.testExplanation.upsert({
        where: { testId_questionNumber: { testId, questionNumber: row.n } },
        create: { testId, questionNumber: row.n, ...data },
        update: data
      });
      if (publish) published++;
      else drafted++;
    }

    return { published, drafted, skipped, total: rows.length };
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
      // Rows written before the array existed still have only the string. Give
      // the client the array either way so it never carries two code paths.
      evidenceQuotes:
        (r.evidenceQuotes as EvidenceQuote[] | null) ??
        [{ loc: r.evidenceLetter ? `Text ${r.evidenceLetter}` : null, quote: r.evidence }],
      reasoning: r.reasoning,
      bridge: (r.bridge as BridgePair[] | null) ?? null,
      commonWrong: (r.commonWrong as CommonWrong[] | null) ?? null,
      stemFocus: r.stemFocus,
      questionType: r.questionType,
      typeLabel: r.typeLabel,
      difficulty: r.difficulty,
      counterfactual: r.counterfactual,
      lesson: r.lesson,
      skillTag: r.skillTag,
      skillLabel: r.skillLabel,
      trapNote: r.trapNote,
      note: r.note,
      // `confidence` is deliberately not sent. It is an editorial signal for the
      // approval queue; a student told an explanation is "medium confidence"
      // learns to discount every explanation on the page, including the ones
      // that are certain.
      options: (r.options as Record<string, ParsedOption> | null) ?? null
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
    if (patch.evidence !== undefined) data.evidence = prose(patch.evidence) ?? "";
    if (patch.reasoning !== undefined) data.reasoning = prose(patch.reasoning) ?? "";
    if (patch.evidenceLetter !== undefined) data.evidenceLetter = patch.evidenceLetter ?? null;
    if (patch.skillTag !== undefined) data.skillTag = patch.skillTag ?? null;
    if (patch.skillLabel !== undefined) data.skillLabel = prose(patch.skillLabel, 300);
    if (patch.trapNote !== undefined) data.trapNote = prose(patch.trapNote, 1000);
    if (patch.note !== undefined) data.note = prose(patch.note, 1000);
    if (patch.counterfactual !== undefined) data.counterfactual = prose(patch.counterfactual, 1000);
    if (patch.lesson !== undefined) data.lesson = prose(patch.lesson, 1000);
    if (patch.confidence !== undefined) {
      const c = clean(patch.confidence, 10)?.toLowerCase();
      data.confidence = c && CONFIDENCES.has(c) ? c : null;
    }
    // The quotes go through the same parser as an import so a hand edit cannot
    // introduce a shape the walkthrough does not know how to render.
    if (patch.evidenceQuotes !== undefined) {
      const quotes = parseEvidence(patch.evidenceQuotes, patch.evidenceLetter ?? null);
      if (quotes.length > 0) {
        data.evidenceQuotes = quotes as unknown as Prisma.InputJsonValue;
        data.evidence = quotes[0].quote;
      }
    }
    if (patch.bridge !== undefined) {
      data.bridge = (parseBridge(patch.bridge) ?? Prisma.DbNull) as Prisma.InputJsonValue;
    }
    if (patch.commonWrong !== undefined) {
      data.commonWrong = (parseCommonWrong(patch.commonWrong) ?? Prisma.DbNull) as Prisma.InputJsonValue;
    }
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
      // Exported in the array shape, which is the shape the format documents.
      // A round trip that changed the shape would make the exported file and
      // the written file diverge, and then only one of them gets maintained.
      q.explanation = {
        evidence: (row.evidenceQuotes as EvidenceQuote[] | null) ?? [
          { loc: row.evidenceLetter ? `Text ${row.evidenceLetter}` : null, quote: row.evidence }
        ],
        ...(row.evidenceLetter ? { evidenceLetter: row.evidenceLetter } : {}),
        reasoning: row.reasoning,
        ...(row.bridge ? { bridge: row.bridge } : {}),
        ...(row.stemFocus ? { stemFocus: row.stemFocus } : {}),
        ...(row.questionType ? { questionType: row.questionType } : {}),
        ...(row.typeLabel ? { typeLabel: row.typeLabel } : {}),
        ...(row.difficulty ? { difficulty: row.difficulty } : {}),
        ...(row.skillLabel ? { skillLabel: row.skillLabel } : {}),
        ...(row.options ? { options: row.options } : {}),
        ...(row.commonWrong ? { commonWrong: row.commonWrong } : {}),
        ...(row.trapNote ? { trapNote: row.trapNote } : {}),
        ...(row.counterfactual ? { counterfactual: row.counterfactual } : {}),
        ...(row.lesson ? { lesson: row.lesson } : {}),
        ...(row.note ? { note: row.note } : {}),
        ...(row.confidence ? { confidence: row.confidence } : {}),
        ...(row.skillTag ? { skillTag: row.skillTag } : {})
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
