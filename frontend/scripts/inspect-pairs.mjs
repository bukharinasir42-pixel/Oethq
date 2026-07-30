import fs from "fs";

const html = fs.readFileSync("c:/Users/PC/Downloads/oethq-website.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const idx = scripts[0].indexOf("const pairs");
console.log(scripts[0].slice(idx, idx + 500));
console.log("---");
// find structure: look for before: or array of arrays
const afterConst = scripts[0].slice(idx, idx + 2000);
console.log("has before:", afterConst.includes("before"));
console.log("has data:image count in first 50k of pairs area:", (scripts[0].slice(idx, idx + 50000).match(/data:image/g) || []).length);
