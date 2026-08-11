/**
 * explanations.router.ts — answer explanations for Reading papers.
 *
 *   Student: GET  /oet-tests/:id/explanations   (approved only, after submitting)
 *   Admin:   GET    /admin/oet-tests/:id/explanations
 *            POST   /admin/oet-tests/:id/explanations/generate
 *            POST   /admin/oet-tests/:id/explanations/approve-all
 *            PATCH  /admin/explanations/:explanationId
 *            POST   /admin/explanations/:explanationId/approve
 *            DELETE /admin/explanations/:explanationId
 */
import { AttemptStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import type { GeneratorQuestion } from "../../modules/tests/explanations/explanation-generator";

/** Flatten a reading paper into what the generator needs: question + its text. */
type GenQ = GeneratorQuestion & { part: "A" | "B" | "C" };

function questionsForGeneration(content: unknown): GenQ[] {
  const c = content as {
    partA?: {
      texts?: Array<{ letter: string; title?: string; blocks?: Array<Record<string, unknown>> }>;
      questions?: Array<{ n: number; type: string; prompt: string; answer: unknown }>;
    };
    partB?: { items?: Array<{ n: number; docHtml: string; prompt: string; options: Record<string, string>; answer: string }> };
    partC?: { texts?: Array<{ title?: string; paras?: string[]; questions?: Array<{ n: number; prompt: string; options: Record<string, string>; answer: string }> }> };
  };
  const out: GenQ[] = [];

  // Part A: the answer can be in ANY of the four texts, so all four go in.
  const blockText = (b: Record<string, unknown>): string => {
    if (b.type === "p") return String(b.html ?? "");
    if (b.type === "heading") return String(b.text ?? "");
    if (b.type === "list") return (b.items as string[] | undefined)?.join(" ") ?? "";
    if (b.type === "note") return String(b.html ?? "");
    if (b.type === "table") {
      const head = (b.head as string[] | undefined)?.join(" | ") ?? "";
      const rows = (b.rows as string[][] | undefined)?.map((r) => r.join(" | ")).join("\n") ?? "";
      return `${head}\n${rows}`;
    }
    return "";
  };
  const partAText = (c.partA?.texts ?? [])
    .map((t) => `TEXT ${t.letter}${t.title ? ` — ${t.title}` : ""}\n${(t.blocks ?? []).map(blockText).join("\n")}`)
    .join("\n\n");
  for (const q of c.partA?.questions ?? []) {
    out.push({
      n: q.n,
      type: q.type === "letter_match" ? "letter_match" : "fill_blank",
      prompt: q.prompt,
      answer:
        typeof q.answer === "string"
          ? q.answer
          : String((q.answer as { display?: string })?.display ?? ""),
      passage: partAText,
      part: "A"
    });
  }

  for (const it of c.partB?.items ?? []) {
    out.push({ n: it.n, type: "mcq", prompt: it.prompt, options: it.options, answer: it.answer, passage: it.docHtml, part: "B" });
  }

  for (const t of c.partC?.texts ?? []) {
    const passage = `${t.title ?? ""}\n${(t.paras ?? []).join("\n")}`;
    for (const q of t.questions ?? []) {
      out.push({ n: q.n, type: "mcq", prompt: q.prompt, options: q.options, answer: q.answer, passage, part: "C" });
    }
  }

  return out;
}

export function createExplanationsRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.explanationsService;

  /**
   * A student's explanations for a paper.
   *
   * Gated on having actually submitted it. Without that check the answer key to
   * every Reading paper is one request away from any signed-in account, which
   * would make every practice score meaningless.
   */
  r.get(
    "/oet-tests/:id/explanations",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const testId = req.params.id;

      const submitted = await c.prisma.testAttempt.findFirst({
        where: {
          testId,
          userId: u.id,
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] }
        },
        select: { id: true }
      });
      if (!submitted && u.role !== "ADMIN") {
        res.status(403).json({ message: "Sit the paper first — explanations open once you submit." });
        return;
      }

      const items = await svc.forStudent(testId);
      // Recording the view is what makes later attempts practice. Done here
      // rather than on a button click in the browser, which can be skipped.
      if (u.role !== "ADMIN" && items.length > 0) {
        await svc.recordView(u.id, testId);
      }
      res.json({ testId, count: items.length, items });
    })
  );

  /** Does this paper have explanations, and has this student already looked? */
  r.get(
    "/oet-tests/:id/explanations/status",
    auth,
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      const [coverage, viewed] = await Promise.all([
        svc.coverage(req.params.id),
        svc.hasViewed(u.id, req.params.id)
      ]);
      res.json({ available: coverage.approved > 0, count: coverage.approved, viewed });
    })
  );

  // ---- Admin ----

  /**
   * Reading papers that can carry explanations.
   *
   * Only imported papers appear: an explanation is anchored to a question number
   * inside contentJson, so a legacy test built in the old question editor has
   * nothing to anchor to.
   */
  r.get(
    "/admin/oet-tests/reading",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      const rows = await c.prisma.test.findMany({
        where: { type: "READING", contentJson: { not: Prisma.DbNull } },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, type: true, isPublished: true, totalQuestions: true }
      });
      res.json(rows);
    })
  );

  r.get(
    "/admin/oet-tests/:id/explanations",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const test = await svc.assertReading(req.params.id);
      const [items, coverage] = await Promise.all([svc.listForAdmin(test.id), svc.coverage(test.id)]);
      const total = questionsForGeneration(test.contentJson).length;
      res.json({ testId: test.id, title: test.title, total, ...coverage, items });
    })
  );

  /**
   * Draft explanations for the questions that do not have one.
   *
   * Only the gaps: regenerating a question that already has an approved
   * explanation would replace reviewed work with unreviewed work.
   */
  r.post(
    "/admin/oet-tests/:id/explanations/generate",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const test = await svc.assertReading(req.params.id);
      if (!c.explanationGenerator.isConfigured()) {
        res.status(503).json({ message: "ANTHROPIC_API_KEY is not set on the API server." });
        return;
      }

      const all = questionsForGeneration(test.contentJson);
      const existing = await svc.listForAdmin(test.id);
      const have = new Set(existing.map((e) => e.questionNumber));
      const force = Boolean((req.body ?? {}).regenerateAll);
      const todo = force ? all : all.filter((q) => !have.has(q.n));

      if (todo.length === 0) {
        res.json({ generated: 0, unverified: 0, message: "Every question already has an explanation." });
        return;
      }

      const drafted = await c.explanationGenerator.generate(todo);
      let unverified = 0;
      for (const d of drafted) {
        if (!d.evidenceVerified) unverified++;
        await c.prisma.testExplanation.upsert({
          where: { testId_questionNumber: { testId: test.id, questionNumber: d.n } },
          create: {
            testId: test.id,
            questionNumber: d.n,
            part: all.find((q) => q.n === d.n)?.part,
            evidence: d.evidence,
            evidenceLetter: d.evidenceLetter ?? null,
            reasoning: d.reasoning,
            skillTag: d.skillTag ?? null,
            options: d.options ?? undefined,
            model: process.env.ANTHROPIC_EXPLANATION_MODEL || "claude-opus-5",
            generatedAt: new Date()
          },
          update: {
            part: all.find((q) => q.n === d.n)?.part,
            evidence: d.evidence,
            evidenceLetter: d.evidenceLetter ?? null,
            reasoning: d.reasoning,
            skillTag: d.skillTag ?? null,
            options: d.options ?? undefined,
            model: process.env.ANTHROPIC_EXPLANATION_MODEL || "claude-opus-5",
            generatedAt: new Date(),
            status: "DRAFT",
            approvedAt: null,
            approvedById: null
          }
        });
      }

      await c.auditService.record({
        actorUserId: (req as AuthedRequest).user.id,
        action: "explanations.generate",
        entityType: "Test",
        entityId: test.id,
        metadata: { requested: todo.length, drafted: drafted.length, unverified }
      });

      res.json({
        generated: drafted.length,
        requested: todo.length,
        unverified,
        message:
          unverified > 0
            ? `${unverified} could not be matched word-for-word to the passage. Check those first — the highlight will not land.`
            : "Drafted. Review and approve before students see them."
      });
    })
  );

  r.post(
    "/admin/oet-tests/:id/explanations/approve-all",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await svc.approveAll(req.params.id, (req as AuthedRequest).user.id));
    })
  );

  r.post(
    "/admin/explanations/:explanationId/approve",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await svc.approve(req.params.explanationId, (req as AuthedRequest).user.id));
    })
  );

  r.post(
    "/admin/explanations/:explanationId/unapprove",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await svc.unapprove(req.params.explanationId));
    })
  );

  r.patch(
    "/admin/explanations/:explanationId",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await svc.edit(req.params.explanationId, (req.body ?? {}) as Record<string, never>));
    })
  );

  r.delete(
    "/admin/explanations/:explanationId",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await svc.remove(req.params.explanationId));
    })
  );

  return r;
}
