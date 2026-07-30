/**
 * oet-test-validator.ts — validate a parsed JSON blob against the canonical
 * OET import schema. Returns human-readable errors so the admin paste UI can
 * point at exactly what's wrong. Also computes the expected question counts /
 * numbering per skill and verifies the answer key is complete.
 */
import {
  OET_SCHEMA_VERSION,
  collectQuestions,
  type OetQuestion,
  type OetTestImport
} from "./oet-test-schema";

export type ValidationResult =
  | { ok: true; doc: OetTestImport; totalQuestions: number }
  | { ok: false; errors: string[] };

const READING_COUNTS = { A: [1, 20], B: [21, 26], C: [27, 42] } as const;
const LISTENING_COUNTS = { A: [1, 24], B: [25, 30], C: [31, 42] } as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateQuestion(q: unknown, errs: string[], where: string): number | null {
  if (!isObj(q)) {
    errs.push(`${where}: question is not an object`);
    return null;
  }
  const n = typeof q.n === "number" ? q.n : null;
  if (n === null) errs.push(`${where}: missing numeric "n"`);
  const type = q.type;
  if (type === "letter_match") {
    if (!["A", "B", "C", "D"].includes(String(q.answer)))
      errs.push(`Q${n} (${where}): letter_match answer must be A/B/C/D`);
    if (typeof q.prompt !== "string" || !q.prompt.trim()) errs.push(`Q${n}: missing prompt`);
  } else if (type === "fill_blank") {
    const a = q.answer;
    if (!isObj(a) || !Array.isArray(a.terms) || a.terms.length === 0)
      errs.push(`Q${n} (${where}): fill_blank answer needs a non-empty "terms" array`);
    else if (a.mode !== "or" && a.mode !== "and")
      errs.push(`Q${n} (${where}): fill_blank answer.mode must be "or" or "and"`);
    if (typeof q.prompt !== "string" || !q.prompt.trim()) errs.push(`Q${n}: missing prompt`);
  } else if (type === "mcq") {
    if (!isObj(q.options) || Object.keys(q.options).length < 2)
      errs.push(`Q${n} (${where}): mcq needs an "options" object with ≥2 entries`);
    else if (typeof q.answer !== "string" || !(q.answer in (q.options as object)))
      errs.push(`Q${n} (${where}): mcq answer "${String(q.answer)}" is not one of the option keys`);
    if (typeof q.prompt !== "string" || !q.prompt.trim()) errs.push(`Q${n}: missing prompt`);
  } else {
    errs.push(`Q${n} (${where}): unknown question type "${String(type)}"`);
  }
  return n;
}

export function validateOetImport(raw: unknown): ValidationResult {
  const errs: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ["Pasted content is not a JSON object."] };

  if (raw.schemaVersion !== OET_SCHEMA_VERSION)
    errs.push(`schemaVersion must be ${OET_SCHEMA_VERSION} (got ${String(raw.schemaVersion)})`);
  if (raw.type !== "READING" && raw.type !== "LISTENING")
    return { ok: false, errors: [...errs, `type must be "READING" or "LISTENING" (got ${String(raw.type)})`] };
  if (typeof raw.title !== "string" || !raw.title.trim()) errs.push(`"title" is required`);
  if (!isObj(raw.timing) || typeof raw.timing.totalMinutes !== "number")
    errs.push(`"timing.totalMinutes" is required (a number)`);

  const seen = new Map<number, string>();
  const record = (n: number | null, where: string) => {
    if (n === null) return;
    if (seen.has(n)) errs.push(`Duplicate question number ${n} (also in ${seen.get(n)})`);
    else seen.set(n, where);
  };

  if (raw.type === "READING") {
    const pa = raw.partA, pb = raw.partB, pc = raw.partC;
    if (!isObj(pa) || !Array.isArray(pa.texts) || pa.texts.length !== 4)
      errs.push(`partA.texts must have exactly 4 texts (A–D)`);
    if (!isObj(pa) || !Array.isArray(pa.questions)) errs.push(`partA.questions must be an array`);
    else pa.questions.forEach((q, i) => record(validateQuestion(q, errs, `partA.questions[${i}]`), "Part A"));
    if (!isObj(pb) || !Array.isArray(pb.items)) errs.push(`partB.items must be an array`);
    else pb.items.forEach((q, i) => record(validateQuestion({ ...(q as object), type: "mcq" }, errs, `partB.items[${i}]`), "Part B"));
    if (!isObj(pc) || !Array.isArray(pc.texts)) errs.push(`partC.texts must be an array`);
    else pc.texts.forEach((t, ti) => {
      if (!isObj(t) || !Array.isArray(t.questions)) { errs.push(`partC.texts[${ti}].questions must be an array`); return; }
      t.questions.forEach((q, i) => record(validateQuestion(q, errs, `partC.texts[${ti}].questions[${i}]`), "Part C"));
    });
    checkNumbering(seen, READING_COUNTS, errs);
  } else {
    const pa = raw.partA, pb = raw.partB, pc = raw.partC;
    if (!isObj(pa) || !Array.isArray(pa.extracts)) errs.push(`partA.extracts must be an array`);
    else pa.extracts.forEach((e, ei) => {
      if (!isObj(e) || !Array.isArray(e.questions)) { errs.push(`partA.extracts[${ei}].questions must be an array`); return; }
      e.questions.forEach((q, i) => record(validateQuestion(q, errs, `partA.extracts[${ei}].questions[${i}]`), "Part A"));
    });
    if (!isObj(pb) || !Array.isArray(pb.items)) errs.push(`partB.items must be an array`);
    else pb.items.forEach((q, i) => record(validateQuestion({ ...(q as object), type: "mcq" }, errs, `partB.items[${i}]`), "Part B"));
    if (!isObj(pc) || !Array.isArray(pc.extracts)) errs.push(`partC.extracts must be an array`);
    else pc.extracts.forEach((e, ei) => {
      if (!isObj(e) || !Array.isArray(e.questions)) { errs.push(`partC.extracts[${ei}].questions must be an array`); return; }
      e.questions.forEach((q, i) => record(validateQuestion(q, errs, `partC.extracts[${ei}].questions[${i}]`), "Part C"));
    });
    checkNumbering(seen, LISTENING_COUNTS, errs);
  }

  if (errs.length > 0) return { ok: false, errors: errs };
  const doc = raw as unknown as OetTestImport;
  const total = countQuestions(doc);
  return { ok: true, doc, totalQuestions: total };
}

function checkNumbering(
  seen: Map<number, string>,
  ranges: { A: readonly [number, number]; B: readonly [number, number]; C: readonly [number, number] },
  errs: string[]
) {
  const expected = new Set<number>();
  for (const [lo, hi] of [ranges.A, ranges.B, ranges.C]) for (let i = lo; i <= hi; i++) expected.add(i);
  for (const n of expected) if (!seen.has(n)) errs.push(`Missing question ${n}`);
  for (const n of seen.keys()) if (!expected.has(n)) errs.push(`Unexpected question ${n} (outside 1–${ranges.C[1]})`);
}

function countQuestions(doc: OetTestImport): number {
  const qs: OetQuestion[] = collectQuestions(doc);
  return qs.length;
}
