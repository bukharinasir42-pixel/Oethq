/**
 * check-paper.ts — validate a Reading paper before it goes near the system.
 *
 *   npm run paper:check -- ./papers
 *   npm run paper:check -- ./papers/paper-01.json
 *
 * Runs entirely offline. No database, no API key, no network.
 *
 * The check that matters is the evidence quote. The review screen finds that
 * string in the passage and highlights it, so a quote that has been paraphrased,
 * had its punctuation tidied, or stitched together from two non-adjacent
 * sentences will silently degrade the feature to a quotation in a box. The
 * student is then told to look at a highlight that is not there, which is worse
 * than having no explanation at all — so it is caught here, not in a browser.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const TRAPS = new Set([
  "wrong_referent", "adjacent_entity", "partial_support", "superseded", "true_not_asked",
  "lexical_lure", "unstated_state", "absolute_language", "unlicensed_ranking",
  "sufficiency_overclaim", "function_mismatch", "speaker_attribution", "over_inference",
  "direct_information", "near_miss_form", "not_stated"
]);

/** Short names the authoring tool uses for the same traps. */
const TRAP_ALIASES = new Set([
  "referent", "adjacent", "partial", "notasked", "not_asked", "lure", "state",
  "absolute", "ranking", "completeness", "function", "speaker", "absent",
  "overinfer", "form", "direct"
]);

const CONFIDENCES = new Set(["high", "medium", "low"]);

const QUESTION_TYPES = new Set([
  "fact", "main_idea", "purpose", "inference", "reference",
  "vocabulary", "tone", "comparison", "cause_effect", "detail"
]);

const DIFFICULTIES = new Set(["C1", "C2", "C3"]);

type Issue = { level: "error" | "warn"; where: string; what: string };

function plain(html: string): string {
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|h[1-6]|tr|div)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function loose(s: string): string {
  return plain(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    // A range broken across a line comes back as "12- 16" where the passage
    // reads "12-16". The space is a artefact of how the source was flattened,
    // not a difference in what the sentence says.
    .replace(/\s*-\s*/g, "-")
    .trim()
    .toLowerCase();
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** The quotes, from either the string shape or the array of located quotes. */
function evidenceQuotes(raw: unknown): string[] {
  if (typeof raw === "string") return raw.trim() ? [raw.trim()] : [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => (typeof e === "string" ? e : String((e as Record<string, unknown>)?.quote ?? "")))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * One quote, split on its ellipses.
 *
 * A quote may skip a clause: "the effect remains measurable … even in low-ratio
 * units". Each side is located separately in the passage, so each side is what
 * has to match. Short offcuts are ignored, because a two-word fragment matches
 * somewhere by accident and tells you nothing.
 */
function fragments(quote: string): string[] {
  return quote
    .split(/…|\.\.\./)
    .map((f) => f.trim().replace(/^[,;:.\-\s]+|[,;:\-\s]+$/g, ""))
    .filter((f) => f.length >= 14);
}

function blockText(b: Record<string, unknown>): string {
  if (b.type === "p" || b.type === "note") return String(b.html ?? "");
  if (b.type === "heading") return String(b.text ?? "");
  if (b.type === "list") return ((b.items as string[]) ?? []).join(" ");
  if (b.type === "table") {
    const head = ((b.head as string[]) ?? []).join(" ");
    const rows = ((b.rows as string[][]) ?? []).map((r) => r.join(" ")).join(" ");
    return `${head} ${rows}`;
  }
  return "";
}

/** Every question with the passage its answer must come from. */
function questions(paper: Record<string, unknown>) {
  const out: Array<{ n: number; part: string; passage: string; options?: Record<string, string>; ex?: Record<string, unknown> }> = [];

  const partA = paper.partA as { texts?: Array<{ blocks?: Array<Record<string, unknown>> }>; questions?: Array<Record<string, unknown>> } | undefined;
  const aText = (partA?.texts ?? []).map((t) => (t.blocks ?? []).map(blockText).join(" ")).join(" ");
  for (const q of partA?.questions ?? []) {
    out.push({ n: Number(q.n), part: "A", passage: aText, ex: q.explanation as Record<string, unknown> | undefined });
  }

  const partB = paper.partB as { items?: Array<Record<string, unknown>> } | undefined;
  for (const it of partB?.items ?? []) {
    out.push({
      n: Number(it.n),
      part: "B",
      passage: String(it.docHtml ?? ""),
      options: it.options as Record<string, string> | undefined,
      ex: it.explanation as Record<string, unknown> | undefined
    });
  }

  const partC = paper.partC as { texts?: Array<{ paras?: string[]; questions?: Array<Record<string, unknown>> }> } | undefined;
  for (const t of partC?.texts ?? []) {
    const passage = (t.paras ?? []).join(" ");
    for (const q of t.questions ?? []) {
      out.push({
        n: Number(q.n),
        part: "C",
        passage,
        options: q.options as Record<string, string> | undefined,
        ex: q.explanation as Record<string, unknown> | undefined
      });
    }
  }
  return out;
}

function checkPaper(file: string): { issues: Issue[]; total: number; explained: number; draft: number } {
  const paper = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const issues: Issue[] = [];
  const qs = questions(paper);
  let explained = 0;
  let draft = 0;

  if (qs.length === 0) issues.push({ level: "error", where: "paper", what: "no questions found — is this a Reading paper?" });

  for (const q of qs) {
    const ex = q.ex;
    if (!ex) continue;
    explained++;
    const at = `Q${q.n} (Part ${q.part})`;

    const quotes = evidenceQuotes(ex.evidence);
    const reasoning = typeof ex.reasoning === "string" ? ex.reasoning.trim() : "";

    // Evidence is the one thing that cannot be missing: without it there is
    // nothing to locate, and the record is dropped on import.
    if (quotes.length === 0) {
      issues.push({ level: "error", where: at, what: "no evidence — the explanation will be dropped on import" });
    }
    // A located item whose analysis is still owed is a draft, not a fault. It
    // imports, keeps its verified evidence, and stays out of a student's way
    // until the prose is written.
    if (quotes.length > 0 && !reasoning) draft++;

    // The one that actually breaks the feature. Each quote is checked, and an
    // ellipsis inside a quote splits it: the screen locates and marks each side
    // separately, so each side has to be findable on its own.
    const hay = loose(q.passage);
    for (const quote of quotes) {
      for (const frag of fragments(quote)) {
        if (!hay.includes(loose(frag))) {
          issues.push({
            level: "error",
            where: at,
            what: `evidence is not word-for-word in the passage, so the highlight will not land: "${frag.slice(0, 70)}…"`
          });
        }
      }
    }

    for (const pair of asArray(ex.bridge)) {
      const b = pair as Record<string, unknown>;
      if (!String(b.stem ?? "").trim() || !String(b.text ?? "").trim()) {
        issues.push({ level: "warn", where: at, what: "a paraphrase mapping row is missing its stem or its text side" });
        continue;
      }
      // The right-hand side is the text's own wording, so it should be in the
      // text. A mapping that points at a phrase which is not there is teaching
      // the student a paraphrase the examiner never wrote.
      if (!hay.includes(loose(String(b.text)))) {
        issues.push({
          level: "warn",
          where: at,
          what: `paraphrase mapping points at "${String(b.text).slice(0, 50)}", which is not in the passage`
        });
      }
    }

    for (const cw of asArray(ex.commonWrong)) {
      const c = cw as Record<string, unknown>;
      if (!String(c.wrote ?? "").trim() || !String(c.why ?? "").trim()) {
        issues.push({ level: "warn", where: at, what: "a near-miss answer is missing what was written or why it fails" });
      }
    }

    if (typeof ex.confidence === "string" && !CONFIDENCES.has(ex.confidence.toLowerCase())) {
      issues.push({ level: "warn", where: at, what: `confidence "${ex.confidence}" is not high, medium or low — it will be dropped` });
    }

    if (typeof ex.difficulty === "string" && !DIFFICULTIES.has(ex.difficulty)) {
      issues.push({ level: "warn", where: at, what: `difficulty "${ex.difficulty}" is not C1, C2 or C3 — it will be dropped` });
    }
    if (typeof ex.questionType === "string" && !QUESTION_TYPES.has(ex.questionType)) {
      issues.push({ level: "warn", where: at, what: `questionType "${ex.questionType}" is not in the taxonomy — it will be dropped` });
    }

    // Em dashes are excluded by the style specification.
    for (const [field, value] of Object.entries(ex)) {
      if (typeof value === "string" && /[—–]/.test(value)) {
        issues.push({ level: "warn", where: at, what: `${field} contains an em or en dash` });
      }
    }

    const opts = ex.options as
      | Record<string, { verdict?: string; trap?: string; tag?: string; fails?: string; why?: string }>
      | undefined;
    if (q.options) {
      if (!opts) {
        issues.push({ level: "warn", where: at, what: "multiple choice with no option verdicts" });
      } else {
        for (const key of Object.keys(q.options)) {
          const v = opts[key];
          if (!v) {
            issues.push({ level: "warn", where: at, what: `option ${key} has no verdict` });
            continue;
          }
          if (v.verdict !== undefined && !["correct", "distractor", "partial"].includes(String(v.verdict))) {
            issues.push({ level: "error", where: at, what: `option ${key} verdict "${v.verdict}" is not correct/distractor/partial` });
          }
          if (!v.why?.trim() && reasoning) {
            issues.push({ level: "error", where: at, what: `option ${key} has no reason` });
          }
          const trap = v.trap ?? v.tag;
          if (trap && !TRAPS.has(trap) && !TRAP_ALIASES.has(trap)) {
            issues.push({ level: "warn", where: at, what: `option ${key} trap "${trap}" is not in the taxonomy — it will be dropped` });
          }
          if (reasoning && v.verdict !== "correct" && !trap) {
            issues.push({ level: "warn", where: at, what: `option ${key} is wrong but the trap is not named` });
          }
          // The failing component is what turns "this option is wrong" into
          // teaching. Its absence is the difference between an explanation and
          // an assertion, so it is called out rather than left to the reader.
          if (reasoning && v.verdict !== "correct" && !v.fails?.trim()) {
            issues.push({ level: "warn", where: at, what: `option ${key} is wrong but the failing phrase is not quoted` });
          }
          if (v.fails?.trim() && q.options[key] && !loose(q.options[key]).includes(loose(v.fails))) {
            issues.push({
              level: "warn",
              where: at,
              what: `option ${key} fails on "${v.fails.slice(0, 50)}", which is not in option ${key}`
            });
          }
        }
        const correct = Object.values(opts).filter((v) => v.verdict === "correct" || (v as { ok?: boolean }).ok === true).length;
        if (correct !== 1) {
          issues.push({ level: "error", where: at, what: `${correct} options marked correct — there must be exactly one` });
        }
      }
    }
  }

  return { issues, total: qs.length, explained, draft };
}

function collect(path: string): string[] {
  const full = resolve(path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full)
    .filter((f) => extname(f).toLowerCase() === ".json")
    .map((f) => join(full, f))
    .sort();
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Give a paper or a folder:  npm run paper:check -- ./papers");
    process.exit(1);
  }

  const files = args.flatMap(collect);
  let errors = 0;
  let warnings = 0;

  for (const file of files) {
    let result;
    try {
      result = checkPaper(file);
    } catch (e) {
      console.log(`\n✗ ${basename(file)} — could not read: ${e instanceof Error ? e.message : e}`);
      errors++;
      continue;
    }

    const errs = result.issues.filter((i) => i.level === "error");
    const warns = result.issues.filter((i) => i.level === "warn");
    errors += errs.length;
    warnings += warns.length;

    const mark = errs.length === 0 ? "✓" : "✗";
    const written = result.explained - result.draft;
    console.log(
      `\n${mark} ${basename(file)} — ${result.explained}/${result.total} explained` +
        (result.draft > 0 ? `  (${written} written, ${result.draft} awaiting prose, held as drafts)` : "")
    );
    for (const i of [...errs, ...warns]) {
      console.log(`    ${i.level === "error" ? "ERROR" : "warn "}  ${i.where}: ${i.what}`);
    }
  }

  console.log(`\n${files.length} paper(s). ${errors} error(s), ${warnings} warning(s).`);
  if (errors > 0) {
    console.log("Errors will cost you the explanation, or the highlight. Fix them before importing.");
    process.exitCode = 1;
  }
}

main();
