import fs from "fs";

const html = fs.readFileSync("c:/Users/PC/Downloads/oethq-website.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// Strip pairs array from first script, keep logic
let s0 = scripts[0];
s0 = s0.replace(/const pairs\s*=\s*\[[\s\S]*?\];/, "const pairs = []; /* stripped */");
fs.writeFileSync(
  "e:/oet/OET-LMS-Next-js/frontend/src/app/website/_ref-slider-logic.js",
  s0
);
console.log("slider logic bytes", s0.length);

// other scripts
fs.writeFileSync(
  "e:/oet/OET-LMS-Next-js/frontend/src/app/website/_ref-other-scripts.js",
  scripts.slice(1).join("\n\n/* ==== */\n\n")
);
console.log("other scripts", scripts.slice(1).map((s) => s.length));
