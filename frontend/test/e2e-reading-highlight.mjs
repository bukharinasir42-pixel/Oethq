/**
 * Reading exam: highlight anywhere, copy nothing.
 * Driven through the real exam UI as a student sitting the paper.
 */
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const API = "http://127.0.0.1:4000";
const WEB = "http://127.0.0.1:3000";
const OUT = "/tmp/claude-0/-home-user-Oethq/30b0975a-cad8-5121-add2-9c0a5d5f5b34/scratchpad";
const RUN = String(Date.now()).slice(-6);
const sql = (q) => execFileSync("psql", ["-h", "/tmp", "-p", "5433", "-U", "postgres", "-d", "oethq", "-tA", "-c", q], { encoding: "utf8" }).trim();

let P = 0, F = 0; const fails = [];
const ck = (n, c, d = "") => {
  if (c) { P++; console.log(`  ok   ${n}`); }
  else { F++; fails.push(`${n}${d ? ` — ${d}` : ""}`); console.log(`  FAIL ${n}${d ? ` — ${d}` : ""}`); }
};

async function api(path, { method = "GET", body, token } = {}) {
  const h = { "content-type": "application/json", "x-device-id": `hl-${RUN}`, "x-device-fp": `hlfp-${RUN}` };
  if (token) h.authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  return { status: r.status, body: j, raw: t };
}

const admin = (await api("/auth/login", { method: "POST", body: { email: "admin@oet.test", password: "Admin@123" } })).body.accessToken;
const email = `reader-${RUN}@exam.test`;
const c = await api("/users/custom", {
  method: "POST", token: admin,
  body: { name: "Reader", email, productSlugs: ["reading-mega"], temporaryPassword: "Stress@1234" }
});
if (c.status >= 300) throw new Error(`create: ${c.status} ${c.raw.slice(0, 200)}`);
const { accessToken, user } = (await api("/auth/login", { method: "POST", body: { email, password: "Stress@1234" } })).body;

const TEST_ID = process.argv[2] || sql(`select id from "Test" where type='READING' and "isPublished" limit 1`);
console.log(`test: ${TEST_ID}`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
await ctx.addInitScript(([t, u]) => {
  localStorage.setItem("oet_token", t); localStorage.setItem("oet_user", u);
}, [accessToken, JSON.stringify(user ?? {})]);
const p = await ctx.newPage();
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));

await p.goto(`${WEB}/portal/tests/${TEST_ID}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(8000);

/** Select text inside an element by dragging across it, as a student would. */
async function dragSelect(locator, fromFrac = 0.05, toFrac = 0.6) {
  const box = await locator.boundingBox();
  if (!box) return false;
  const y = box.y + Math.min(14, box.height / 2);
  await p.mouse.move(box.x + box.width * fromFrac, y);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * toFrac, y, { steps: 12 });
  await p.mouse.up();
  await p.waitForTimeout(350);
  return true;
}

const marksIn = (sel) => p.locator(`${sel} mark.oet-hl`).count();

console.log("\n=== 1. STARTING THE PAPER ===");
{
  const start = p.getByRole("button", { name: /Start|Begin/i }).first();
  ck("the exam cover loads", await start.count() > 0);
  await start.click();
  await p.waitForTimeout(2500);
  ck("Part A is on screen", await p.locator("#paneAText").count() > 0);
  const attempt = sql(`select id from "TestAttempt" where "userId"=(select id from "User" where email='${email}') order by "startedAt" desc limit 1`);
  ck("an attempt was created to key highlights against", Boolean(attempt), attempt);
}

console.log("\n=== 2. HIGHLIGHTING THE PASSAGE ===");
{
  const para = p.locator("#paneAText p").first();
  await dragSelect(para);
  const n = await marksIn("#paneAText");
  ck("dragging across passage text marks it", n > 0, `${n} marks`);
  await p.screenshot({ path: `${OUT}/hl-partA.png` });
}

console.log("\n=== 3. HIGHLIGHTING THE QUESTIONS — THE PART THAT WAS MISSING ===");
{
  const q = p.locator('#paneAQ [data-hl-region], #paneAQ').first();
  const anyText = p.locator("#paneAQ .qhead .d, #paneAQ .qhead .t, #paneAQ label, #paneAQ .qtext").first();
  await dragSelect(anyText);
  const n = await marksIn("#paneAQ");
  ck("question text can be highlighted too", n > 0, `${n} marks`);
  void q;
}

console.log("\n=== 4. CLICKING A HIGHLIGHT REMOVES IT ===");
{
  const before = await marksIn("#paneAText");
  await p.locator("#paneAText mark.oet-hl").first().click();
  await p.waitForTimeout(400);
  const after = await marksIn("#paneAText");
  ck("clicking a mark clears it", after < before, `${before} → ${after}`);
}

console.log("\n=== 5. COPYING IS BLOCKED ===");
{
  await p.evaluate(() => navigator.clipboard.writeText("SENTINEL").catch(() => {}));
  await p.waitForTimeout(200);

  // Select passage text, then try every route out.
  const para = p.locator("#paneAText p").first();
  await dragSelect(para, 0.05, 0.9);

  const copyPrevented = await p.evaluate(() => {
    const el = document.querySelector("#paneAText p");
    const ev = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
    el?.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  ck("a copy event on the passage is cancelled", copyPrevented);

  const cutPrevented = await p.evaluate(() => {
    const el = document.querySelector("#paneAText p");
    const ev = new ClipboardEvent("cut", { bubbles: true, cancelable: true });
    el?.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  ck("a cut event is cancelled", cutPrevented);

  const menuPrevented = await p.evaluate(() => {
    const el = document.querySelector("#paneAText p");
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el?.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  ck("the right-click menu is suppressed over the passage", menuPrevented);

  const dragPrevented = await p.evaluate(() => {
    const el = document.querySelector("#paneAText p");
    const ev = new Event("dragstart", { bubbles: true, cancelable: true });
    el?.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  ck("text cannot be dragged out", dragPrevented);

  await dragSelect(para, 0.05, 0.9);
  await p.keyboard.press("Control+c");
  await p.waitForTimeout(400);
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => "READ_FAILED"));
  ck("Ctrl+C leaves the clipboard untouched", clip === "SENTINEL", JSON.stringify(clip).slice(0, 80));

  const selectAllPrevented = await p.evaluate(() => {
    const ev = new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  ck("Ctrl+A is blocked", selectAllPrevented);

  const printPrevented = await p.evaluate(() => {
    const ev = new KeyboardEvent("keydown", { key: "p", ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  ck("Ctrl+P is blocked", printPrevented);
}

console.log("\n=== 6. THEIR OWN ANSWER BOX IS STILL THEIRS ===");
{
  const input = p.locator("#paneAQ input[type='text'], #paneAQ input:not([type])").first();
  if (await input.count()) {
    await input.fill("my own answer");
    await input.selectText();
    const ownCopy = await p.evaluate(() => {
      const el = document.querySelector("#paneAQ input");
      const ev = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
      el?.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    ck("copying from their own answer box is allowed", !ownCopy);
    ck("and the answer they typed is intact", (await input.inputValue()) === "my own answer");
  } else {
    ck("Part A has an answer box to test", false, "no input found");
  }
}

console.log("\n=== 7. PART B: EXTRACTS, PROMPTS AND OPTIONS ===");
{
  // Finish Part A to reach Parts B & C.
  await p.getByRole("button", { name: /Finish Part A/i }).first().click();
  await p.waitForTimeout(1200);
  // Part A is one-way, so the exam asks before it closes the timer.
  const confirm = p.getByRole("button", { name: /Finish Part A|Yes|Continue|Confirm|Go to/i }).last();
  if (await confirm.count()) { await confirm.click().catch(() => {}); }
  await p.waitForTimeout(3000);

  const pb = p.locator(".pb-wrap");
  ck("Part B is on screen", await pb.count() > 0);

  if (await pb.count()) {
    await dragSelect(p.locator(".pb-doc .doc-body p, .pb-doc .doc-body").first());
    ck("a Part B extract can be highlighted", await marksIn(".pb-doc") > 0, `${await marksIn(".pb-doc")}`);

    await dragSelect(p.locator(".pbq-q").first(), 0.05, 0.85);
    ck("the Part B question can be highlighted", await marksIn(".pb-q") > 0);

    // The interaction that could go wrong: selecting inside an option must not
    // silently answer the question.
    const opt = p.locator(".pb-item").first().locator(".opt").first();
    const before = await opt.getAttribute("class");
    await dragSelect(opt.locator(".ol"), 0.05, 0.7);
    const after = await opt.getAttribute("class");
    ck("an answer option can be highlighted", await marksIn(".opt") > 0, `${await marksIn(".opt")}`);
    ck("and highlighting it did NOT select it as the answer",
      !/\bsel\b/.test(after || "") || /\bsel\b/.test(before || ""), `${before} → ${after}`);

    // A plain click on an option must always choose it, highlight or not.
    await opt.click();
    await p.waitForTimeout(400);
    ck("a plain click still chooses the answer", /\bsel\b/.test((await opt.getAttribute("class")) || ""),
      (await opt.getAttribute("class")) || "");
    ck("and the highlight on it survived being answered", await marksIn(".opt") > 0, `${await marksIn(".opt")}`);

    // Dragging back over a mark is how it comes off inside an option.
    const optMarks = await marksIn(".opt");
    await dragSelect(opt.locator("mark.oet-hl").first(), 0.05, 0.95);
    ck("dragging back over a highlight removes it", await marksIn(".opt") < optMarks,
      `${optMarks} -> ${await marksIn(".opt")}`);
    await p.screenshot({ path: `${OUT}/hl-partB.png` });
  }
}

console.log("\n=== 8. HIGHLIGHTS SURVIVE MOVING BETWEEN TABS ===");
{
  const beforeB = await marksIn(".pb-doc");
  const toC = p.getByRole("button", { name: /Part C · Text 1/i }).first();
  if (await toC.count()) {
    await toC.click(); await p.waitForTimeout(1600);
    ck("Part C is on screen", await p.locator("[id^=paneCText]").count() > 0);
    await dragSelect(p.locator("[id^=paneCText] p").first());
    ck("a Part C passage can be highlighted", await marksIn("[id^=paneCText]") > 0);

    const backB = p.getByRole("button", { name: /Part B ·/i }).first();
    if (await backB.count()) {
      await backB.click(); await p.waitForTimeout(1600);
      const afterB = await marksIn(".pb-doc");
      ck("coming back to Part B, the marks are still there", afterB >= beforeB && afterB > 0, `${beforeB} → ${afterB}`);
    }
  }
}

console.log("\n=== 9. HIGHLIGHTS SURVIVE A RELOAD ===");
{
  const before = await marksIn(".pb-doc");
  const stored = await p.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("oet_hl_"));
    return k ? { key: k, value: localStorage.getItem(k) } : null;
  });
  ck("highlights are written down against the attempt", Boolean(stored?.key), stored?.key ?? "nothing stored");

  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(8000);
  const resume = p.getByRole("button", { name: /Start|Begin|Resume|Continue/i }).first();
  if (await resume.count()) { await resume.click(); await p.waitForTimeout(2500); }
  // Navigate back to Parts B & C.
  const fin = p.getByRole("button", { name: /Finish Part A/i }).first();
  if (await fin.count()) {
    await fin.click(); await p.waitForTimeout(1200);
    const cf = p.getByRole("button", { name: /Finish Part A|Yes|Continue|Confirm|Go to/i }).last();
    if (await cf.count()) { await cf.click().catch(() => {}); }
    await p.waitForTimeout(3000);
  }

  const after = await marksIn(".pb-doc");
  ck("after a full page reload the marking is back", after > 0 && after >= before, `${before} → ${after}`);
  await p.screenshot({ path: `${OUT}/hl-after-reload.png` });
}

console.log("\n=== 10. CLEAR HIGHLIGHTS, AND NO CRASHES ===");
{
  const toC = p.getByRole("button", { name: /Part C · Text 1/i }).first();
  if (await toC.count()) {
    await toC.click(); await p.waitForTimeout(1500);
    const clear = p.getByRole("button", { name: /Clear highlights/i }).first();
    if (await clear.count()) {
      await dragSelect(p.locator("[id^=paneCText] p").first());
      const before = await marksIn("[id^=paneCText]");
      await clear.click(); await p.waitForTimeout(500);
      ck("Clear highlights empties that pane", await marksIn("[id^=paneCText]") === 0, `${before} → ${await marksIn("[id^=paneCText]")}`);
    }
  }
  ck("no uncaught errors anywhere in the paper", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
}

await browser.close();
console.log(`\n${"=".repeat(52)}\nPASS ${P}   FAIL ${F}`);
if (fails.length) { console.log("\nFAILURES:"); for (const f of fails) console.log(`  · ${f}`); }
process.exit(F > 0 ? 1 : 0);
