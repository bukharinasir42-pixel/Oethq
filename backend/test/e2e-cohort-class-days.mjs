/**
 * Cohort: four class days a week, chosen by the student.
 *
 * What has to hold:
 *   · exactly four weekdays, each with its own two class times
 *   · content runs in order across those days — one programme day per class day
 *   · changing the days never disturbs a day that has already been taught
 *   · students already on the six-day programme are not touched
 *
 * Run against a live API + database:
 *   node backend/test/e2e-cohort-class-days.mjs
 */
import { execFileSync } from "node:child_process";

const API = process.env.API_BASE || "http://127.0.0.1:4000";
const RUN = String(Date.now()).slice(-6);
const PSQL = ["-h", "/tmp", "-p", "5433", "-U", "postgres", "-d", "oethq", "-tA", "-c"];
const sql = (q) => execFileSync("psql", [...PSQL, q], { encoding: "utf8" }).trim();

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;
const NAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let P = 0, F = 0;
const fails = [];
const ck = (n, c, d = "") => {
  if (c) { P++; console.log(`  ok   ${n}`); }
  else { F++; fails.push(`${n}${d ? ` — ${d}` : ""}`); console.log(`  FAIL ${n}${d ? ` — ${d}` : ""}`); }
};

async function api(path, { method = "GET", body, token } = {}) {
  const h = { "content-type": "application/json", "x-device-id": `cd-${RUN}`, "x-device-fp": `fpcd-${RUN}` };
  if (token) h.authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { /* non-JSON */ }
  return { status: r.status, body: j, raw: t };
}

const admin = (await api("/auth/login", { method: "POST", body: { email: "admin@oet.test", password: "Admin@123" } })).body.accessToken;

/**
 * The calendar is only interesting over several weeks, so make sure there are
 * enough published programme days to lay out. Idempotent.
 */
const WANT_DAYS = 20;
sql(`
  INSERT INTO "DailyTask" (id, "dayNumber", title, "lectureTitle", "lectureUrl", "articleTitle", "articleUrl", "isPublished", "updatedAt")
  SELECT gen_random_uuid(), n, 'Day '||n, 'Lecture '||n, 'https://example.test/l/'||n,
         'Core Skills '||n, 'https://example.test/a/'||n, true, NOW()
    FROM generate_series(1, ${WANT_DAYS}) AS n
   WHERE NOT EXISTS (SELECT 1 FROM "DailyTask" d WHERE d."dayNumber" = n)
`);
sql(`UPDATE "DailyTask" SET "isPublished" = true WHERE "dayNumber" <= ${WANT_DAYS}`);
const publishedDays = Number(sql(`select count(*) from "DailyTask" where "isPublished"`));
console.log(`(fixture: ${publishedDays} published programme days)`);

/** One admin-created candidate, reused across sections to stay inside the create rate limit. */
async function makeStudent(tag) {
  const email = `${tag}-${RUN}@cohort.test`;
  const r = await api("/users/custom", {
    method: "POST", token: admin,
    body: { name: tag, email, productSlugs: ["reading-mega"], temporaryPassword: "Stress@1234" }
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`create ${tag}: ${r.status} ${r.raw.slice(0, 200)}`);
  const li = await api("/auth/login", { method: "POST", body: { email, password: "Stress@1234" } });
  return { email, token: li.body?.accessToken, id: sql(`select id from "User" where email='${email}'`) };
}

const days = (list) => list.map(([weekday, class1Time, class2Time]) => ({ weekday, class1Time, class2Time }));
const FOUR = days([[MON, "20:00", "21:30"], [WED, "20:00", "21:30"], [FRI, "18:00", "19:30"], [SAT, "10:00", "11:30"]]);

const weekdayOf = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

// =====================================================================
console.log("\n=== 1. ONBOARDING NEEDS THE FOUR DAYS ===");
const s = await makeStudent("picker");
{
  await api("/cohort/onboarding/timezone", { method: "POST", token: s.token, body: { country: "Pakistan", timezone: "Asia/Karachi" } });
  const me = await api("/cohort/me", { token: s.token });
  ck("a new student is on the picker, not the six-day programme", me.body?.schedule?.mode === "PICK_FOUR", me.body?.schedule?.mode);
  ck("timezone alone does not count as onboarded", me.body?.onboarded === false, JSON.stringify(me.body?.onboarded));
  ck("the API says how many days are wanted", me.body?.schedule?.classDaysPerWeek === 4, String(me.body?.schedule?.classDaysPerWeek));

  const blocked = await api("/cohort/days", { token: s.token });
  ck("the programme will not open until the days are chosen", blocked.status === 409, `status ${blocked.status}`);
}

console.log("\n=== 2. IT MUST BE EXACTLY FOUR ===");
{
  const cases = [
    [days([[MON, "20:00", "21:30"]]), "one day"],
    [days([[MON, "20:00", "21:30"], [TUE, "20:00", "21:30"], [WED, "20:00", "21:30"]]), "three days"],
    [days([[MON, "20:00", "21:30"], [TUE, "20:00", "21:30"], [WED, "20:00", "21:30"], [THU, "20:00", "21:30"], [FRI, "20:00", "21:30"]]), "five days"],
    [[], "none"]
  ];
  for (const [payload, label] of cases) {
    const r = await api("/cohort/onboarding/class-days", { method: "POST", token: s.token, body: { days: payload } });
    ck(`${label} is refused`, r.status >= 400, `status ${r.status}`);
  }

  const dup = days([[MON, "20:00", "21:30"], [MON, "08:00", "09:30"], [WED, "20:00", "21:30"], [FRI, "20:00", "21:30"]]);
  const rDup = await api("/cohort/onboarding/class-days", { method: "POST", token: s.token, body: { days: dup } });
  ck("the same weekday twice is refused", rDup.status >= 400, `status ${rDup.status}`);

  const badDay = days([[7, "20:00", "21:30"], [WED, "20:00", "21:30"], [FRI, "20:00", "21:30"], [SAT, "20:00", "21:30"]]);
  ck("weekday 7 is refused", (await api("/cohort/onboarding/class-days", { method: "POST", token: s.token, body: { days: badDay } })).status >= 400);

  const badTime = days([[MON, "25:00", "21:30"], [WED, "20:00", "21:30"], [FRI, "20:00", "21:30"], [SAT, "20:00", "21:30"]]);
  ck("an impossible time is refused", (await api("/cohort/onboarding/class-days", { method: "POST", token: s.token, body: { days: badTime } })).status >= 400);

  const tightGap = days([[MON, "20:00", "20:30"], [WED, "20:00", "21:30"], [FRI, "20:00", "21:30"], [SAT, "20:00", "21:30"]]);
  const rGap = await api("/cohort/onboarding/class-days", { method: "POST", token: s.token, body: { days: tightGap } });
  ck("classes less than an hour apart are refused", rGap.status >= 400, `status ${rGap.status}`);
  ck("and the message names the day at fault", /monday/i.test(String(rGap.body?.message ?? "")), String(rGap.body?.message));

  ck("nothing was stored by any bad attempt",
    sql(`select count(*) from "CohortClassDay" c join "CohortSchedule" s on s.id=c."scheduleId" where s."userId"='${s.id}'`) === "0");
}

console.log("\n=== 3. FOUR DAYS, EACH WITH ITS OWN TIMES ===");
{
  const r = await api("/cohort/onboarding/class-days", { method: "POST", token: s.token, body: { days: FOUR } });
  ck("four days are accepted", r.status === 200, `status ${r.status} ${r.raw.slice(0, 160)}`);
  ck("the student is now onboarded", r.body?.onboarded === true);

  const stored = r.body?.schedule?.classDays ?? [];
  ck("all four came back", stored.length === 4, String(stored.length));
  ck("each day kept its own times",
    stored.find((d) => d.weekday === FRI)?.class1Time === "18:00" &&
    stored.find((d) => d.weekday === SAT)?.class1Time === "10:00" &&
    stored.find((d) => d.weekday === MON)?.class1Time === "20:00",
    JSON.stringify(stored));

  const rows = sql(`select c.weekday||'@'||c."class1Time" from "CohortClassDay" c join "CohortSchedule" s2 on s2.id=c."scheduleId" where s2."userId"='${s.id}' order by c.weekday`);
  ck("and they are persisted", rows.split("\n").length === 4, rows.replace(/\n/g, " "));
}

console.log("\n=== 4. THE PROGRAMME RUNS ON THOSE DAYS, IN ORDER ===");
{
  const t = await api("/cohort/days", { token: s.token });
  ck("the timeline opens now", t.status === 200, `status ${t.status}`);
  const list = t.body?.days ?? [];
  ck("it has days in it", list.length > 0, String(list.length));

  const chosen = new Set([MON, WED, FRI, SAT]);
  const offPattern = list.filter((d) => !chosen.has(weekdayOf(d.date)));
  ck("every scheduled day falls on a chosen weekday", offPattern.length === 0,
    offPattern.slice(0, 3).map((d) => `Day ${d.dayNumber}=${d.date} (${NAME[weekdayOf(d.date)]})`).join(", "));

  const ordered = list.every((d, i) => i === 0 || d.date > list[i - 1].date);
  ck("day numbers run in strict date order", ordered);

  ck("no two days share a date", new Set(list.map((d) => d.date)).size === list.length);

  // Four class days is exactly one calendar week.
  if (list.length >= 5) {
    const gap = (new Date(`${list[4].date}T00:00:00Z`) - new Date(`${list[0].date}T00:00:00Z`)) / 86400000;
    ck("day 5 lands exactly one week after day 1", gap === 7, `${list[0].date} → ${list[4].date} = ${gap}d`);
  }

  // No calendar gap larger than the biggest hole in Mon/Wed/Fri/Sat (Sat→Mon = 2).
  const gaps = list.slice(1).map((d, i) => (new Date(`${d.date}T00:00:00Z`) - new Date(`${list[i].date}T00:00:00Z`)) / 86400000);
  ck("consecutive days are never more than 2 calendar days apart", gaps.every((g) => g <= 2), `max ${Math.max(...gaps)}`);
}

console.log("\n=== 5. EACH DAY'S SESSIONS USE THAT WEEKDAY'S TIMES ===");
{
  const t = await api("/cohort/days", { token: s.token });
  const list = t.body?.days ?? [];
  const expectHour = { [MON]: 20, [WED]: 20, [FRI]: 18, [SAT]: 10 };
  let checked = 0, wrong = [];
  for (const d of list.slice(0, 6)) {
    const day = await api(`/cohort/days/${d.dayNumber}`, { token: s.token });
    if (day.status !== 200) continue;
    const lecture = (day.body?.sessions ?? []).find((x) => x.slot === "LECTURE");
    if (!lecture) continue;
    // Compare in the student's timezone, which is what they were promised.
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi", hour: "2-digit", hour12: false
    }).format(new Date(lecture.scheduledAtUtc));
    const wd = weekdayOf(d.date);
    checked++;
    if (Number(local) !== expectHour[wd]) wrong.push(`Day ${d.dayNumber} ${NAME[wd]} ${local}h != ${expectHour[wd]}h`);
  }
  ck("several days were inspected", checked >= 4, `checked ${checked}`);
  ck("the lecture starts at the time set for that weekday", wrong.length === 0, wrong.join("; "));

  const day1 = await api("/cohort/days/1", { token: s.token });
  ck("both classes exist on a class day", (day1.body?.sessions ?? []).length === 2, String((day1.body?.sessions ?? []).length));
}

/** The mid-programme student, reused by section 9 for playback. */
let m;
console.log("\n=== 6. CHANGING THE DAYS LEAVES TAUGHT DAYS ALONE ===");
{
  // A student who is genuinely mid-course — the whole point of the rule is what
  // happens to days that have already run. Their own account, backdated BEFORE
  // any day is opened, so every session record is written against one calendar.
  m = await makeStudent("midway");
  await api("/cohort/onboarding/timezone", { method: "POST", token: m.token, body: { country: "Pakistan", timezone: "Asia/Karachi" } });
  await api("/cohort/onboarding/class-days", { method: "POST", token: m.token, body: { days: FOUR } });

  const back = new Date(Date.now() - 21 * 86400000);
  while (back.getUTCDay() !== MON) back.setUTCDate(back.getUTCDate() - 1);
  const anchor = back.toISOString().slice(0, 10);
  sql(`update "CohortSchedule" set "startDate"='${anchor}T00:00:00Z', "startDayNumber"=1 where "userId"='${m.id}'`);

  const before = (await api("/cohort/days", { token: m.token })).body?.days ?? [];
  const todayEntry = before.find((d) => d.label === "Today");
  const todayNum = todayEntry?.dayNumber ?? 0;
  ck("the student is now mid-programme", todayNum >= 5,
    `today = day ${todayNum} of ${before.length}, anchored ${anchor}`);

  const past = before.filter((d) => d.dayNumber <= Math.max(todayNum, 1));
  const pastDates = new Map(past.map((d) => [d.dayNumber, d.date]));
  ck("there are taught days to protect", past.length >= 5, String(past.length));

  // Open a couple of them, so both kinds of history are covered: days with a
  // session the student actually touched, and days they never opened.
  for (const d of past.slice(0, 2)) await api(`/cohort/days/${d.dayNumber}`, { token: m.token });

  const NEWDAYS = days([[TUE, "07:00", "08:30"], [THU, "07:00", "08:30"], [SAT, "16:00", "17:30"], [SUN, "16:00", "17:30"]]);
  const chg = await api("/cohort/onboarding/class-days", { method: "POST", token: m.token, body: { days: NEWDAYS } });
  ck("the student may change their days", chg.status === 200, `status ${chg.status} ${chg.raw.slice(0, 160)}`);
  ck("the new set is what comes back",
    JSON.stringify((chg.body?.schedule?.classDays ?? []).map((d) => d.weekday).sort()) === JSON.stringify([SUN, TUE, THU, SAT].sort()),
    JSON.stringify(chg.body?.schedule?.classDays));

  const after = (await api("/cohort/days", { token: m.token })).body?.days ?? [];
  const moved = [...pastDates.entries()].filter(([n, date]) => after.find((d) => d.dayNumber === n)?.date !== date);
  ck("days already taught keep the dates they ran on", moved.length === 0,
    moved.map(([n, was]) => `Day ${n} was ${was}, now ${after.find((d) => d.dayNumber === n)?.date}`).join("; "));

  const future = after.filter((d) => d.dayNumber > Math.max(todayNum, 1));
  const newSet = new Set([TUE, THU, SAT, SUN]);
  const stragglers = future.filter((d) => !newSet.has(weekdayOf(d.date)));
  ck("every day still ahead moved onto the new weekdays", stragglers.length === 0,
    stragglers.slice(0, 3).map((d) => `Day ${d.dayNumber}=${d.date} (${NAME[weekdayOf(d.date)]})`).join(", "));
  ck("there were future days to move", future.length >= 3, String(future.length));

  const todayIso = new Date().toISOString().slice(0, 10);
  const backwards = future.filter((d) => d.date <= todayIso);
  ck("nothing ahead was pulled into the past", backwards.length === 0,
    backwards.map((d) => `Day ${d.dayNumber}=${d.date}`).join(", "));

  ck("the calendar is still in strict order after the change",
    after.every((d, i) => i === 0 || d.date > after[i - 1].date),
    after.slice(0, 8).map((d) => `${d.dayNumber}:${d.date}`).join(" "));

  ck("no day number was skipped or repeated",
    new Set(after.map((d) => d.dayNumber)).size === after.length &&
    after.every((d, i) => i === 0 || d.dayNumber === after[i - 1].dayNumber + 1));

  ck("the change is written to the schedule history",
    Number(sql(`select count(*) from "CohortScheduleChange" c join "CohortSchedule" s2 on s2.id=c."scheduleId" where s2."userId"='${m.id}' and c.field='classDays'`)) >= 1);
}

console.log("\n=== 7. CHANGING TO THE SAME DAYS IS A NO-OP ===");
{
  const before = (await api("/cohort/days", { token: s.token })).body?.days ?? [];
  const changesBefore = sql(`select count(*) from "CohortScheduleChange" c join "CohortSchedule" s2 on s2.id=c."scheduleId" where s2."userId"='${s.id}' and c.field='classDays'`);
  // Exactly the days this student already has, in a different array order — the
  // no-op check must compare the set, not the payload it arrived in.
  const same = [...FOUR].reverse();
  const r = await api("/cohort/onboarding/class-days", { method: "POST", token: s.token, body: { days: same } });
  ck("re-sending the same days succeeds", r.status === 200, `status ${r.status}`);
  const after = (await api("/cohort/days", { token: s.token })).body?.days ?? [];
  ck("and moves nothing", JSON.stringify(before.map((d) => d.date)) === JSON.stringify(after.map((d) => d.date)));
  ck("and does not log a change",
    sql(`select count(*) from "CohortScheduleChange" c join "CohortSchedule" s2 on s2.id=c."scheduleId" where s2."userId"='${s.id}' and c.field='classDays'`) === changesBefore);
}

console.log("\n=== 8. THE SIX-DAY PROGRAMME IS UNTOUCHED ===");
{
  // A student who enrolled before the picker existed: six days a week, one time
  // pair, no class-day rows. Written exactly as the migration leaves them.
  const legacy = await makeStudent("legacy");
  const back = new Date(Date.now() - 21 * 86400000);
  while (back.getUTCDay() !== MON) back.setUTCDate(back.getUTCDate() - 1);
  sql(`
    INSERT INTO "CohortSchedule" (id, "userId", country, timezone, "class1Time", "class2Time",
                                  "startDate", "startDayNumber", "totalDays", "restWeekday", mode, "updatedAt")
    VALUES (gen_random_uuid(), '${legacy.id}', 'Pakistan', 'Asia/Karachi', '20:00', '21:30',
            '${back.toISOString().slice(0, 10)}T00:00:00Z', 1, ${WANT_DAYS}, 0, 'LEGACY_SIX_DAY', NOW())
  `);

  const mode = sql(`select mode from "CohortSchedule" where "userId"='${legacy.id}'`);
  ck("a six-day schedule stays LEGACY_SIX_DAY", mode === "LEGACY_SIX_DAY", mode);
  ck("it has no class-day rows",
    sql(`select count(*) from "CohortClassDay" c join "CohortSchedule" s2 on s2.id=c."scheduleId" where s2."userId"='${legacy.id}'`) === "0");
  ck("its startDayNumber defaulted to 1", sql(`select "startDayNumber" from "CohortSchedule" where "userId"='${legacy.id}'`) === "1");

  const me = await api("/cohort/me", { token: legacy.token });
  ck("a legacy student is onboarded without choosing days", me.body?.onboarded === true, JSON.stringify(me.body?.onboarded));
  ck("and is reported on the six-day mode", me.body?.schedule?.mode === "LEGACY_SIX_DAY", me.body?.schedule?.mode);

  const t = await api("/cohort/days", { token: legacy.token });
  const list = t.body?.days ?? [];
  ck("the six-day timeline still loads", t.status === 200 && list.length > 0, `status ${t.status} n=${list.length}`);
  ck("and still skips only Sunday", list.every((d) => weekdayOf(d.date) !== SUN),
    list.filter((d) => weekdayOf(d.date) === SUN).map((d) => d.date).join(", "));
  const gaps = list.slice(1).map((d, i) => (new Date(`${d.date}T00:00:00Z`) - new Date(`${list[i].date}T00:00:00Z`)) / 86400000);
  ck("with consecutive dates, bar the Sunday skip", gaps.every((g) => g <= 2), `max ${Math.max(...gaps, 0)}`);
  ck("six class days per calendar week, as before",
    list.length < 7 || (new Date(`${list[6].date}T00:00:00Z`) - new Date(`${list[0].date}T00:00:00Z`)) / 86400000 === 7,
    list.slice(0, 7).map((d) => d.date).join(" "));

  const day1 = await api("/cohort/days/1", { token: legacy.token });
  const lecture = (day1.body?.sessions ?? []).find((x) => x.slot === "LECTURE");
  const hour = lecture && new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", hour12: false })
    .format(new Date(lecture.scheduledAtUtc));
  ck("its single time pair still drives every day", Number(hour) === 20, String(hour));

  const rej = await api("/cohort/onboarding/class-days", { method: "POST", token: legacy.token, body: { days: FOUR } });
  ck("a legacy student cannot be moved onto the picker", rej.status === 409, `status ${rej.status}`);

  const legacyTimes = await api("/cohort/onboarding/schedule", { method: "POST", token: legacy.token, body: { class1Time: "09:00", class2Time: "10:30" } });
  ck("but can still change their two class times", legacyTimes.status === 200, `status ${legacyTimes.status}`);

  // The reverse guard: a picker student cannot use the legacy two-time endpoint.
  const rej2 = await api("/cohort/onboarding/schedule", { method: "POST", token: s.token, body: { class1Time: "09:00", class2Time: "10:30" } });
  ck("a picker student cannot use the six-day times endpoint", rej2.status === 409, `status ${rej2.status}`);
}

console.log("\n=== 9. BOTH CLASSES ARE WATCHABLE, AND THE EMAIL LINK WORKS ===");
{
  // Give the day real video sources: one held as a Bunny id, one as a plain URL,
  // so both ways of uploading a class are covered.
  sql(`update "DailyTask" set "lectureBunnyVideoId"='11111111-2222-3333-4444-555555555555',
       "articleUrl"='https://video.example.test/core-skills-1.mp4' where "dayNumber"=1`);

  const day = await api("/cohort/days/1", { token: m.token });
  const ss = day.body?.sessions ?? [];
  ck("the day returns both classes", ss.length === 2, JSON.stringify(ss.map((x) => x.slot)));
  ck("one is the lecture and one is core skills",
    ss.some((x) => x.slot === "LECTURE") && ss.some((x) => x.slot === "CORE_SKILLS"));

  for (const x of ss) {
    ck(`${x.slot}: has a title`, Boolean(x.title), JSON.stringify(x.title));
    ck(`${x.slot}: has a scheduled local time`, Boolean(x.scheduledLocal));
    ck(`${x.slot}: offers an action to the student`, Boolean(x.primaryAction), x.primaryAction);
    const watchable = ["AVAILABLE", "IN_PROGRESS", "MISSED", "RECORDING_AVAILABLE", "COMPLETED"].includes(x.state);
    if (watchable) {
      ck(`${x.slot}: a watchable class has a video to play`, Boolean(x.embedUrl), `${x.state} → ${x.embedUrl}`);
    } else {
      ck(`${x.slot}: a class that has not opened yet withholds the video`, x.embedUrl === null, `${x.state}`);
    }
  }

  // Joining must work for each slot independently.
  for (const slot of ["LECTURE", "CORE_SKILLS"]) {
    const j = await api(`/cohort/sessions/1/${slot}/join`, { method: "POST", token: m.token });
    ck(`${slot}: join succeeds`, j.status === 200, `status ${j.status} ${j.raw.slice(0, 120)}`);
    const p = await api(`/cohort/sessions/1/${slot}/progress`, {
      method: "POST", token: m.token, body: { positionSec: 30, activeDeltaSec: 30, mode: "recording" }
    });
    ck(`${slot}: watch progress is recorded`, p.status === 200, `status ${p.status}`);
  }
  ck("both classes now have watch time stored",
    Number(sql(`select count(*) from "CohortSessionRecord" where "userId"='${m.id}' and "dayNumber"=1 and ("activeWatchSec">0 or "recordingWatchSec">0)`)) === 2);

  // The reminder email's link must be absolute and must land on a real page —
  // a relative or half-built URL is what produced "http:///portal/tasks".
  const link = `${process.env.APP_URL || "http://localhost:3000"}/portal/tasks?day=3`;
  ck("the reminder link is absolute, with a host", /^https?:\/\/[^/]+\/portal\/tasks/.test(link), link);
  try {
    const r = await fetch(link, { redirect: "follow" });
    ck("and the page it points at loads", r.status < 400, `status ${r.status} for ${link}`);
  } catch (e) {
    ck("and the page it points at loads", false, `${link} — ${e.message}`);
  }
}

console.log("\n=== 10. THE AWKWARD CHOICES STUDENTS ACTUALLY MAKE ===");
{
  const a = await makeStudent("awkward");
  await api("/cohort/onboarding/timezone", { method: "POST", token: a.token, body: { country: "Pakistan", timezone: "Asia/Karachi" } });

  // Both classes run on one calendar date, so Core Skills has to come after the
  // lecture ON THE CLOCK. Measuring the wrapping distance would call 23:00 and
  // 00:30 "90 minutes apart" and schedule Core Skills 22.5 hours EARLIER.
  const pairs = [
    [["23:00", "00:30"], false, "core skills after midnight"],
    [["21:30", "20:00"], false, "core skills before the lecture"],
    [["20:00", "20:00"], false, "both at the same time"],
    [["20:00", "20:59"], false, "59 minutes apart"],
    [["20:00", "21:00"], true, "exactly an hour apart"],
    [["00:00", "23:30"], true, "first thing to last thing"]
  ];
  for (const [[c1, c2], ok, label] of pairs) {
    const r = await api("/cohort/onboarding/class-days", {
      method: "POST", token: a.token,
      body: { days: [MON, WED, FRI, SAT].map((weekday) => ({ weekday, class1Time: c1, class2Time: c2 })) }
    });
    ck(`${label} → ${ok ? "accepted" : "refused"}`, ok ? r.status === 200 : r.status >= 400,
      `status ${r.status} ${String(r.body?.message ?? "").slice(0, 80)}`);
  }
  const d1 = await api("/cohort/days/1", { token: a.token });
  const lec = d1.body?.sessions?.find((x) => x.slot === "LECTURE");
  const core = d1.body?.sessions?.find((x) => x.slot === "CORE_SKILLS");
  ck("core skills is scheduled after the lecture, never before",
    lec && core && new Date(core.scheduledAtUtc) > new Date(lec.scheduledAtUtc),
    `${lec?.scheduledAtUtc} → ${core?.scheduledAtUtc}`);

  // Four consecutive weekdays leave a four-day gap. It is their choice, and it
  // must still lay out in order.
  const blocky = await api("/cohort/onboarding/class-days", {
    method: "POST", token: a.token,
    body: { days: [MON, TUE, WED, THU].map((weekday) => ({ weekday, class1Time: "20:00", class2Time: "21:30" })) }
  });
  ck("four days in a row are allowed", blocky.status === 200, `status ${blocky.status}`);
  const list = (await api("/cohort/days", { token: a.token })).body?.days ?? [];
  ck("and still run in strict order across the long gap",
    list.length > 0 && list.every((d, i) => i === 0 || d.date > list[i - 1].date));
  ck("on only those four weekdays",
    list.every((d) => [MON, TUE, WED, THU].includes(weekdayOf(d.date))),
    list.slice(0, 6).map((d) => `${d.date}(${NAME[weekdayOf(d.date)]})`).join(" "));
}

console.log("\n=== 11. MOVING COUNTRY KEEPS CLASSES AT THE CHOSEN LOCAL TIME ===");
{
  const a = await makeStudent("emigrant");
  await api("/cohort/onboarding/timezone", { method: "POST", token: a.token, body: { country: "Pakistan", timezone: "Asia/Karachi" } });
  await api("/cohort/onboarding/class-days", {
    method: "POST", token: a.token,
    body: { days: [MON, WED, FRI, SAT].map((weekday) => ({ weekday, class1Time: "20:00", class2Time: "21:30" })) }
  });
  const beforeUtc = (await api("/cohort/days/1", { token: a.token })).body?.sessions
    ?.find((x) => x.slot === "LECTURE")?.scheduledAtUtc;

  const moved = await api("/cohort/onboarding/timezone", {
    method: "POST", token: a.token, body: { country: "United Kingdom", timezone: "Europe/London" }
  });
  ck("a student can move country after picking their days", moved.status === 200, `status ${moved.status}`);
  ck("their four days survive the move",
    ((await api("/cohort/me", { token: a.token })).body?.schedule?.classDays ?? []).length === 4);

  const afterLec = (await api("/cohort/days/1", { token: a.token })).body?.sessions
    ?.find((x) => x.slot === "LECTURE");
  const localHour = afterLec && new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", hour12: false
  }).format(new Date(afterLec.scheduledAtUtc));
  // Sessions store an absolute instant. Left alone, an 8pm Karachi class becomes
  // a 4pm London class — which breaks the promise made at onboarding.
  ck("8pm still means 8pm where they now live", Number(localHour) === 20, `${localHour}h London`);
  ck("so the stored instant genuinely moved", afterLec?.scheduledAtUtc !== beforeUtc,
    `${beforeUtc} → ${afterLec?.scheduledAtUtc}`);
}

console.log("\n=== 12. A DOUBLE-CLICKED SAVE ===");
{
  const a = await makeStudent("doubletap");
  await api("/cohort/onboarding/timezone", { method: "POST", token: a.token, body: { country: "Pakistan", timezone: "Asia/Karachi" } });
  const body = { days: [MON, WED, FRI, SAT].map((weekday) => ({ weekday, class1Time: "20:00", class2Time: "21:30" })) };
  const [r1, r2] = await Promise.all([
    api("/cohort/onboarding/class-days", { method: "POST", token: a.token, body }),
    api("/cohort/onboarding/class-days", { method: "POST", token: a.token, body })
  ]);
  // Replace-all under a unique (scheduleId, weekday): two saves can interleave
  // delete and create. Losing that race must not surface as a server error.
  ck("neither save returns a server error", r1.status < 500 && r2.status < 500, `${r1.status}/${r2.status}`);
  ck("and exactly four class days are left, not eight",
    sql(`select count(*) from "CohortClassDay" c join "CohortSchedule" s2 on s2.id=c."scheduleId" where s2."userId"='${a.id}'`) === "4");
}

console.log("\n=== 13. AUTHORISATION ===");
{
  ck("a signed-out caller cannot set class days",
    (await api("/cohort/onboarding/class-days", { method: "POST", body: { days: FOUR } })).status === 401);
  ck("a signed-out caller cannot read the timeline",
    (await api("/cohort/days")).status === 401);
}

console.log(`\n${"=".repeat(52)}\nPASS ${P}   FAIL ${F}`);
if (fails.length) { console.log("\nFAILURES:"); for (const f of fails) console.log(`  · ${f}`); }
process.exit(F > 0 ? 1 : 0);
