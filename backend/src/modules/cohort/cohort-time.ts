/**
 * cohort-time.ts — dependency-free IANA timezone helpers.
 * Canonical storage is UTC; the student's IANA timezone is used only to
 * compute instants and to format for display. No luxon/moment added —
 * uses the built-in Intl API (Node >= 18).
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/** What wall-clock does `utc` show in `timeZone`? */
export function wallClock(utc: Date, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get("year"), month: get("month"), day: get("day"),
    hour: get("hour") % 24, minute: get("minute"), second: get("second")
  };
}

/** Offset (ms) of `timeZone` relative to UTC at instant `utc` (DST-aware). */
function tzOffsetMs(utc: Date, timeZone: string): number {
  const w = wallClock(utc, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - utc.getTime();
}

/**
 * Convert a local date + "HH:mm" in an IANA zone to the exact UTC instant.
 * Two-pass correction handles DST transitions correctly.
 */
export function zonedTimeToUtc(
  year: number, month: number, day: number, hhmm: string, timeZone: string
): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, h, m, 0);
  let utc = new Date(naive - tzOffsetMs(new Date(naive), timeZone));
  // second pass: re-derive offset at the candidate instant (DST edge)
  utc = new Date(naive - tzOffsetMs(utc, timeZone));
  return utc;
}

/** Local calendar date (y/m/d + weekday 0=Sun) for an instant in a zone. */
export function localDate(utc: Date, timeZone: string) {
  const w = wallClock(utc, timeZone);
  const weekday = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();
  return { year: w.year, month: w.month, day: w.day, weekday };
}

export type CalendarDate = { year: number; month: number; day: number };

/** Bound on every calendar walk below — a 40-day programme spans ~10 weeks. */
const WALK_LIMIT = 800;

const midnightUtc = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const asDate = (c: CalendarDate) => new Date(Date.UTC(c.year, c.month - 1, c.day));

const toCalendar = (d: Date): CalendarDate =>
  ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });

/**
 * The anchor is "programme day N falls on this date". Callers may hand us an
 * anchor whose weekday is no longer a class day — that happens the moment a
 * student drops the weekday they are anchored on — so slide forward to the next
 * real class day first. Without this the walks below would count from a date
 * that is not itself a class day and every subsequent day would be off by one.
 */
function normaliseAnchor(anchor: Date, classWeekdays: ReadonlySet<number>): Date {
  const d = midnightUtc(anchor);
  for (let i = 0; i < 14 && !classWeekdays.has(d.getUTCDay()); i++) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

/**
 * Map a programme dayNumber to its local calendar date.
 *
 * Content advances one day per *class day* — the days the student actually has
 * classes on — never per calendar day. Day N+1 is simply the next class day
 * after day N, which is what makes the programme run in order no matter which
 * weekdays were picked or how sparse they are.
 *
 * `anchorDate` is the local date of `anchorDayNumber` (midnight UTC of that
 * calendar date). Days before the anchor are counted backwards, which is how a
 * timeline still renders history after a re-anchor.
 */
export function programmeDayDate(
  anchorDate: Date,
  anchorDayNumber: number,
  dayNumber: number,
  classWeekdays: ReadonlySet<number>
): CalendarDate {
  if (classWeekdays.size === 0) return toCalendar(midnightUtc(anchorDate));
  const d = normaliseAnchor(anchorDate, classWeekdays);
  let remaining = Math.abs(dayNumber - anchorDayNumber);
  const step = dayNumber >= anchorDayNumber ? 1 : -1;
  for (let i = 0; i < WALK_LIMIT && remaining > 0; i++) {
    d.setUTCDate(d.getUTCDate() + step);
    if (classWeekdays.has(d.getUTCDay())) remaining--;
  }
  return toCalendar(d);
}

/**
 * Which programme day does `target` fall on?
 *
 *   > 0  target is a class day, and this is its day number
 *   < 0  target is a rest day; |value| is the most recent class day before it
 *   = 0  the programme has not started yet
 *
 * The sign convention is load-bearing: callers use it to tell "today is Day 7"
 * apart from "today is a rest day and Day 7 was the last one".
 */
export function dayNumberOnDate(
  anchorDate: Date,
  anchorDayNumber: number,
  target: CalendarDate,
  classWeekdays: ReadonlySet<number>
): number {
  if (classWeekdays.size === 0) return 0;
  const anchor = normaliseAnchor(anchorDate, classWeekdays);
  const t = asDate(target);
  const targetIsClassDay = classWeekdays.has(t.getUTCDay());

  if (t.getTime() < anchor.getTime()) {
    // Only reachable before the programme starts, or when reading history that
    // predates a re-anchor.
    let count = anchorDayNumber;
    const d = new Date(anchor);
    for (let i = 0; i < WALK_LIMIT && d.getTime() > t.getTime(); i++) {
      d.setUTCDate(d.getUTCDate() - 1);
      if (classWeekdays.has(d.getUTCDay())) count--;
    }
    if (count < 1) return 0;
    return targetIsClassDay ? count : -count;
  }

  let count = anchorDayNumber; // the anchor itself is day `anchorDayNumber`
  const d = new Date(anchor);
  for (let i = 0; i < WALK_LIMIT && d.getTime() < t.getTime(); i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (classWeekdays.has(d.getUTCDay())) count++;
  }
  return targetIsClassDay ? count : -count;
}

/** The first class day strictly after `from`. Used to re-anchor a changed schedule. */
export function nextClassDayAfter(from: CalendarDate, classWeekdays: ReadonlySet<number>): CalendarDate {
  const d = asDate(from);
  for (let i = 0; i < 14; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (classWeekdays.has(d.getUTCDay())) break;
  }
  return toCalendar(d);
}

export function hhmmValid(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatLocal(utc: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone, weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true
  }).format(utc);
}
