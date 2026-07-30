import fs from "fs";
import path from "path";

const htmlPath = "c:/Users/PC/Downloads/oethq-website.html";
const assetsDir = "e:/oet/OET-LMS-Next-js/frontend/public/images/oethq";
const outDir = "e:/oet/OET-LMS-Next-js/frontend/src/app/website";

fs.mkdirSync(assetsDir, { recursive: true });
const html = fs.readFileSync(htmlPath, "utf8");

function saveDataUrl(dataUrl, filename) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("bad data url for " + filename);
  const ext = m[1].includes("png") ? "png" : m[1].includes("jpeg") || m[1].includes("jpg") ? "jpg" : "bin";
  const file = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
  fs.writeFileSync(path.join(assetsDir, file), Buffer.from(m[2], "base64"));
  return `/images/oethq/${file}`;
}

// Logo from first hp-logo img
const logoMatch = html.match(/class="hp-logo"[^>]*>[\s\S]*?src="(data:image\/[^"]+)"/);
if (logoMatch) {
  console.log("logo", saveDataUrl(logoMatch[1], "logo"));
}

// Founder + team images from about-content
const aboutStart = html.indexOf('id="about-content"');
const aboutEnd = html.indexOf('id="page-blogs"');
const aboutHtml = html.slice(aboutStart, aboutEnd);
const aboutImgs = [...aboutHtml.matchAll(/src="(data:image\/[^"]+)"/g)].map((m) => m[1]);
const aboutNames = ["founder-nasir", "team-nasir", "team-zeeshan", "team-kalsoom"];
aboutImgs.forEach((src, i) => {
  if (aboutNames[i]) console.log(aboutNames[i], saveDataUrl(src, aboutNames[i]));
});

// Testimonial pairs from script
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const pairMatch = scripts[0]?.match(/const pairs\s*=\s*(\[[\s\S]*?\]);/);
if (!pairMatch) throw new Error("no pairs");

// Evaluate pairs carefully — it's an array of [before, after] data URLs
const pairs = eval(pairMatch[1]);
const pairPaths = pairs.map((pair, i) => {
  const before = saveDataUrl(pair[0], `story-${String(i + 1).padStart(2, "0")}-before`);
  const after = saveDataUrl(pair[1], `story-${String(i + 1).padStart(2, "0")}-after`);
  return { before, after };
});

fs.writeFileSync(
  path.join(outDir, "oethq-story-pairs.ts"),
  `export type OethqStoryPair = { before: string; after: string };\n\nexport const OETHQ_STORY_PAIRS: OethqStoryPair[] = ${JSON.stringify(pairPaths, null, 2)};\n`
);
console.log("stories", pairPaths.length);
console.log("assets dir size files", fs.readdirSync(assetsDir).length);
