/**
 * WritingService — the OET Writing course: per-profession case-note libraries,
 * timed letter submissions, and per-student correction tracking.
 *
 * A student only ever sees the library for the profession they picked at
 * sign-up (immutable). On submit we number the letter per student, tag it with
 * the student's stable writingCode, email it to the profession's correction
 * inbox, and keep the submission for admin tracking + the student's history.
 */
import { EntitlementStatus, SubscriptionStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { EmailService } from "../email/email.service";

const GLOBAL_KEY = "*";
const DEFAULT_CORRECTION_EMAIL = "info@oethq.com";

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0);

export type CaseNoteInput = {
  title: string;
  scenario: string;
  caseNotesHtml: string;
  wordGuidance?: string | null;
  timeLimitMin?: number | null;
};

export class WritingService {
  constructor(private readonly prisma: PrismaClient, private readonly email: EmailService) {}

  // ------------------------------------------------------------- admin: library

  async listByProfession(profession: string) {
    const rows = await this.prisma.writingCaseNote.findMany({
      where: { profession },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, wordGuidance: true, timeLimitMin: true, displayOrder: true, isActive: true, createdAt: true }
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  /** Count of case notes per profession (for the admin overview). */
  async counts() {
    const grouped = await this.prisma.writingCaseNote.groupBy({ by: ["profession", "isActive"], _count: { _all: true } });
    const out: Record<string, { total: number; active: number }> = {};
    for (const g of grouped) {
      if (!out[g.profession]) out[g.profession] = { total: 0, active: 0 };
      out[g.profession].total += g._count._all;
      if (g.isActive) out[g.profession].active += g._count._all;
    }
    return out;
  }

  async create(profession: string, input: CaseNoteInput) {
    if (!profession.trim()) throw httpError("Profession required", 400);
    if (!input.title?.trim() || !input.caseNotesHtml?.trim()) throw httpError("Title and case notes are required", 400);
    const max = await this.prisma.writingCaseNote.aggregate({ where: { profession }, _max: { displayOrder: true } });
    return this.prisma.writingCaseNote.create({
      data: {
        profession: profession.trim(),
        title: input.title.trim().slice(0, 300),
        scenario: input.scenario ?? "",
        caseNotesHtml: input.caseNotesHtml,
        wordGuidance: input.wordGuidance?.trim() || null,
        timeLimitMin: input.timeLimitMin && input.timeLimitMin > 0 ? Math.round(input.timeLimitMin) : 45,
        displayOrder: (max._max.displayOrder ?? -1) + 1
      }
    });
  }

  getOne(id: string) {
    return this.prisma.writingCaseNote.findUnique({ where: { id } });
  }

  async update(id: string, data: Partial<CaseNoteInput & { isActive: boolean; displayOrder: number }>) {
    return this.prisma.writingCaseNote.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.slice(0, 300) } : {}),
        ...(data.scenario !== undefined ? { scenario: data.scenario } : {}),
        ...(data.caseNotesHtml !== undefined ? { caseNotesHtml: data.caseNotesHtml } : {}),
        ...(data.wordGuidance !== undefined ? { wordGuidance: data.wordGuidance?.trim() || null } : {}),
        ...(data.timeLimitMin !== undefined ? { timeLimitMin: data.timeLimitMin && data.timeLimitMin > 0 ? Math.round(data.timeLimitMin) : 45 } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {})
      }
    });
  }

  async remove(id: string) {
    await this.prisma.writingCaseNote.delete({ where: { id } });
    return { ok: true };
  }

  // ------------------------------------------------------------- admin: settings

  async listSettings() {
    const rows = await this.prisma.writingSetting.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.profession] = r.correctionEmail;
    return { settings: map, globalDefault: map[GLOBAL_KEY] ?? DEFAULT_CORRECTION_EMAIL };
  }

  async setSetting(profession: string, correctionEmail: string) {
    const key = profession.trim() || GLOBAL_KEY;
    const email = correctionEmail.trim();
    if (!email) {
      await this.prisma.writingSetting.deleteMany({ where: { profession: key } });
      return { ok: true, cleared: true };
    }
    await this.prisma.writingSetting.upsert({
      where: { profession: key },
      create: { profession: key, correctionEmail: email },
      update: { correctionEmail: email }
    });
    return { ok: true };
  }

  private async correctionEmailFor(profession: string): Promise<string> {
    const [byProf, global] = await Promise.all([
      this.prisma.writingSetting.findUnique({ where: { profession } }),
      this.prisma.writingSetting.findUnique({ where: { profession: GLOBAL_KEY } })
    ]);
    return byProf?.correctionEmail || global?.correctionEmail || DEFAULT_CORRECTION_EMAIL;
  }

  // ------------------------------------------------------------- admin: tracking

  async listSubmissions(filter: { profession?: string; userId?: string } = {}) {
    const where: { profession?: string; userId?: string } = {};
    if (filter.profession) where.profession = filter.profession;
    if (filter.userId) where.userId = filter.userId;
    const subs = await this.prisma.writingSubmission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: 500
    });
    const userIds = Array.from(new Set(subs.map((s) => s.userId)));
    const noteIds = Array.from(new Set(subs.map((s) => s.caseNoteId)));
    const [users, notes] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, writingCode: true, profession: true } }),
      this.prisma.writingCaseNote.findMany({ where: { id: { in: noteIds } }, select: { id: true, title: true } })
    ]);
    const uMap = new Map(users.map((u) => [u.id, u]));
    const nMap = new Map(notes.map((n) => [n.id, n.title]));
    // per-student totals
    const totals = new Map<string, number>();
    for (const s of subs) totals.set(s.userId, (totals.get(s.userId) ?? 0) + 1);
    return subs.map((s) => {
      const u = uMap.get(s.userId);
      return {
        id: s.id,
        userId: s.userId,
        studentName: u?.name ?? "—",
        studentEmail: u?.email ?? "—",
        studentCode: s.studentCode,
        profession: s.profession,
        caseNoteTitle: nMap.get(s.caseNoteId) ?? "(deleted)",
        letterNumber: s.letterNumber,
        wordCount: s.wordCount,
        autoSubmitted: s.autoSubmitted,
        emailDelivered: s.emailDelivered,
        submittedAt: s.submittedAt.toISOString(),
        studentTotal: totals.get(s.userId) ?? 0
      };
    });
  }

  /** Full letter text for one submission (admin review). */
  async getSubmission(id: string) {
    const s = await this.prisma.writingSubmission.findUnique({ where: { id } });
    if (!s) return null;
    const [u, n] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true, writingCode: true } }),
      this.prisma.writingCaseNote.findUnique({ where: { id: s.caseNoteId }, select: { title: true } })
    ]);
    return { ...s, submittedAt: s.submittedAt.toISOString(), student: u, caseNoteTitle: n?.title ?? "(deleted)" };
  }

  // ------------------------------------------------------------- candidate

  /**
   * A student's total writing-correction allowance = the writingLimit of their
   * active plan tier PLUS the writingCorrections of every writing package they
   * own (additive). Admin-editable via the plan/product quotas.
   */
  async writingAllowance(userId: string): Promise<{ planLimit: number; packageLimit: number; allowed: number }> {
    const now = new Date();
    const [subs, ents] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
        select: { endDate: true, plan: { select: { writingLimit: true } } }
      }),
      this.prisma.entitlement.findMany({
        where: { userId, status: EntitlementStatus.ACTIVE, productId: { not: null } },
        select: { endDate: true, product: { select: { writingCorrections: true } } }
      })
    ]);
    const planLimit = subs.filter((s) => !s.endDate || s.endDate > now).reduce((m, s) => Math.max(m, s.plan?.writingLimit ?? 0), 0);
    const packageLimit = ents.filter((e) => !e.endDate || e.endDate > now).reduce((sum, e) => sum + (e.product?.writingCorrections ?? 0), 0);
    return { planLimit, packageLimit, allowed: planLimit + packageLimit };
  }

  private async requireProfession(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, profession: true, writingCode: true } });
    if (!user) throw httpError("User not found", 404);
    return user;
  }

  /** The student's library (their profession) + their correction stats. */
  async libraryForUser(userId: string) {
    const user = await this.requireProfession(userId);
    const profession = user.profession ?? null;
    const caseNotes = profession
      ? (await this.prisma.writingCaseNote.findMany({
          where: { profession, isActive: true },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, wordGuidance: true, timeLimitMin: true }
        }))
      : [];
    const totalCorrections = await this.prisma.writingSubmission.count({ where: { userId } });
    const { planLimit, packageLimit, allowed } = await this.writingAllowance(userId);
    return {
      profession,
      writingCode: user.writingCode,
      totalCorrections,
      allowed,
      used: totalCorrections,
      remaining: Math.max(0, allowed - totalCorrections),
      planLimit,
      packageLimit,
      caseNotes
    };
  }

  /** A case note to attempt — must belong to the student's profession. */
  async getCaseNoteForUser(id: string, userId: string) {
    const user = await this.requireProfession(userId);
    const note = await this.prisma.writingCaseNote.findUnique({ where: { id } });
    if (!note || !note.isActive) throw httpError("Case note not found", 404);
    if (note.profession !== user.profession) throw httpError("This case note isn't part of your profession's library", 403);
    return {
      id: note.id,
      title: note.title,
      profession: note.profession,
      scenario: note.scenario,
      caseNotesHtml: note.caseNotesHtml,
      wordGuidance: note.wordGuidance,
      timeLimitMin: note.timeLimitMin
    };
  }

  private async ensureWritingCode(userId: string, current: string | null): Promise<string> {
    if (current) return current;
    for (let attempt = 0; attempt < 6; attempt++) {
      const seq = (await this.prisma.user.count({ where: { writingCode: { not: null } } })) + 1 + attempt;
      const code = `OETW-${String(seq).padStart(5, "0")}`;
      try {
        await this.prisma.user.update({ where: { id: userId }, data: { writingCode: code } });
        return code;
      } catch {
        // unique collision — try the next sequence
      }
    }
    // last resort: a random-suffixed code
    const code = `OETW-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await this.prisma.user.update({ where: { id: userId }, data: { writingCode: code } });
    return code;
  }

  /** Submit a letter for a case note → number it, store it, email it. */
  async submit(userId: string, caseNoteId: string, letterText: string, auto = false) {
    const user = await this.requireProfession(userId);
    const note = await this.prisma.writingCaseNote.findUnique({ where: { id: caseNoteId } });
    if (!note) throw httpError("Case note not found", 404);
    if (note.profession !== user.profession) throw httpError("This case note isn't part of your profession's library", 403);
    const text = (letterText ?? "").trim();
    if (!text && !auto) throw httpError("Write your letter before submitting", 400);

    const priorCount = await this.prisma.writingSubmission.count({ where: { userId } });
    const { allowed } = await this.writingAllowance(userId);
    if (priorCount >= allowed) {
      throw httpError(
        allowed === 0
          ? "Your plan doesn't include any writing corrections yet. Add a writing package to submit letters."
          : `You've used all ${allowed} of your writing corrections. Add more corrections to submit another letter.`,
        403
      );
    }

    const studentCode = await this.ensureWritingCode(userId, user.writingCode);
    const letterNumber = priorCount + 1;
    const wordCount = countWords(text);

    const submission = await this.prisma.writingSubmission.create({
      data: { userId, caseNoteId, profession: note.profession, studentCode, letterNumber, letterText: text, wordCount, autoSubmitted: auto }
    });

    // email to the profession's correction inbox
    const to = await this.correctionEmailFor(note.profession);
    const subject = `OET Writing correction — ${studentCode} · Letter #${letterNumber} · ${note.profession}`;
    const meta = `Student: ${user.name} (${user.email})\nStudent ID: ${studentCode}\nLetter number: #${letterNumber}\nProfession: ${note.profession}\nCase note: ${note.title}\nWords: ${wordCount}${auto ? "\n(Auto-submitted at time-up)" : ""}`;
    const text2 = `${meta}\n\n----- LETTER -----\n\n${text || "(blank — no letter written)"}\n`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0B1B36">
        <h2 style="font-size:17px;margin:0 0 4px">OET Writing correction request</h2>
        <table style="font-size:13px;color:#334;border-collapse:collapse;margin:10px 0">
          <tr><td style="padding:2px 10px 2px 0;color:#64748B">Student</td><td><b>${user.name}</b> &lt;${user.email}&gt;</td></tr>
          <tr><td style="padding:2px 10px 2px 0;color:#64748B">Student ID</td><td><b>${studentCode}</b></td></tr>
          <tr><td style="padding:2px 10px 2px 0;color:#64748B">Letter number</td><td><b>#${letterNumber}</b></td></tr>
          <tr><td style="padding:2px 10px 2px 0;color:#64748B">Profession</td><td>${note.profession}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;color:#64748B">Case note</td><td>${note.title}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;color:#64748B">Words</td><td>${wordCount}${auto ? " · auto-submitted" : ""}</td></tr>
        </table>
        <div style="border:1px solid #E2E9F2;border-radius:10px;padding:16px;background:#F8FBFF;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#16273f">${(text || "(blank — no letter written)").replace(/</g, "&lt;")}</div>
      </div>`;

    let delivered = false;
    try {
      const r = await this.email.sendCohortMail(to, { subject, text: text2, html });
      delivered = r.delivered;
    } catch {
      delivered = false;
    }
    if (delivered) await this.prisma.writingSubmission.update({ where: { id: submission.id }, data: { emailDelivered: true } });

    return { id: submission.id, letterNumber, studentCode, wordCount, delivered };
  }

  /** The student's own submission history + stats. */
  async myHistory(userId: string) {
    const user = await this.requireProfession(userId);
    const subs = await this.prisma.writingSubmission.findMany({ where: { userId }, orderBy: { submittedAt: "desc" } });
    const noteIds = Array.from(new Set(subs.map((s) => s.caseNoteId)));
    const notes = await this.prisma.writingCaseNote.findMany({ where: { id: { in: noteIds } }, select: { id: true, title: true } });
    const nMap = new Map(notes.map((n) => [n.id, n.title]));
    return {
      writingCode: user.writingCode,
      total: subs.length,
      submissions: subs.map((s) => ({
        id: s.id,
        caseNoteTitle: nMap.get(s.caseNoteId) ?? "(removed)",
        letterNumber: s.letterNumber,
        wordCount: s.wordCount,
        autoSubmitted: s.autoSubmitted,
        submittedAt: s.submittedAt.toISOString()
      }))
    };
  }
}
