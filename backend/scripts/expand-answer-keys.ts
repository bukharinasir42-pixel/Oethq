/**
 * expand-answer-keys.ts — add the abbreviation a paper's own text establishes.
 *
 *   npm run keys:expand -- ./papers ./out          write the expanded papers
 *   npm run keys:expand -- ./papers --dry          list what would be added
 *
 * Spelling, drug names, word form and measurement formatting are handled by the
 * marker and need nothing here. Abbreviations cannot be: whether "UTI" answers
 * a question depends on whether THIS paper's passage says "urinary tract
 * infection (UTI)", and the marker never sees the passage.
 *
 * So the pairs are read out of the paper itself, and only out of the paper.
 * Nothing from a general medical dictionary is added, because an abbreviation
 * the text never uses is an answer the text never supports.
 *
 * Every addition is printed. This edits an answer key, which is the last thing
 * that should change quietly.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

type Pair = { long: string; short: string };

/**
 * Abbreviations every clinician reads without being told.
 *
 * Used ONLY when the abbreviation actually appears in that paper's own text. A
 * paper that never mentions a CT scan does not start accepting "computed
 * tomography" as an answer to something else.
 */
const STANDARD: Pair[] = [
  { short: "CT", long: "computed tomography" },
  { short: "MRI", long: "magnetic resonance imaging" },
  { short: "ECG", long: "electrocardiogram" },
  { short: "EEG", long: "electroencephalogram" },
  { short: "ABG", long: "arterial blood gas" },
  { short: "UTI", long: "urinary tract infection" },
  { short: "COPD", long: "chronic obstructive pulmonary disease" },
  { short: "AKI", long: "acute kidney injury" },
  { short: "CKD", long: "chronic kidney disease" },
  { short: "ATN", long: "acute tubular necrosis" },
  { short: "ICU", long: "intensive care unit" },
  { short: "ED", long: "emergency department" },
  { short: "LP", long: "lumbar puncture" },
  { short: "PEF", long: "peak expiratory flow" },
  { short: "FVC", long: "forced vital capacity" },
  { short: "NIV", long: "non-invasive ventilation" },
  { short: "IV", long: "intravenous" },
  { short: "GP", long: "general practitioner" },
  { short: "CVC", long: "central venous catheter" },
  { short: "DKA", long: "diabetic ketoacidosis" },
  { short: "CPR", long: "cardiopulmonary resuscitation" },
  { short: "CRP", long: "C-reactive protein" },
  { short: "PSA", long: "prostate-specific antigen" },
  { short: "RRT", long: "renal replacement therapy" }
];

function plain(v: unknown): string {
  return String(v ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every word of prose in a paper: the four Part A texts, Part B, Part C. */
function paperText(paper: Record<string, unknown>): string {
  const out: string[] = [];
  const blockText = (b: Record<string, unknown>) => {
    if (b.type === "p" || b.type === "note") out.push(plain(b.html));
    else if (b.type === "heading") out.push(plain(b.text));
    else if (b.type === "list") out.push(((b.items as string[]) ?? []).map(plain).join(" "));
    else if (b.type === "table") {
      out.push(((b.head as string[]) ?? []).map(plain).join(" "));
      out.push(((b.rows as string[][]) ?? []).flat().map(plain).join(" "));
    }
  };
  const partA = paper.partA as { texts?: Array<{ blocks?: Array<Record<string, unknown>> }> } | undefined;
  partA?.texts?.forEach((t) => t.blocks?.forEach(blockText));
  const partB = paper.partB as { items?: Array<Record<string, unknown>> } | undefined;
  partB?.items?.forEach((i) => out.push(plain(i.docHtml)));
  const partC = paper.partC as { texts?: Array<{ paras?: string[] }> } | undefined;
  partC?.texts?.forEach((t) => t.paras?.forEach((p) => out.push(plain(p))));
  return out.join(" ");
}

/**
 * The abbreviations this passage defines for itself.
 *
 * Only the two forms a text uses to introduce one:
 *   "urinary tract infection (UTI)"   and   "UTI (urinary tract infection)"
 *
 * The initials are checked against the words, so "the patient (John)" is not
 * mistaken for a definition.
 */
function pairsIn(text: string): Pair[] {
  const found = new Map<string, Pair>();

  const initialsMatch = (words: string[], abbr: string) => {
    const letters = abbr.replace(/[^A-Za-z]/g, "").toLowerCase();
    // A single long word abbreviated by letters drawn from inside it:
    // "electroencephalography (EEG)". The letters must appear in order and the
    // first must be the word's first, so "pneumonia (ABG)" cannot pass.
    if (words.length === 1) {
      const w = words[0].toLowerCase();
      if (w.length < 7 || w[0] !== letters[0]) return false;
      let at = 0;
      for (const ch of letters) {
        at = w.indexOf(ch, at);
        if (at === -1) return false;
        at++;
      }
      return true;
    }
    const initials = words.map((w) => w[0]?.toLowerCase() ?? "").join("");
    if (initials === letters) return true;
    // Allow small words to be skipped: "chronic obstructive pulmonary disease".
    const big = words.filter((w) => !/^(of|the|and|in|for|to|a|an)$/i.test(w));
    return big.map((w) => w[0]?.toLowerCase() ?? "").join("") === letters;
  };

  // long form (ABBR), including a single long word
  for (const m of text.matchAll(/((?:[A-Za-z][A-Za-z-]*\s+){0,6}[A-Za-z][A-Za-z-]*)\s*\(([A-Z][A-Za-z]{1,7})\)/g)) {
    const abbr = m[2];
    const words = m[1].trim().split(/\s+/);
    for (let take = Math.min(words.length, 6); take >= 1; take--) {
      const phrase = words.slice(words.length - take);
      if (initialsMatch(phrase, abbr)) {
        found.set(abbr.toLowerCase(), { long: phrase.join(" "), short: abbr });
        break;
      }
    }
  }

  // ABBR (long form)
  for (const m of text.matchAll(/\b([A-Z][A-Za-z]{1,7})\s*\(((?:[A-Za-z][A-Za-z-]*\s+){1,5}[A-Za-z][A-Za-z-]*)\)/g)) {
    const abbr = m[1];
    const words = m[2].trim().split(/\s+/);
    if (initialsMatch(words, abbr)) found.set(abbr.toLowerCase(), { long: words.join(" "), short: abbr });
  }

  for (const p of STANDARD) {
    if (found.has(p.short.toLowerCase())) continue;
    const usesShort = new RegExp(`\\b${p.short}\\b`).test(text);
    const usesLong = new RegExp(`\\b${p.long.replace(/[-\s]/g, "[-\\s]")}\\b`, "i").test(text);
    if (usesShort || usesLong) found.set(p.short.toLowerCase(), p);
  }

  return [...found.values()];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
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
  const dry = args.includes("--dry");
  const [papersPath, outDir] = args.filter((a) => !a.startsWith("--"));
  if (!papersPath || (!dry && !outDir)) {
    console.log("Usage:  npm run keys:expand -- ./papers ./out    (or --dry)");
    process.exit(1);
  }
  if (!dry) mkdirSync(resolve(outDir), { recursive: true });

  let added = 0;

  for (const file of collect(papersPath).sort()) {
    const paper = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const pairs = pairsIn(paperText(paper));
    const lines: string[] = [];

    const partA = paper.partA as { questions?: Array<Record<string, unknown>> } | undefined;
    for (const q of partA?.questions ?? []) {
      if (q.type !== "fill_blank") continue;
      const answer = q.answer as { terms?: string[]; display?: string } | undefined;
      if (!answer?.terms) continue;
      const have = new Set(answer.terms.map(norm));

      for (const p of pairs) {
        const hasLong = have.has(norm(p.long));
        const hasShort = have.has(norm(p.short));
        if (hasLong && !hasShort) {
          answer.terms.push(p.short);
          lines.push(`      Q${q.n}: + "${p.short}"  (the text defines it as "${p.long}")`);
          added++;
        } else if (hasShort && !hasLong) {
          answer.terms.push(p.long);
          lines.push(`      Q${q.n}: + "${p.long}"  (the text defines "${p.short}" as this)`);
          added++;
        }
      }
    }

    if (lines.length > 0) {
      console.log(`\n  ${basename(file)}  —  ${pairs.length} abbreviation(s) defined in the text`);
      lines.forEach((l) => console.log(l));
    }
    if (!dry) writeFileSync(join(resolve(outDir), basename(file)), JSON.stringify(paper, null, 2));
  }

  console.log(
    added === 0
      ? "\nNo answer key needed an abbreviation added. Every key already carries both forms, or the paper never defines one."
      : `\n${added} accepted term(s) added.${dry ? " Nothing was written (--dry)." : ""}`
  );
}

main();
