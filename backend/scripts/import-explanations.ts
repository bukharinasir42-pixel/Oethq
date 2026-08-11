/**
 * import-explanations.ts — attach explanation files to the papers they belong to.
 *
 *   npm run explanations:import -- ./explanations
 *   npm run explanations:import -- ./explanations/oet-hq-reading-test-no-4.json
 *   npm run explanations:import -- ./explanations --dry
 *
 * Explanations travel separately from the papers, and this is what joins them.
 * Nothing in a paper is read or written: the file's question numbers are matched
 * against the paper's, and only the explanation rows are touched.
 *
 * A paper is found by `meta.testId` first, then by `meta.title` against the
 * imported test's title. A file that matches nothing is reported rather than
 * skipped quietly, because a silent miss looks exactly like a successful run.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { ExplanationsService } from "../src/modules/tests/explanations/explanations.service";
import type { PrismaService } from "../src/common/prisma.service";

const prisma = new PrismaClient();

function collect(path: string): string[] {
  const full = resolve(path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full)
    .filter((f) => extname(f).toLowerCase() === ".json")
    .map((f) => join(full, f))
    .sort();
}

/** A title reduced to what survives punctuation and casing differences. */
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const paths = args.filter((a) => !a.startsWith("--"));
  if (paths.length === 0) {
    console.log("Give a file or a folder:  npm run explanations:import -- ./explanations");
    process.exit(1);
  }

  const tests = await prisma.test.findMany({
    where: { type: "READING" },
    select: { id: true, title: true }
  });
  const byTitle = new Map(tests.map((t) => [slug(t.title), t]));

  const files = paths.flatMap(collect);
  const svc = new ExplanationsService(prisma as unknown as PrismaService);
  let matched = 0;
  let unmatched = 0;

  for (const file of files) {
    const name = basename(file);
    let doc: { meta?: { testId?: string; title?: string }; items?: Record<string, unknown> };
    try {
      doc = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      console.log(`✗ ${name} — could not read: ${e instanceof Error ? e.message : e}`);
      unmatched++;
      continue;
    }

    const candidates = [doc.meta?.testId, doc.meta?.title, basename(file, ".json")].filter(Boolean) as string[];
    const test = candidates.map((c) => byTitle.get(slug(c))).find(Boolean);

    if (!test) {
      console.log(`✗ ${name} — no imported Reading paper matches ${candidates.map((c) => `"${c}"`).join(" or ")}`);
      unmatched++;
      continue;
    }

    if (dry) {
      console.log(`· ${name} → ${test.title}  (${Object.keys(doc.items ?? {}).length} items, not written)`);
      matched++;
      continue;
    }

    const out = await svc.saveFromFile(test.id, doc);
    console.log(
      `✓ ${name} → ${test.title}\n` +
        `    ${out.published} published, ${out.drafted} held as draft, ${out.skipped} left alone (hand edited), ${out.total} in file`
    );
    matched++;
  }

  console.log(`\n${files.length} file(s). ${matched} matched, ${unmatched} unmatched.`);
  if (unmatched > 0) process.exitCode = 1;
  await prisma.$disconnect();
}

void main();
