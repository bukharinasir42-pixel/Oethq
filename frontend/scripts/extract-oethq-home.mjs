import fs from "fs";
import path from "path";

const htmlPath = "c:/Users/PC/Downloads/oethq-website.html";
const outDir = "e:/oet/OET-LMS-Next-js/frontend/src/app/website";
const assetsDir = "e:/oet/OET-LMS-Next-js/frontend/public/images/oethq";

const html = fs.readFileSync(htmlPath, "utf8");

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("no style");

let css = styleMatch[1];
// Don't reset global * / body — scope under .oethq-home
css = css.replace(/^\*\{margin:0;padding:0;box-sizing:border-box\}\s*/m, "");
css = css.replace(/^html\{scroll-behavior:smooth\}\s*/m, ".oethq-home{scroll-behavior:smooth}\n");
css = css.replace(
  /^body\{([\s\S]*?)\}/m,
  `.oethq-home{$1}
.oethq-home img{max-width:100%;display:block}
.oethq-home a{text-decoration:none;color:inherit}`
);
// Remove duplicate img/a rules that followed body if present
css = css.replace(/^img\{max-width:100%;display:block\}\s*/m, "");
css = css.replace(/^a\{text-decoration:none;color:inherit\}\s*/m, "");

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "oethq-home.css"), `/* From oethq-website.html — do not hand-edit lightly */\n${css}`);
console.log("CSS bytes", css.length);

// Body from proof banner through footer (exclude hidden pages scripts later)
const proofStart = html.indexOf("<!-- proof banner -->");
const footerEnd = html.indexOf("</footer>") + "</footer>".length;
const bodyChunk = html.slice(proofStart, footerEnd);
fs.writeFileSync(path.join(outDir, "_ref-body-snippet.html"), bodyChunk);
console.log("Body snippet bytes", bodyChunk.length);

// Extract scripts
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
fs.writeFileSync(path.join(outDir, "_ref-scripts.js"), scripts.join("\n\n/* ==== NEXT ==== */\n\n"));
console.log("Scripts", scripts.length);

// Extract testimonial pairs from first script if present
const pairMatch = scripts[0]?.match(/const pairs\s*=\s*(\[[\s\S]*?\]);/);
if (pairMatch) {
  // Write raw pairs JS for later conversion — images stay as data URIs in component for fidelity
  fs.writeFileSync(path.join(outDir, "_ref-pairs.js"), `export const pairs = ${pairMatch[1]};\n`);
  console.log("pairs extracted", pairMatch[1].length);
}

console.log("done");
