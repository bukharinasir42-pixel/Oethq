/**
 * ingest-knowledge.ts — load the assistant's knowledge base from files on disk.
 *
 * The admin page takes pasted text, which is right for an FAQ and wrong for the
 * real job: hundreds of pages of exported conversations and transcripts, in
 * dozens of files. This reads them straight from a folder, so nothing has to go
 * through a browser or a request body limit.
 *
 *   npm run chat:ingest -- ./exports
 *   npm run chat:ingest -- ./exports/whatsapp.txt --format conversation
 *   npm run chat:ingest -- ./exports --dry-run
 *
 * Format is chosen per file from its extension, and can be forced with
 * --format conversation|document|qa_json. Getting it right matters: an export
 * split as a document produces passages that straddle six unrelated questions
 * and retrieve badly.
 *
 * Re-running creates NEW batches rather than replacing the old ones — deliberate,
 * because a bad import should be reviewed and switched off in the admin page,
 * not silently overwrite something that was working.
 */
import "../src/load-env";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { PrismaService } from "../src/common/prisma.service";
import { KnowledgeService } from "../src/modules/chat/knowledge.service";
import { chunkConversation, chunkDocument, chunkQaJson, type DraftChunk } from "../src/modules/chat/chunker";

type Format = "conversation" | "document" | "qa_json";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".text", ".csv", ".vtt", ".srt"]);

function parseArgs(argv: string[]) {
  const paths: string[] = [];
  let format: Format | null = null;
  let dryRun = false;
  let name: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") format = argv[++i] as Format;
    else if (a === "--name") name = argv[++i];
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--")) throw new Error(`Unknown option: ${a}`);
    else paths.push(a);
  }
  if (paths.length === 0) {
    throw new Error("Give a file or folder to ingest, e.g. npm run chat:ingest -- ./exports");
  }
  if (format && !["conversation", "document", "qa_json"].includes(format)) {
    throw new Error(`--format must be conversation, document or qa_json (got "${format}")`);
  }
  return { paths, format, dryRun, name };
}

/** Every readable text file under a path, recursively. */
function collectFiles(path: string): string[] {
  const full = resolve(path);
  const st = statSync(full);
  if (st.isFile()) return [full];
  const out: string[] = [];
  for (const entry of readdirSync(full)) {
    if (entry.startsWith(".")) continue;
    const child = join(full, entry);
    const cst = statSync(child);
    if (cst.isDirectory()) out.push(...collectFiles(child));
    else if (TEXT_EXTENSIONS.has(extname(entry).toLowerCase()) || extname(entry).toLowerCase() === ".json") {
      out.push(child);
    }
  }
  return out.sort();
}

/**
 * Guess the format when it was not forced.
 *
 * The conversation check is a real check, not an extension guess: a `.txt` may
 * be a transcript or a WhatsApp export, and they need different splits. If four
 * or more lines look like "date, time - sender: message", it is an export.
 */
function detectFormat(file: string, text: string): Format {
  if (extname(file).toLowerCase() === ".json") return "qa_json";
  const timestamped = text
    .split("\n")
    .slice(0, 400)
    .filter((l) => /^\s*\[?\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4},?\s+\d{1,2}:\d{2}/.test(l)).length;
  return timestamped >= 4 ? "conversation" : "document";
}

function chunkFor(format: Format, text: string): DraftChunk[] {
  if (format === "conversation") return chunkConversation(text);
  if (format === "qa_json") return chunkQaJson(text);
  return chunkDocument(text);
}

async function main() {
  const { paths, format, dryRun, name } = parseArgs(process.argv.slice(2));

  const files = paths.flatMap(collectFiles);
  if (files.length === 0) {
    console.log("No readable text files found (.txt .md .csv .vtt .srt .json).");
    return;
  }

  console.log(`Found ${files.length} file(s).${dryRun ? "  DRY RUN — nothing will be written." : ""}\n`);

  const prisma = new PrismaService();
  const knowledge = new KnowledgeService(prisma);
  let totalChunks = 0;
  let failures = 0;

  try {
    for (const file of files) {
      const label = basename(file);
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch (e) {
        console.log(`  ✗ ${label} — could not read: ${e instanceof Error ? e.message : e}`);
        failures++;
        continue;
      }
      if (!text.trim()) {
        console.log(`  · ${label} — empty, skipped`);
        continue;
      }

      const fmt = format ?? detectFormat(file, text);
      let chunks: DraftChunk[];
      try {
        chunks = chunkFor(fmt, text);
      } catch (e) {
        console.log(`  ✗ ${label} — ${e instanceof Error ? e.message : e}`);
        failures++;
        continue;
      }

      if (chunks.length === 0) {
        console.log(`  · ${label} — produced no passages, skipped`);
        continue;
      }

      if (dryRun) {
        const preview = chunks[0].content.replace(/\n/g, " ").slice(0, 90);
        console.log(`  → ${label}  [${fmt}]  ${chunks.length} passages`);
        console.log(`      first passage: ${preview}…`);
        totalChunks += chunks.length;
        continue;
      }

      try {
        const out = await knowledge.ingestChunks({
          name: name ? `${name} — ${label}` : label,
          kind: fmt,
          chunks
        });
        console.log(`  ✓ ${label}  [${fmt}]  ${out.chunkCount} passages`);
        totalChunks += out.chunkCount;
      } catch (e) {
        console.log(`  ✗ ${label} — ${e instanceof Error ? e.message : e}`);
        failures++;
      }
    }

    console.log(
      `\n${dryRun ? "Would add" : "Added"} ${totalChunks} passages from ${files.length - failures} file(s).` +
        (failures ? `  ${failures} failed.` : "")
    );
    if (!dryRun && totalChunks > 0) {
      console.log("Check them in the admin page under Assistant → Try a question.");
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }

  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
