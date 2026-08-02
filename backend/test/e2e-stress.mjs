/**
 * End-to-end stress harness against a real API + real Postgres.
 *
 * Creates genuine accounts, verifies them with the OTP actually written to the
 * database, grants real packages, and asserts that what the student can reach
 * matches what the tier advertises. Nothing is mocked.
 */
import { execFileSync } from "node:child_process";

const API = "http://127.0.0.1:4000";
const RUN = process.env.RUN_TAG || String(Date.now()).slice(-6);
const PSQL = ["-h", "/tmp", "-p", "5433", "-U", "postgres", "-d", "oethq", "-tA", "-c"];
const sql = (q) => execFileSync("psql", [...PSQL, q], { encoding: "utf8" }).trim();

let PASS = 0, FAIL = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { PASS++; console.log(`  ok   ${name}`); }
  else { FAIL++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function api(path, { method = "GET", body, token, device, fp } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (device) headers["x-device-id"] = device;
  if (fp) headers["x-device-fp"] = fp;
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, body: json, raw: text };
}

const otpFor = (email) =>
  sql(`select o.code from "OTPCode" o join "User" u on u.id=o."userId"
       where u.email='${email}' order by o."createdAt" desc limit 1`);

/** Register + verify a real candidate, returning a signed-in token. */
async function makeStudent(tag, profession = "Nursing", device = null) {
  const email = `${tag}-${RUN}@stress.test`;
  const password = "Stress@1234";
  const dev = device ? `${device}-${RUN}` : `dev-${tag}-${RUN}`;
  const reg = await api("/auth/register", {
    method: "POST", device: dev, fp: `fp-${tag}-${RUN}`,
    body: { name: tag, email, password, profession, heardFrom: "Google", whatsapp: "" }
  });
  if (reg.status !== 201 && reg.status !== 200) throw new Error(`register ${tag}: ${reg.status} ${reg.raw.slice(0, 200)}`);
  const code = otpFor(email);
  const ver = await api("/auth/otp/verify", {
    method: "POST", device: dev, fp: `fp-${tag}-${RUN}`,
    body: { email, code, purpose: "REGISTER" }
  });
  // Register-OTP verification returns NO token — the student is told to sign in
  // again. Captured as a finding; the harness logs in so testing can continue.
  let token = ver.body?.accessToken;
  if (!token) {
    const li = await api("/auth/login", { method: "POST", device: dev, fp: `fp-${tag}-${RUN}`, body: { email, password } });
    token = li.body?.accessToken;
    if (!token) throw new Error(`login ${tag}: ${li.status} ${li.raw.slice(0, 200)}`);
  }
  return { email, password, token, device: dev, fp: `fp-${tag}-${RUN}`, verifiedGaveToken: Boolean(ver.body?.accessToken),
           id: sql(`select id from "User" where email='${email}'`) };
}

async function login(email, password, device, fp) {
  const r = await api("/auth/login", { method: "POST", device, fp, body: { email, password } });
  return r;
}

const adminToken = async () => {
  const r = await login("admin@oet.test", "Admin@123", "admin-dev", "admin-fp");
  if (!r.body?.accessToken) throw new Error(`admin login failed: ${r.status} ${r.raw.slice(0, 200)}`);
  return r.body.accessToken;
};

// ---------------------------------------------------------------- run
const admin = await adminToken();
console.log("\n=== 1. SIGN UP AND SIGN IN ===");

const s1 = await makeStudent("alpha");
check("signup code hands back a session (no second password entry)", s1.verifiedGaveToken,
  "verify returns 'Please sign in to continue' with no token");
const me = await api("/auth/me", { token: s1.token, device: s1.device, fp: s1.fp });
check("token identifies the right student", me.body?.email === s1.email, me.body?.email);

const dup = await api("/auth/register", {
  method: "POST", body: { name: "dup", email: s1.email, password: "Stress@1234", profession: "Nursing", heardFrom: "Google" }
});
check("duplicate email is refused", dup.status >= 400, `status ${dup.status}`);

const badPw = await login(s1.email, "WrongPass@1", s1.device, s1.fp);
const unknown = await login(`nobody-${RUN}@stress.test`, "WrongPass@1", "x", "y");
check("wrong password and unknown email are indistinguishable",
  badPw.status === unknown.status && badPw.body?.message === unknown.body?.message,
  `${badPw.status}/${unknown.status}`);

console.log("\n=== 2. NO PURCHASE = NO ACCESS ===");
const own0 = await api("/entitlements", { token: s1.token, device: s1.device, fp: s1.fp });
check("a verified student with no purchase owns no skills",
  (own0.body?.ownedSkills?.length ?? 0) === 0, JSON.stringify(own0.body?.ownedSkills));

console.log("\n=== 3. EVERY SINGLE-SKILL TIER ===");
// slug -> what the tier page advertises
const TIERS = [
  ["reading-foundation", "READING", 1, 4, 1, 30],
  ["reading-momentum", "READING", 2, 4, 3, 40],
  ["reading-precision", "READING", 3, 10, 5, 60],
  ["reading-mega", "READING", 4, 15, 10, 60],
  ["listening-foundation", "LISTENING", 1, 4, 1, 30],
  ["listening-momentum", "LISTENING", 2, 4, 3, 40],
  ["listening-precision", "LISTENING", 3, 10, 5, 60],
  ["listening-mega", "LISTENING", 4, 15, 10, 60],
  ["writing-foundation", "WRITING", 1, 0, 1, 30],
  ["writing-precision", "WRITING", 3, 0, 5, 60],
  ["writing-mega", "WRITING", 4, 0, 10, 60]
];

const tierStudents = {};
for (const [slug, skill, rank, mocks, papers, days] of TIERS) {
  if (!tierStudents[skill]) tierStudents[skill] = await makeStudent(`tier-${skill}`);
  const st = tierStudents[skill];
  const g = await api(`/admin/users/${st.id}/entitlements`, {
    method: "POST", token: admin, body: { slug }
  });
  if (g.status !== 200) { check(`${slug}: grant`, false, `status ${g.status} ${g.raw.slice(0,120)}`); continue; }

  const own = await api("/entitlements", { token: st.token, device: st.device, fp: st.fp });
  const acc = own.body?.skillAccess?.[skill];
  const ok =
    own.body?.ownedSkills?.includes(skill) &&
    acc?.tierRank === rank &&
    acc?.mockTestLimit === mocks &&
    acc?.pastPaperLimit === papers;
  check(`${slug}: owns ${skill} at tier ${rank}, ${mocks} mocks, ${papers} papers`, ok,
    ok ? "" : JSON.stringify(acc));

  const end = sql(`select date_part('day', e."endDate" - e."startDate")::int
                   from "Entitlement" e join "Product" p on p.id=e."productId"
                   where e."userId"='${st.id}' and p.slug='${slug}' and e.status='ACTIVE'`);
  check(`${slug}: ${days}-day window`, Number(end) === days, `got ${end}`);

  const other = skill === "READING" ? "LISTENING" : "READING";
  check(`${slug}: does not leak into ${other}`, !own.body?.ownedSkills?.includes(other),
    JSON.stringify(own.body?.ownedSkills));
}

console.log("\n=== 4. TIER GATING OF MODULES ===");
{
  const low = await makeStudent("gate-low");
  await api(`/admin/users/${low.id}/entitlements`, { method: "POST", token: admin, body: { slug: "listening-foundation" } });
  const hi = await makeStudent("gate-hi");
  await api(`/admin/users/${hi.id}/entitlements`, { method: "POST", token: admin, body: { slug: "listening-precision" } });

  const lowSpell = await api("/spelling/daily", { token: low.token, device: low.device, fp: low.fp });
  const hiSpell = await api("/spelling/daily", { token: hi.token, device: hi.device, fp: hi.fp });
  check("Foundation cannot reach daily spelling", lowSpell.status === 403, `status ${lowSpell.status}`);
  check("Precision can reach daily spelling", hiSpell.status !== 403, `status ${hiSpell.status}`);

  const lowPod = await api("/listening-podcasts/of-day", { token: low.token, device: low.device, fp: low.fp });
  const hiPod = await api("/listening-podcasts/of-day", { token: hi.token, device: hi.device, fp: hi.fp });
  check("Foundation cannot reach the daily podcast", lowPod.status === 403, `status ${lowPod.status}`);
  check("Precision can reach the daily podcast", hiPod.status !== 403, `status ${hiPod.status}`);
}

console.log("\n=== 5. UPGRADE AND DOWNGRADE ===");
{
  const st = await makeStudent("ladder");
  await api(`/admin/users/${st.id}/entitlements`, { method: "POST", token: admin, body: { slug: "reading-mega" } });
  let own = await api("/entitlements", { token: st.token, device: st.device, fp: st.fp });
  check("starts on Mega (rank 4)", own.body?.skillAccess?.READING?.tierRank === 4);

  await api(`/admin/users/${st.id}/entitlements`, { method: "POST", token: admin, body: { slug: "reading-foundation" } });
  own = await api("/entitlements", { token: st.token, device: st.device, fp: st.fp });
  check("downgrade to Foundation actually lowers access",
    own.body?.skillAccess?.READING?.tierRank === 1, `rank ${own.body?.skillAccess?.READING?.tierRank}`);
  check("downgrade leaves exactly one live Reading tier",
    Number(sql(`select count(*) from "Entitlement" e join "Product" p on p.id=e."productId"
                where e."userId"='${st.id}' and e.status='ACTIVE' and p."includedSkills" @> ARRAY['READING']`)) === 1);
}

console.log("\n=== 6. THE COMPLETE MATERIAL PLAN ===");
{
  const st = await makeStudent("complete");
  const planId = sql(`select id from "Plan" where tier='MASTERY'`);
  const r = await api(`/admin/users/${st.id}/plan`, { method: "POST", token: admin, body: { planId } });
  check("admin can put a student on Elite Clearance", r.status === 200, `status ${r.status}`);

  const own = await api("/entitlements", { token: st.token, device: st.device, fp: st.fp });
  const skills = own.body?.ownedSkills ?? [];
  check("Complete grants all four skills",
    ["READING", "LISTENING", "WRITING", "SPEAKING"].every((s) => skills.includes(s)), JSON.stringify(skills));

  const w = await api("/writing/library", { token: st.token, device: st.device, fp: st.fp });
  check("Elite Clearance really has 7 writing corrections", w.body?.allowed === 7, `allowed ${w.body?.allowed}`);

  const sp = await api("/speaking-hack-sentences", { token: st.token, device: st.device, fp: st.fp });
  check("Complete student is not locked out of Speaking", sp.body?.locked === false, JSON.stringify(sp.body?.locked));
}

console.log("\n=== 7. SPEAKING IS COMPLETE-ONLY ===");
{
  const st = await makeStudent("readonly-speak");
  await api(`/admin/users/${st.id}/entitlements`, { method: "POST", token: admin, body: { slug: "reading-mega" } });
  const sp = await api("/speaking-hack-sentences", { token: st.token, device: st.device, fp: st.fp });
  check("a Reading-only buyer is locked out of Speaking", sp.body?.locked === true, JSON.stringify(sp.body));
}

console.log("\n=== 8. WRITING QUOTA BY PLAN ===");
for (const [tier, expected] of [["FOUNDATION", 2], ["ACCELERATOR", 3], ["MASTERY", 7], ["CUSTOM", 10]]) {
  const st = await makeStudent(`w-${tier}`);
  const planId = sql(`select id from "Plan" where tier='${tier}'`);
  await api(`/admin/users/${st.id}/plan`, { method: "POST", token: admin, body: { planId } });
  const lib = await api("/writing/library", { token: st.token, device: st.device, fp: st.fp });
  check(`${tier} grants ${expected} corrections on a brand-new account`,
    lib.body?.allowed === expected, `allowed ${lib.body?.allowed}`);
}

console.log("\n=== 9. NEXT-DAY SIGN-IN KEEPS EVERYTHING ===");
{
  const st = await makeStudent("tomorrow");
  await api(`/admin/users/${st.id}/entitlements`, { method: "POST", token: admin, body: { slug: "listening-precision" } });
  const before = await api("/entitlements", { token: st.token, device: st.device, fp: st.fp });

  // Age every timestamp by a day, exactly as the clock would.
  sql(`update "UserSession" set "lastSeenAt"="lastSeenAt" - interval '1 day', "createdAt"="createdAt" - interval '1 day' where "userId"='${st.id}'`);
  sql(`update "Entitlement" set "startDate"="startDate" - interval '1 day' where "userId"='${st.id}'`);

  const again = await login(st.email, st.password, st.device, st.fp);
  check("can sign in the next day", Boolean(again.body?.accessToken), `status ${again.status}`);
  const after = await api("/entitlements", { token: again.body.accessToken, device: st.device, fp: st.fp });
  check("same skills the next day",
    JSON.stringify(after.body?.ownedSkills) === JSON.stringify(before.body?.ownedSkills),
    `${JSON.stringify(before.body?.ownedSkills)} -> ${JSON.stringify(after.body?.ownedSkills)}`);
  check("same tier the next day",
    after.body?.skillAccess?.LISTENING?.tierRank === before.body?.skillAccess?.LISTENING?.tierRank);
  check("next-day sign-in does not create a second device",
    Number(sql(`select count(*) from "UserSession" where "userId"='${st.id}' and "revokedAt" is null`)) === 1);
}

console.log("\n=== 10. DEVICE CAP ===");
{
  const st = await makeStudent("devices", "Nursing", "phone");
  await api(`/admin/users/${st.id}/entitlements`, { method: "POST", token: admin, body: { slug: "reading-mega" } });

  const laptop = await login(st.email, st.password, `laptop-${RUN}`, `fp-laptop-${RUN}`);
  check("second device signs in fine", Boolean(laptop.body?.accessToken));
  check("two live sessions", Number(sql(`select count(*) from "UserSession" where "userId"='${st.id}' and "revokedAt" is null`)) === 2);

  const third = await login(st.email, st.password, `tablet-${RUN}`, `fp-tablet-${RUN}`);
  check("third device is NOT refused (silent cap)", Boolean(third.body?.accessToken), `status ${third.status}`);
  check("still only two live sessions", Number(sql(`select count(*) from "UserSession" where "userId"='${st.id}' and "revokedAt" is null`)) === 2);
  check("the evicted one is marked device_limit",
    Number(sql(`select count(*) from "UserSession" where "userId"='${st.id}' and "revokedReason"='device_limit'`)) === 1);

  // The evicted device's token must stop working.
  const evicted = await api("/entitlements", { token: st.token, device: st.device, fp: st.fp });
  check("evicted device's token is rejected", evicted.status === 401, `status ${evicted.status}`);

  // Same device signing in again must reuse its row, not take a new slot.
  const backOnPhone = await login(st.email, st.password, `phone-${RUN}`, `fp-devices-${RUN}`);
  check("evicted device can sign back in", Boolean(backOnPhone.body?.accessToken));
  check("still capped at two after re-entry",
    Number(sql(`select count(*) from "UserSession" where "userId"='${st.id}' and "revokedAt" is null`)) === 2);

  // Cleared browser: new device id, same fingerprint.
  const beforeCount = Number(sql(`select count(*) from "UserSession" where "userId"='${st.id}'`));
  await login(st.email, st.password, `phone-wiped-${RUN}`, `fp-devices-${RUN}`);
  check("clearing site data re-links instead of adding a device",
    Number(sql(`select count(*) from "UserSession" where "userId"='${st.id}'`)) === beforeCount, `rows ${beforeCount}`);
}

console.log("\n=== 11. CANCEL, SUSPEND, EXPIRE ===");
{
  const st = await makeStudent("cancel");
  await api(`/admin/users/${st.id}/entitlements`, { method: "POST", token: admin, body: { slug: "reading-mega" } });
  const r = await api(`/admin/users/${st.id}/access`, { method: "DELETE", token: admin });
  check("cancel all access reports what it ended", (r.body?.courses ?? 0) >= 1, JSON.stringify(r.body));
  const own = await api("/entitlements", { token: st.token, device: st.device, fp: st.fp });
  check("cancelled student owns nothing on the very next request",
    (own.body?.ownedSkills?.length ?? 0) === 0, JSON.stringify(own.body?.ownedSkills));

  const sus = await makeStudent("suspend");
  await api(`/security/users/${sus.id}/suspend`, { method: "POST", token: admin, body: { reason: "stress test" } });
  const back = await login(sus.email, sus.password, sus.device, sus.fp);
  check("suspended student cannot sign in", back.status >= 400, `status ${back.status}`);

  const exp = await makeStudent("expired");
  await api(`/admin/users/${exp.id}/entitlements`, { method: "POST", token: admin, body: { slug: "reading-foundation" } });
  sql(`update "Entitlement" set "endDate"=now() - interval '1 day' where "userId"='${exp.id}'`);
  const eown = await api("/entitlements", { token: exp.token, device: exp.device, fp: exp.fp });
  check("an expired course grants nothing", (eown.body?.ownedSkills?.length ?? 0) === 0, JSON.stringify(eown.body?.ownedSkills));
}

console.log("\n=== 12. ADMIN SURFACES ===");
{
  const roster = await api(`/admin/accountability?day=${Math.floor(Date.now() / 86400000)}`, { token: admin });
  check("accountability roster loads", roster.status === 200, `status ${roster.status}`);
  check("roster includes entitlement-only buyers", (roster.body?.students?.length ?? 0) > 0, `${roster.body?.students?.length} students`);

  const audit = await api("/admin/device-audit", { token: admin });
  check("device audit loads", audit.status === 200, `status ${audit.status}`);
  check("device audit reports missing geo honestly", audit.body?.geoUnavailable === true, JSON.stringify(audit.body?.geoUnavailable));

  const subs = await api("/users/subscribed", { token: admin });
  check("subscribed candidates list loads", subs.status === 200, `status ${subs.status}`);
  check("candidate rows carry their courses", Array.isArray(subs.body?.[0]?.courses), JSON.stringify(subs.body?.[0]?.courses));

  const asStudent = await api("/admin/device-audit", { token: s1.token, device: s1.device, fp: s1.fp });
  check("a student cannot open admin endpoints", asStudent.status === 403, `status ${asStudent.status}`);
}

console.log(`\n${"=".repeat(58)}\nPASS ${PASS}   FAIL ${FAIL}`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  · ${f}`);
}
