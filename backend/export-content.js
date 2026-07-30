/**
 * export-content.js — exports CONTENT / REFERENCE tables only (never users,
 * subscriptions, purchases, attempts, results or any per-student data) to a
 * portable JSON file. Run against the SOURCE database:
 *
 *   node export-content.js
 *
 * Produces content-data.json. Import into the target (RDS) with import-content.js.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();

// FK-safe order: parents before children. Content only.
const MODELS = [
  "storageObject",       // referenced by lectures / website video / how-to
  "plan",                // also seed-able; included for completeness
  "product",             // also seed-able
  "test",
  "listeningAudioTrack", // -> test
  "question",            // -> test
  "pastPaper",           // -> test(s)
  "courseLecture",
  "dailyTask",           // 40-day study plan
  "skillDrill",
  "spellingTerm",        // ~1938 rows
  "readingArticle",
  "listeningPodcast",
  "writingCaseNote",
  "writingSetting",
  "websiteHomeContent",
  "howToIntroduction",
  "blog"
];

(async () => {
  const out = {};
  const counts = {};
  for (const m of MODELS) {
    const rows = await prisma[m].findMany();
    out[m] = rows;
    counts[m] = rows.length;
  }
  fs.writeFileSync(
    "content-data.json",
    JSON.stringify(out, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
  );
  console.log("Exported content-data.json");
  console.table(counts);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
