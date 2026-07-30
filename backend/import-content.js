/**
 * import-content.js — idempotently imports content-data.json into the TARGET
 * database (AWS RDS). Upserts by natural key where one exists, otherwise by id,
 * so it is safe to re-run. It ONLY touches content/reference tables — it never
 * creates or modifies users, subscriptions, purchases, attempts or results.
 *
 *   # point DATABASE_URL at RDS, then:
 *   node import-content.js
 *
 * REVIEW FIRST: on a live site this will OVERWRITE matching content rows
 * (e.g. plan prices by name, product prices by slug) with the values from
 * content-data.json. Run `npx prisma migrate deploy` BEFORE this.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();
const data = JSON.parse(fs.readFileSync("content-data.json", "utf8"));

// Same FK-safe order as the export.
const ORDER = [
  "storageObject", "plan", "product", "test", "listeningAudioTrack", "question",
  "pastPaper", "courseLecture", "dailyTask", "skillDrill", "spellingTerm",
  "readingArticle", "listeningPodcast", "writingCaseNote", "writingSetting",
  "websiteHomeContent", "howToIntroduction", "blog"
];

// Natural unique keys for upsert (else fall back to id).
const KEY = {
  plan: "name",
  product: "slug",
  writingSetting: "profession",
  dailyTask: "dayNumber",
  storageObject: "objectKey"
};

(async () => {
  for (const model of ORDER) {
    const rows = data[model] || [];
    let ok = 0;
    const errors = [];
    for (const row of rows) {
      const { id, ...rest } = row;             // never write id into `update`
      const keyField = KEY[model];
      const where = keyField ? { [keyField]: row[keyField] } : { id };
      const create = { ...row };               // create keeps id + all scalars
      try {
        await prisma[model].upsert({ where, update: rest, create });
        ok++;
      } catch (e) {
        errors.push(`${row[keyField] || id}: ${String(e.message).split("\n")[0]}`);
      }
    }
    console.log(`${model}: ${ok}/${rows.length}` + (errors.length ? `  (${errors.length} skipped)` : ""));
    errors.slice(0, 5).forEach((e) => console.log(`   - ${e}`));
  }
  await prisma.$disconnect();
  console.log("\nContent import complete.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
