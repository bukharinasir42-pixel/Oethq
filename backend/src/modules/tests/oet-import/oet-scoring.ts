/**
 * oet-scoring.ts — official OET grading for imported (contentJson) tests,
 * faithfully replicating the reference interactive files.
 *
 * READING: raw count /42 → EQUATE table → scaled 0–500 + band (E/D/C/C+/B/A).
 * LISTENING: scaled = round(correct/42*500 / 10)*10 → grade by threshold.
 *   pass = Grade A or B (scaled ≥ 350).
 *
 * Fill-blank matching mirrors the source engines:
 *   READING  — substring match (normalized user CONTAINS the term);
 *   LISTENING — exact match (normalized user EQUALS a term).
 *   mode "or" = any term; mode "and" = every term.
 */
import { OetGrade } from "@prisma/client";
import {
  collectQuestions,
  type OetFillAnswer,
  type OetQuestion,
  type OetTestImport
} from "./oet-test-schema";

/** Reading raw→scaled equating table (verbatim from the reference test). */
const READING_EQUATE: { raw: number; scaled: number; band: string }[] = [
  { raw: 0, scaled: 0, band: "E" }, { raw: 1, scaled: 0, band: "E" }, { raw: 2, scaled: 55, band: "E" },
  { raw: 3, scaled: 85, band: "E" }, { raw: 4, scaled: 110, band: "D" }, { raw: 5, scaled: 125, band: "D" },
  { raw: 6, scaled: 145, band: "D" }, { raw: 7, scaled: 155, band: "D" }, { raw: 8, scaled: 170, band: "D" },
  { raw: 9, scaled: 180, band: "D" }, { raw: 10, scaled: 190, band: "D" }, { raw: 11, scaled: 200, band: "C" },
  { raw: 12, scaled: 210, band: "C" }, { raw: 13, scaled: 220, band: "C" }, { raw: 14, scaled: 225, band: "C" },
  { raw: 15, scaled: 235, band: "C" }, { raw: 16, scaled: 240, band: "C" }, { raw: 17, scaled: 250, band: "C" },
  { raw: 18, scaled: 260, band: "C" }, { raw: 19, scaled: 265, band: "C" }, { raw: 20, scaled: 270, band: "C" },
  { raw: 21, scaled: 280, band: "C" }, { raw: 22, scaled: 285, band: "C" }, { raw: 23, scaled: 295, band: "C" },
  { raw: 24, scaled: 300, band: "C+" }, { raw: 25, scaled: 310, band: "C+" }, { raw: 26, scaled: 315, band: "C+" },
  { raw: 27, scaled: 325, band: "C+" }, { raw: 28, scaled: 335, band: "C+" }, { raw: 29, scaled: 340, band: "C+" },
  { raw: 30, scaled: 350, band: "B" }, { raw: 31, scaled: 360, band: "B" }, { raw: 32, scaled: 370, band: "B" },
  { raw: 33, scaled: 380, band: "B" }, { raw: 34, scaled: 390, band: "B" }, { raw: 35, scaled: 400, band: "B" },
  { raw: 36, scaled: 415, band: "B" }, { raw: 37, scaled: 430, band: "B" }, { raw: 38, scaled: 450, band: "A" },
  { raw: 39, scaled: 475, band: "A" }, { raw: 40, scaled: 500, band: "A" }, { raw: 41, scaled: 500, band: "A" },
  { raw: 42, scaled: 500, band: "A" }
];

const GRADE_ENUM: Record<string, OetGrade> = {
  A: OetGrade.A, B: OetGrade.B, "C+": OetGrade.C_PLUS, C: OetGrade.C, D: OetGrade.D, E: OetGrade.E
};

/** "C_PLUS" → "C+" for display. */
export function oetGradeLabel(g: OetGrade): string {
  return g === OetGrade.C_PLUS ? "C+" : g;
}

function normalize(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(a|an|the) /, "");
}

/** Does a user response satisfy a fill-blank answer spec? */
export function matchFillBlank(userVal: string, answer: OetFillAnswer, testType: "READING" | "LISTENING"): boolean {
  const u = normalize(userVal);
  if (!u) return false;
  const terms = (answer.terms || []).map(normalize).filter(Boolean);
  if (terms.length === 0) return false;
  const hit = (t: string) => (testType === "READING" ? u.includes(t) : u === t);
  return answer.mode === "and" ? terms.every(hit) : terms.some(hit);
}

/** Is a single question answered correctly? */
export function isQuestionCorrect(
  q: OetQuestion,
  response: string | undefined,
  testType: "READING" | "LISTENING"
): boolean {
  if (response == null || response === "") return false;
  if (q.type === "mcq" || q.type === "letter_match") {
    return String(response).trim().toUpperCase() === String(q.answer).trim().toUpperCase();
  }
  return matchFillBlank(response, q.answer, testType);
}

export type OetScoreResult = {
  correct: number;
  total: number;
  partACorrect: number;
  partBCorrect: number;
  partCCorrect: number;
  scaledScore: number;
  grade: OetGrade;
  gradeLabel: string;
  pass: boolean;
  /** correctness per question number (for the review screen). */
  perQuestion: Record<number, boolean>;
};

function partOf(n: number, testType: "READING" | "LISTENING"): "A" | "B" | "C" {
  if (testType === "READING") return n <= 20 ? "A" : n <= 26 ? "B" : "C";
  return n <= 24 ? "A" : n <= 30 ? "B" : "C";
}

/** Grade a full attempt from the canonical doc + a {questionNumber: response} map. */
export function scoreOetAttempt(doc: OetTestImport, answers: Record<string | number, string>): OetScoreResult {
  const questions = collectQuestions(doc);
  const perQuestion: Record<number, boolean> = {};
  let correct = 0, partACorrect = 0, partBCorrect = 0, partCCorrect = 0;

  for (const q of questions) {
    const resp = answers[q.n] ?? answers[String(q.n)];
    const ok = isQuestionCorrect(q, resp, doc.type);
    perQuestion[q.n] = ok;
    if (!ok) continue;
    correct += 1;
    const part = partOf(q.n, doc.type);
    if (part === "A") partACorrect += 1;
    else if (part === "B") partBCorrect += 1;
    else partCCorrect += 1;
  }

  const total = questions.length || 42;
  let scaled: number;
  let bandStr: string;
  if (doc.type === "READING") {
    const row = READING_EQUATE.find((e) => e.raw === correct) ?? READING_EQUATE[0];
    scaled = row.scaled;
    bandStr = row.band;
  } else {
    scaled = Math.round((correct / 42) * 500 / 10) * 10;
    bandStr = scaled >= 450 ? "A" : scaled >= 350 ? "B" : scaled >= 300 ? "C+" : scaled >= 200 ? "C" : scaled >= 100 ? "D" : "E";
  }
  const grade = GRADE_ENUM[bandStr] ?? OetGrade.E;
  return {
    correct, total, partACorrect, partBCorrect, partCCorrect,
    scaledScore: scaled, grade, gradeLabel: oetGradeLabel(grade),
    pass: scaled >= 350, perQuestion
  };
}
