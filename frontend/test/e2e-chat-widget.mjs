/**
 * e2e-chat-widget.mjs — the assistant and the tracker, in a real browser.
 *
 * Everything below is done the way a visitor does it: arrive from YouTube,
 * open the widget, type, watch the answer stream in, reload, sign in, open an
 * exam. Nothing is asserted against the API that is not also observed on screen.
 *
 *   node frontend/test/e2e-chat-widget.mjs
 *
 * Expects the web app on :3000, the API on :4000, and the API pointed at the
 * Anthropic stub (backend/test/anthropic-stub.mjs).
 */
import { chromium } from "playwright-core";

const WEB = process.env.WEB_BASE || "http://127.0.0.1:3000";
const API = process.env.API_BASE || "http://127.0.0.1:4000";
const CHROME =
  process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let passed = 0;
const failures = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LAUNCHER = 'button[aria-label="Ask the OET HQ assistant"]';
const PANEL = 'div[role="dialog"][aria-label="OET HQ assistant"]';

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // Watch the visit pings the tracker actually sends.
  const visitPings = [];
  page.on("request", (r) => {
    if (r.url().includes("/attribution/visit") && r.method() === "POST") {
      try {
        visitPings.push(JSON.parse(r.postData() ?? "{}"));
      } catch {
        visitPings.push({});
      }
    }
  });

  // ------------------------------------------------------------- 1. arrival
  section("1. A visitor arrives from a YouTube video description");
  await page.goto(`${WEB}/?utm_source=youtube&utm_medium=video&utm_campaign=browser-test`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForTimeout(2500);

  ok("the page loads", await page.locator("body").isVisible());
  ok("a visit was reported", visitPings.length > 0, `${visitPings.length} pings`);
  const ping = visitPings[0] ?? {};
  ok("it carried the campaign tags", ping.utmSource === "youtube" && ping.utmCampaign === "browser-test", JSON.stringify(ping));
  ok("it carried a visitor id", typeof ping.visitorKey === "string" && ping.visitorKey.length > 8);
  ok("it carried the landing page", String(ping.landingPath ?? "").startsWith("/"));

  const storedKey = await page.evaluate(() => localStorage.getItem("oet_visitor"));
  ok("the visitor id is kept for next time", Boolean(storedKey));
  const firstTouch = await page.evaluate(() => localStorage.getItem("oet_attr_first"));
  ok("first touch is remembered locally too", Boolean(firstTouch) && firstTouch.includes("youtube"));

  section("2. Internal navigation does not look like a new arrival");
  const before = visitPings.length;
  await page.goto(`${WEB}/courses`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  ok("the second page is reported too", visitPings.length > before);
  const second = visitPings.at(-1);
  ok("but with no utm tags this time", !second.utmSource, JSON.stringify(second));
  ok("and the same visitor id", second.visitorKey === ping.visitorKey);

  // -------------------------------------------------------------- 3. widget
  section("3. The assistant is reachable");
  const launcher = page.locator(LAUNCHER);
  await launcher.waitFor({ state: "visible", timeout: 12000 });
  ok("the launcher is on the public site", await launcher.isVisible());

  const box = await launcher.boundingBox();
  ok("it is big enough to tap on a phone", (box?.height ?? 0) >= 44, `${box?.height}px`);

  await launcher.click();
  const panel = page.locator(PANEL);
  await panel.waitFor({ state: "visible", timeout: 5000 });
  ok("it opens", await panel.isVisible());
  ok("it opens on the diagnosis, not a sales pitch", (await panel.innerText()).includes("which sub-test is holding you back"));
  ok("it invites a score report", (await panel.innerText()).toLowerCase().includes("score report"));
  ok("it offers starter questions", (await panel.locator("button", { hasText: "What is included" }).count()) > 0);
  ok("a photo can be attached", (await panel.locator('button[aria-label="Attach a photo of your score report"]').count()) === 1);
  ok(
    "dictation is offered only where the browser supports it",
    (await panel.locator('button[aria-label="Speak instead of typing"]').count()) ===
      (await page.evaluate(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window) ? 1 : 0)
  );
  ok(
    "it says plainly that it is not a person",
    (await panel.innerText()).toLowerCase().includes("not a person")
  );

  section("4. Asking a question");
  const input = panel.locator('textarea[aria-label="Your message"]');
  await input.fill("how do the class days work?");
  await input.press("Enter");

  // Catch the answer part-way through: it must appear progressively, not in one
  // lump at the end. A "streaming" widget that renders once is just a slow one.
  //
  // Sampled rather than checked after a fixed delay. Any single delay is wrong
  // for some machine — too early and nothing has arrived, too late and the whole
  // answer has, which is exactly how this assertion failed once the reply got
  // faster. Distinct intermediate lengths are the actual evidence of streaming.
  const lengths = new Set();
  const until = Date.now() + 15000;
  let endText = "";
  while (Date.now() < until) {
    const t = await panel.innerText();
    lengths.add(t.length);
    if (t.includes("core skills")) {
      endText = t;
      break;
    }
    await sleep(25);
  }
  if (!endText) {
    await panel.locator("text=core skills").first().waitFor({ timeout: 5000 });
    endText = await panel.innerText();
  }

  ok("the question appears as the student's message", endText.includes("how do the class days work?"));
  ok("an answer arrives", endText.includes("four class days"));
  ok(
    "it streamed in rather than appearing at once",
    lengths.size >= 3,
    `only ${lengths.size} distinct render(s) observed`
  );
  ok("the marker never appeared on screen", !endText.includes("[[") && !endText.includes("HANDOFF"));

  const convId = await page.evaluate(() => localStorage.getItem("oet_chat_conversation"));
  ok("the thread id is stored", Boolean(convId));

  section("5. It survives a reload");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.locator(LAUNCHER).click();
  await panel.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(1500);
  const restored = await panel.innerText();
  ok("the earlier question is still there", restored.includes("how do the class days work?"));
  ok("so is the answer", restored.includes("four class days"));

  section("6. Starting over clears it");
  await panel.locator("button", { hasText: "New chat" }).click();
  await page.waitForTimeout(400);
  const cleared = await panel.innerText();
  ok("the thread is emptied", !cleared.includes("how do the class days work?"));
  ok("the stored thread id is dropped", (await page.evaluate(() => localStorage.getItem("oet_chat_conversation"))) === null);

  section("7. Escape closes it");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("the panel closes", (await page.locator(PANEL).count()) === 0);

  // ------------------------------------------------------- 8. exam integrity
  section("8. It is NOT available during an exam");
  // Sign in as a candidate, then open a Reading paper.
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.CANDIDATE_EMAIL || "candidate@oet.test",
      password: process.env.CANDIDATE_PASSWORD || "Candidate@123"
    })
  });
  const auth = await login.json().catch(() => ({}));
  const candidateToken = auth.accessToken || auth.token;
  ok("a candidate can sign in", Boolean(candidateToken), `status ${login.status}`);

  if (candidateToken) {
    await page.evaluate(
      ([t, u]) => {
        localStorage.setItem("oet_token", t);
        localStorage.setItem("oet_user", u);
      },
      [candidateToken, JSON.stringify({ email: "candidate@oet.test", role: "CANDIDATE", name: "Candidate" })]
    );

    await page.goto(`${WEB}/portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    ok("the assistant IS available inside the portal", (await page.locator(LAUNCHER).count()) > 0);

    await page.goto(`${WEB}/portal/tests/any-test-id`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    ok(
      "the assistant is GONE on an exam page",
      (await page.locator(LAUNCHER).count()) === 0,
      "a chat box during a Reading paper is a way to ask for the answers"
    );

    await page.goto(`${WEB}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    ok("and gone in admin", (await page.locator(LAUNCHER).count()) === 0);
  }

  // ------------------------------------------------------------- 9. a phone
  section("9. On a phone");
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  });
  const mob = await phone.newPage();
  await mob.goto(`${WEB}/`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(2500);
  const mobLauncher = mob.locator(LAUNCHER);
  await mobLauncher.waitFor({ state: "visible", timeout: 12000 });
  ok("the launcher is reachable", await mobLauncher.isVisible());
  await mobLauncher.click();
  const mobPanel = mob.locator(PANEL);
  await mobPanel.waitFor({ state: "visible", timeout: 5000 });
  const pb = await mobPanel.boundingBox();
  ok("the panel goes full screen", (pb?.width ?? 0) >= 380 && (pb?.height ?? 0) >= 700, JSON.stringify(pb));
  ok("the page does not scroll sideways", await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const mobInput = mobPanel.locator('textarea[aria-label="Your message"]');
  await mobInput.fill("hello");
  await mobInput.press("Enter");
  await mob.waitForTimeout(600);
  ok(
    "Enter inserts a newline on a phone instead of sending",
    (await mobInput.inputValue()).includes("\n"),
    JSON.stringify(await mobInput.inputValue())
  );
  await mobPanel.locator('button[aria-label="Send"]').click();
  await mobPanel.locator("text=core skills").first().waitFor({ timeout: 15000 });
  ok("the Send button works", (await mobPanel.innerText()).includes("four class days"));
  await phone.close();

  section("10. Nothing broke along the way");
  // `Failed to fetch RSC payload` is the Next dev server hot-reloading mid-run
  // — a development-only artifact of recompiling while the browser is driving
  // it, not something a visitor can ever see.
  const real = consoleErrors.filter(
    (e) =>
      !/favicon|404|Failed to load resource|hydrat|Download the React DevTools|RSC payload|Fast Refresh/i.test(e)
  );
  ok("no uncaught errors in the console", real.length === 0, real.slice(0, 3).join(" | "));

  await browser.close();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  • ${f}`);
    process.exit(1);
  }
  console.log("All green.");
}

main().catch((e) => {
  console.error("\nHarness error:", e);
  process.exit(1);
});
