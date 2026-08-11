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
  "direct_information", "near_miss_form"
]);

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
    .trim()
    .toLowerCase();
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

function checkPaper(file: string): { issues: Issue[]; total: number; explained: number } {
  const paper = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const issues: Issue[] = [];
  const qs = questions(paper);
  let explained = 0;

  if (qs.length === 0) issues.push({ level: "error", where: "paper", what: "no questions found — is this a Reading paper?" });

  for (const q of qs) {
    const ex = q.ex;
    if (!ex) continue;
    explained++;
    const at = `Q${q.n} (Part ${q.part})`;

    const evidence = typeof ex.evidence === "string" ? ex.evidence.trim() : "";
    const reasoning = typeof ex.reasoning === "string" ? ex.reasoning.trim() : "";

    if (!evidence) issues.push({ level: "error", where: at, what: "no evidence — the explanation will be dropped on import" });
    if (!reasoning) issues.push({ level: "error", where: at, what: "no reasoning — the explanation will be dropped on import" });

    // The one that actually breaks the feature.
    if (evidence && !loose(q.passage).includes(loose(evidence))) {
      issues.push({
        level: "error",
        where: at,
        what: `evidence is not word-for-word in the passage, so the highlight will not land: "${evidence.slice(0, 70)}…"`
      });
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

    const opts = ex.options as Record<string, { verdict?: string; trap?: string; why?: string }> | undefined;
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
          if (!["correct", "distractor", "partial"].includes(String(v.verdict))) {
            issues.push({ level: "error", where: at, what: `option ${key} verdict "${v.verdict}" is not correct/distractor/partial` });
          }
          if (!v.why?.trim()) {
            issues.push({ level: "error", where: at, what: `option ${key} has no reason` });
          }
          if (v.trap && !TRAPS.has(v.trap)) {
            issues.push({ level: "warn", where: at, what: `option ${key} trap "${v.trap}" is not in the taxonomy — it will be dropped` });
          }
          if (v.verdict !== "correct" && !v.trap) {
            issues.push({ level: "warn", where: at, what: `option ${key} is wrong but the trap is not named` });
          }
        }
        const correct = Object.values(opts).filter((v) => v.verdict === "correct").length;
        if (correct !== 1) {
          issues.push({ level: "error", where: at, what: `${correct} options marked correct — there must be exactly one` });
        }
      }
    }
  }

  return { issues, total: qs.length, explained };
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
    console.log(`\n${mark} ${basename(file)} — ${result.explained}/${result.total} questions explained`);
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
