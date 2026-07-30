import fs from "fs";

const p = "e:/oet/OET-LMS-Next-js/frontend/src/app/website/oethq-home.css";
let css = fs.readFileSync(p, "utf8");

// Universal resets inside scopes fight Tailwind / nested React components
css = css.replace(/\.pb-scope,\.pb-scope \*\{margin:0;padding:0;box-sizing:border-box\}\s*/g, ".pb-scope,.pb-scope *{box-sizing:border-box}\n");
css = css.replace(/\.sl-scope,\.sl-scope \*\{margin:0;padding:0;box-sizing:border-box\}\s*/g, ".sl-scope,.sl-scope *{box-sizing:border-box}\n");
css = css.replace(/\.pt-scope,\.pt-scope \*\{margin:0;padding:0;box-sizing:border-box\}\s*/g, ".pt-scope,.pt-scope *{box-sizing:border-box}\n");

fs.writeFileSync(p, css);
console.log("cleared universal padding resets");
