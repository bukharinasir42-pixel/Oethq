import fs from "fs";

const p = "e:/oet/OET-LMS-Next-js/frontend/src/app/website/oethq-home.css";
let css = fs.readFileSync(p, "utf8");

const header = `/* From oethq-website.html — do not hand-edit lightly */
.oethq-home,.oethq-rest{
  --hp-font-sans: var(--font-oethq-sans, 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif);
  --hp-font-display: var(--font-oethq-display, 'Sora', sans-serif);
  --hp-font-mono: var(--font-oethq-mono, 'IBM Plex Mono', monospace);
}
`;

if (!css.includes("--hp-font-sans")) {
  css = css.replace("/* From oethq-website.html — do not hand-edit lightly */\n", header);
}

css = css.split("font-family:'Sora',sans-serif").join("font-family:var(--hp-font-display)");
css = css.split("font-family:'IBM Plex Mono',monospace").join("font-family:var(--hp-font-mono)");
css = css.split("font-family:'Plus Jakarta Sans','Inter',system-ui,sans-serif").join("font-family:var(--hp-font-sans)");
css = css.split("font-family:'Inter',system-ui,sans-serif").join("font-family:var(--hp-font-sans)");

// Don't force color inherit on all links in hero/nav area — scope to rest
css = css.replace(
  ".oethq-home a{text-decoration:none;color:inherit}",
  ".oethq-rest a{text-decoration:none;color:inherit}"
);

fs.writeFileSync(p, css);
console.log("updated fonts");
