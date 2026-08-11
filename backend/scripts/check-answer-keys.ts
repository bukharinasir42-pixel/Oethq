/**
 * check-answer-keys.ts — find short answers that will mark a correct response wrong.
 *
 *   npm run keys:check -- ./papers
 *
 * The marker forgives formatting: spacing, unit case, a typed comparator for a
 * symbol, an abbreviated unit, a written-out range. What it cannot forgive is a
 * key that is missing a genuinely different acceptable answer, because that is
 * not a formatting difference, it is a gap in the key.
 *
 * This reports the gaps a human has to decide on. It changes nothing.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { matchFillBlank } from "../src/modules/tests/oet-import/oet-scoring";
import type { OetFillAnswer } from "../src/modules/tests/oet-import/oet-test-schema";

type Finding = { n: number; level: "error" | "warn"; what: string };

function plain(html: unknown): string {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How a candidate might reasonably retype the same answer.
 *
 * Only realistic retypings. Testing that "cold packs" is accepted as
 * "coldpacks" produces a warning nobody will ever act on, and a report full of
 * those is a report that stops being read.
 */
function variantsOf(display: string): string[] {
  const v = new Set<string>([display, display.toLowerCase(), display.toUpperCase()]);
  const measurement = /\d/.test(display);

  if (measurement) {
    // The space before a unit is the one people leave out, every time.
    v.add(display.replace(/\s+/g, ""));
    v.add(display.replace(/(\d)\s+([a-zA-Zµμ%])/g, "$1$2"));
    v.add(display.replace(/[–—]/g, "-"));
    v.add(display.replace(/[–—-]/g, " to "));
    v.add(display.replace(/≥/g, ">=").replace(/≤/g, "<="));
    v.add(display.replace(/[µμ]/g, "u"));
    v.add(display.replace(/\bmL\b/gi, "ml"));
    v.add(display.replace(/\bminutes?\b/gi, "mins"));
    v.add(display.replace(/\bhours?\b/gi, "hrs"));
    // The unit a clinician adds without thinking about it.
    if (/mmol\b(?!\/)/i.test(display)) v.add(display.replace(/mmol\b/i, "mmol/L"));
    if (/\bu?mol\b|\bµmol\b/i.test(display)) v.add(`${display}/L`);
    if (/%/.test(display)) v.add(display.replace(/%/g, " percent"));
  } else {
    // A phrase is retyped with different spacing around a hyphen, or with the
    // article a candidate would naturally include.
    v.add(display.replace(/-/g, " "));
    v.add(display.replace(/\s*-\s*/g, "-"));
    v.add(`the ${display}`);
  }

  v.delete("");
  return [...v];
}

function checkPaper(file: string): { findings: Finding[]; checked: number } {
  const paper = JSON.parse(readFileSync(file, "utf8")) as {
    partA?: { questions?: Array<Record<string, unknown>> };
  };
  const findings: Finding[] = [];
  let checked = 0;

  for (const q of paper.partA?.questions ?? []) {
    if (q.type !== "fill_blank") continue;
    const n = Number(q.n);
    const answer = q.answer as OetFillAnswer | undefined;
    if (!answer || !Array.isArray(answer.terms) || answer.terms.length === 0) {
      findings.push({ n, level: "error", what: "no accepted terms — nothing can be marked correct" });
      continue;
    }
    checked++;

    const display = plain(answer.display ?? answer.terms[0]);

    // The key must accept its own displayed answer. When it does not, every
    // candidate who copies what the review screen shows them is marked wrong.
    if (display && !matchFillBlank(display, answer, "READING")) {
      findings.push({
        n,
        level: "error",
        what: `the key does not accept its own displayed answer "${display}"`
      });
    }

    for (const variant of variantsOf(display)) {
      if (!matchFillBlank(variant, answer, "READING")) {
        findings.push({ n, level: "warn", what: `would mark "${variant}" wrong` });
      }
    }

    // A single term with an "or" is usually a key that has not been thought
    // about, rather than a question with exactly one acceptable wording.
    if (answer.terms.length === 1 && answer.mode !== "and" && !/\d/.test(display)) {
      findings.push({ n, level: "warn", what: `only one accepted wording: "${display}"` });
    }
  }

  return { findings, checked };
}

function collect(path: string): string[] {
  const full = resolve(path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? collect(join(full, e.name))
      : extname(e.name).toLowerCase() === ".json"
        ? [join(full, e.name)]
        : []
  );
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Give a paper or a folder:  npm run keys:check -- ./papers");
    process.exit(1);
  }

  const files = args.flatMap(collect).sort();
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
    const errs = result.findings.filter((f) => f.level === "error");
    const warns = result.findings.filter((f) => f.level === "warn");
    errors += errs.length;
    warnings += warns.length;
    if (result.findings.length === 0) {
      console.log(`✓ ${basename(file)} — ${result.checked} short answers, all clean`);
      continue;
    }
    console.log(`${errs.length ? "✗" : "!"} ${basename(file)} — ${result.checked} short answers`);
    for (const f of [...errs, ...warns]) {
      console.log(`    ${f.level === "error" ? "ERROR" : "warn "}  Q${f.n}: ${f.what}`);
    }
  }

  console.log(`\n${files.length} paper(s). ${errors} error(s), ${warnings} warning(s).`);
  if (errors > 0) process.exitCode = 1;
}

main();
