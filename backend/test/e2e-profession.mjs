/**
 * Profession: set-once for the student, always changeable by an admin, and the
 * change must reach the material they actually study.
 *
 * Run against a live API + database:
 *   node backend/test/e2e-profession.mjs
 */
import { execFileSync } from "node:child_process";

const API = process.env.API_BASE || "http://127.0.0.1:4000";
const RUN = String(Date.now()).slice(-6);
const PSQL = ["-h", "/tmp", "-p", "5433", "-U", "postgres", "-d", "oethq", "-tA", "-c"];
const sql = (q) => execFileSync("psql", [...PSQL, q], { encoding: "utf8" }).trim();

let P = 0, F = 0;
const fails = [];
const ck = (n, c, d = "") => {
  if (c) { P++; console.log(`  ok   ${n}`); }
  else { F++; fails.push(`${n}${d ? ` — ${d}` : ""}`); console.log(`  FAIL ${n}${d ? ` — ${d}` : ""}`); }
};

async function api(path, { method = "GET", body, token } = {}) {
  const h = { "content-type": "application/json", "x-device-id": `prof-${RUN}`, "x-device-fp": `fpprof-${RUN}` };
  if (token) h.authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { /* non-JSON */ }
  return { status: r.status, body: j, raw: t };
}

const prof = (email) => sql(`select coalesce(profession,'<null>') from "User" where email='${email}'`);

const admin = (await api("/auth/login", { method: "POST", body: { email: "admin@oet.test", password: "Admin@123" } })).body.accessToken;

/** Admin-created candidate. `profession` omitted = the reported case. */
async function makeCandidate(tag, profession) {
  const email = `${tag}-${RUN}@prof.test`;
  const r = await api("/users/custom", {
    method: "POST", token: admin,
    body: {
      name: tag, email, ...(profession ? { profession } : {}),
      productSlugs: ["reading-mega"], temporaryPassword: "Stress@1234"
    }
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`create ${tag}: ${r.status} ${r.raw.slice(0, 160)}`);
  const li = await api("/auth/login", { method: "POST", body: { email, password: "Stress@1234" } });
  return { email, token: li.body?.accessToken, id: sql(`select id from "User" where email='${email}'`) };
}

console.log("\n=== 1. ADMIN SETS IT AT CREATION ===");
{
  const a = await makeCandidate("atcreate", "Pharmacy");
  ck("profession stored from the create form", prof(a.email) === "Pharmacy", prof(a.email));
  ck("the student sees it on /auth/me", (await api("/auth/me", { token: a.token })).body?.profession === "Pharmacy");
}

console.log("\n=== 2. STUDENT SETS THEIRS ONCE ===");
const s = await makeCandidate("setonce");
{
  ck("created without one, as the admin form allows", prof(s.email) === "<null>");
  const set = await api("/auth/me/profession", { method: "PATCH", token: s.token, body: { profession: "Nursing" } });
  ck("first set succeeds", set.status === 200, `status ${set.status} ${set.raw.slice(0, 120)}`);
  ck("it is persisted", prof(s.email) === "Nursing", prof(s.email));
}

console.log("\n=== 3. THE STUDENT CANNOT CHANGE IT ===");
{
  const again = await api("/auth/me/profession", { method: "PATCH", token: s.token, body: { profession: "Midwifery" } });
  ck("a second change is refused", again.status >= 400, `status ${again.status}`);
  ck("the refusal explains what to do", /support/i.test(String(again.body?.message ?? "")), String(again.body?.message));
  ck("the stored value is untouched", prof(s.email) === "Nursing", prof(s.email));

  // Re-setting the SAME value must not be a loophole that reopens the field.
  const same = await api("/auth/me/profession", { method: "PATCH", token: s.token, body: { profession: "Nursing" } });
  ck("even re-sending the same value is refused", same.status >= 400, `status ${same.status}`);

  // Nor may they blank it and start again.
  for (const attempt of ["", "   ", null]) {
    const r = await api("/auth/me/profession", { method: "PATCH", token: s.token, body: { profession: attempt } });
    ck(`clearing it with ${JSON.stringify(attempt)} is refused`, r.status >= 400, `status ${r.status}`);
  }
  ck("still Nursing after every attempt", prof(s.email) === "Nursing", prof(s.email));
}

console.log("\n=== 4. VALIDATION ON FIRST SET ===");
{
  const v = await makeCandidate("validate");
  for (const bad of ["nurse", "NURSING", "Doctor", "<script>", "Nursing;DROP TABLE", "", "   "]) {
    const r = await api("/auth/me/profession", { method: "PATCH", token: v.token, body: { profession: bad } });
    ck(`${JSON.stringify(bad)} is refused`, r.status >= 400, `status ${r.status}`);
  }
  ck("nothing was stored by any bad attempt", prof(v.email) === "<null>", prof(v.email));

  const good = await api("/auth/me/profession", { method: "PATCH", token: v.token, body: { profession: "Dentistry" } });
  ck("a valid value works", good.status === 200 && prof(v.email) === "Dentistry", prof(v.email));

  // Surrounding whitespace is NORMALISED, not rejected — the value is trimmed
  // before it is stored, so the library still matches. Rejecting it would only
  // punish a stray space from a paste.
  const w = await makeCandidate("whitespace");
  const ws = await api("/auth/me/profession", { method: "PATCH", token: w.token, body: { profession: "  Nursing  " } });
  ck("whitespace around a valid value is accepted and trimmed",
    ws.status === 200 && prof(w.email) === "Nursing", `${ws.status} / ${prof(w.email)}`);
}

console.log("\n=== 5. ADMIN CHANGES IT, ANY TIME ===");
{
  const chg = await api(`/admin/users/${s.id}/profession`, { method: "PATCH", token: admin, body: { profession: "Midwifery" } });
  ck("admin changes an already-set profession", chg.status === 200, `status ${chg.status} ${chg.raw.slice(0, 140)}`);
  ck("the new value is stored", prof(s.email) === "Midwifery", prof(s.email));
  ck("the student sees it immediately", (await api("/auth/me", { token: s.token })).body?.profession === "Midwifery");

  const back = await api(`/admin/users/${s.id}/profession`, { method: "PATCH", token: admin, body: { profession: "Nursing" } });
  ck("admin can change it again", back.status === 200 && prof(s.email) === "Nursing");

  const badAdmin = await api(`/admin/users/${s.id}/profession`, { method: "PATCH", token: admin, body: { profession: "nurse" } });
  ck("admin is validated too", badAdmin.status >= 400, `status ${badAdmin.status}`);
  ck("a bad admin value changes nothing", prof(s.email) === "Nursing", prof(s.email));

  ck("the change is written to the audit log",
    Number(sql(`select count(*) from "AuditLog" where action='user.profession_changed' and "entityId"='${s.id}'`)) >= 2);
}

console.log("\n=== 6. AUTHORISATION ===");
{
  const other = await makeCandidate("nosy");
  const asStudent = await api(`/admin/users/${s.id}/profession`, { method: "PATCH", token: other.token, body: { profession: "Pharmacy" } });
  ck("a student cannot use the admin endpoint", asStudent.status === 403, `status ${asStudent.status}`);
  ck("their target is unchanged", prof(s.email) === "Nursing");

  const anon = await api(`/admin/users/${s.id}/profession`, { method: "PATCH", body: { profession: "Pharmacy" } });
  ck("a signed-out caller is refused", anon.status === 401, `status ${anon.status}`);

  const selfAnon = await api("/auth/me/profession", { method: "PATCH", body: { profession: "Nursing" } });
  ck("a signed-out caller cannot set their own", selfAnon.status === 401, `status ${selfAnon.status}`);

  const ghost = await api(`/admin/users/00000000-0000-0000-0000-000000000000/profession`,
    { method: "PATCH", token: admin, body: { profession: "Nursing" } });
  ck("an unknown user id 404s rather than 500s", ghost.status === 404, `status ${ghost.status}`);
}

console.log("\n=== 7. IT REACHES THE MATERIAL ===");
{
  // Two profession-specific case notes, so the switch is observable.
  const mk = (p, title) => api("/admin/writing", {
    method: "POST", token: admin,
    body: { profession: p, title, scenario: "Stress test", caseNotesHtml: `<p>${title}</p>`, wordGuidance: "180-200", timeLimitMin: 45 }
  });
  const a = await mk("Nursing", `NUR-${RUN}`);
  const b = await mk("Pharmacy", `PHA-${RUN}`);
  const seeded = a.status < 400 && b.status < 400;
  ck("seeded a case note for two professions", seeded, `${a.status}/${b.status} ${a.raw.slice(0, 100)}`);

  if (seeded) {
    const w1 = await api("/writing/library", { token: s.token });
    ck("library matches their profession (Nursing)",
      w1.body?.profession === "Nursing" && w1.body?.caseNotes?.some((c) => c.title === `NUR-${RUN}`),
      JSON.stringify(w1.body?.caseNotes?.map((c) => c.title)));
    ck("and does NOT include the other profession's notes",
      !w1.body?.caseNotes?.some((c) => c.title === `PHA-${RUN}`));

    await api(`/admin/users/${s.id}/profession`, { method: "PATCH", token: admin, body: { profession: "Pharmacy" } });

    const w2 = await api("/writing/library", { token: s.token });
    ck("admin change swaps the library on the very next request",
      w2.body?.profession === "Pharmacy" && w2.body?.caseNotes?.some((c) => c.title === `PHA-${RUN}`),
      JSON.stringify({ p: w2.body?.profession, notes: w2.body?.caseNotes?.map((c) => c.title) }));
    ck("the old profession's notes are gone",
      !w2.body?.caseNotes?.some((c) => c.title === `NUR-${RUN}`));
    ck("their correction allowance is untouched by the change",
      w2.body?.allowed === w1.body?.allowed, `${w1.body?.allowed} -> ${w2.body?.allowed}`);
  }

  // Speaking reads the same field.
  const sp = await api("/speaking-hack-sentences", { token: s.token });
  ck("Speaking follows the profession too", sp.body?.profession === "Pharmacy" || sp.body?.locked === true,
    JSON.stringify({ profession: sp.body?.profession, locked: sp.body?.locked }));
}

console.log("\n=== 8. NO PROFESSION IS STILL SURVIVABLE ===");
{
  const n = await makeCandidate("noprof");
  const w = await api("/writing/library", { token: n.token });
  ck("the library endpoint does not error without one", w.status < 500, `status ${w.status}`);
  const sp = await api("/speaking-hack-sentences", { token: n.token });
  ck("speaking does not error without one", sp.status < 500, `status ${sp.status}`);
  ck("they can still set it", (await api("/auth/me/profession", {
    method: "PATCH", token: n.token, body: { profession: "Optometry" }
  })).status === 200 && prof(n.email) === "Optometry");
}

console.log(`\n${"=".repeat(52)}\nPASS ${P}   FAIL ${F}`);
if (fails.length) { console.log("\nFAILURES:"); for (const f of fails) console.log(`  · ${f}`); }
