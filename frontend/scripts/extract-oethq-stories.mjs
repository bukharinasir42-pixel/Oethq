import fs from "fs";
import path from "path";
import vm from "vm";

const htmlPath = "c:/Users/PC/Downloads/oethq-website.html";
const assetsDir = "e:/oet/OET-LMS-Next-js/frontend/public/images/oethq";
const outDir = "e:/oet/OET-LMS-Next-js/frontend/src/app/website";

fs.mkdirSync(assetsDir, { recursive: true });
const html = fs.readFileSync(htmlPath, "utf8");

function saveDataUrl(dataUrl, filename) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("bad data url for " + filename);
  const mime = m[1];
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const file = `${filename}.${ext}`;
  fs.writeFileSync(path.join(assetsDir, file), Buffer.from(m[2], "base64"));
  return `/images/oethq/${file}`;
}

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const pairMatch = scripts[0]?.match(/const pairs\s*=\s*(\[[\s\S]*?\]);/);
if (!pairMatch) throw new Error("no pairs");

const pairs = vm.runInNewContext(pairMatch[1]);
console.log("pairs count", pairs.length, "keys", Object.keys(pairs[0] || {}));

const pairPaths = pairs.map((pair, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    before: saveDataUrl(pair.before, `story-${n}-before`),
    after: saveDataUrl(pair.after, `story-${n}-after`),
  };
});

fs.writeFileSync(
  path.join(outDir, "oethq-story-pairs.ts"),
  `export type OethqStoryPair = { before: string; after: string };\n\nexport const OETHQ_STORY_PAIRS: OethqStoryPair[] = ${JSON.stringify(pairPaths, null, 2)};\n`
);
console.log("wrote", pairPaths.length, "stories");
console.log("files", fs.readdirSync(assetsDir).length);
