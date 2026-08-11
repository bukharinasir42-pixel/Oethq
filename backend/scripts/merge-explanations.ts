/**
 * merge-explanations.ts — one paper plus its explanations, as one file.
 *
 *   npm run explanations:merge -- ./papers ./explanations ./out
 *
 * Produces, for each paper, a single JSON carrying the test, the answer key and
 * the explanations together. That file is the whole upload: drop it into the
 * admin panel and the paper, its key and all 42 explanations go live in one
 * action.
 *
 * Authoring stays split, because the two change at different rates and a paper
 * should not be reimported to fix a sentence. This is the packaging step.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

type Item = Record<string, unknown>;

function slug(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function jsonFiles(dir: string): string[] {
  const full = resolve(dir);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? jsonFiles(join(full, e.name))
      : extname(e.name).toLowerCase() === ".json"
        ? [join(full, e.name)]
        : []
  );
}

function main() {
  const [papersDir, explDir, outDir] = process.argv.slice(2);
  if (!papersDir || !explDir || !outDir) {
    console.log("Usage:  npm run explanations:merge -- ./papers ./explanations ./out");
    process.exit(1);
  }
  mkdirSync(resolve(outDir), { recursive: true });

  // Index the explanation files by every name they could be found under.
  const index = new Map<string, { file: string; items: Record<string, Item> }>();
  for (const file of jsonFiles(explDir)) {
    const doc = JSON.parse(readFileSync(file, "utf8")) as {
      meta?: { testId?: string; title?: string };
      items?: Record<string, Item>;
    };
    if (!doc.items) continue;
    const entry = { file, items: doc.items };
    for (const key of [doc.meta?.testId, doc.meta?.title, basename(file, ".json")]) {
      if (key) index.set(slug(key), entry);
    }
  }

  let merged = 0;
  let missing = 0;

  for (const file of jsonFiles(papersDir).sort()) {
    const paper = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const title = String(paper.title ?? basename(file, ".json"));
    const entry = index.get(slug(title)) ?? index.get(slug(basename(file, ".json")));

    if (!entry) {
      console.log(`✗ ${basename(file)} — no explanations found for "${title}"`);
      missing++;
      continue;
    }

    // Key the items by question number. The "A1"/"C27" keys are labels; `n` is
    // what binds, so a mis-keyed item still lands on the right question.
    const byNumber = new Map<number, Item>();
    for (const [key, item] of Object.entries(entry.items)) {
      const n = Number(item.n ?? key.replace(/^[A-Za-z]+/, ""));
      if (Number.isFinite(n)) byNumber.set(n, item);
    }

    let attached = 0;
    const attach = (q: Record<string, unknown>) => {
      const item = byNumber.get(Number(q.n));
      if (!item) return;
      // `part` and `n` are the paper's business, not the explanation's.
      const { part: _part, n: _n, ...rest } = item;
      q.explanation = rest;
      attached++;
    };

    const partA = paper.partA as { questions?: Array<Record<string, unknown>> } | undefined;
    partA?.questions?.forEach(attach);
    const partB = paper.partB as { items?: Array<Record<string, unknown>> } | undefined;
    partB?.items?.forEach(attach);
    const partC = paper.partC as { texts?: Array<{ questions?: Array<Record<string, unknown>> }> } | undefined;
    partC?.texts?.forEach((t) => t.questions?.forEach(attach));

    const out = join(resolve(outDir), basename(file));
    writeFileSync(out, JSON.stringify(paper, null, 2));
    console.log(`✓ ${basename(file)} — ${attached} explanations merged in`);
    merged++;
  }

  console.log(`\n${merged} merged, ${missing} without explanations. Written to ${resolve(outDir)}`);
  if (missing > 0) process.exitCode = 1;
}

main();
