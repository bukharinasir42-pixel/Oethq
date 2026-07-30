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

/**
 * Map programme dayNumber (1-based) to its local calendar date, skipping the
 * rest weekday (default Sunday). startDate is the local date of Day 1,
 * stored as midnight UTC of that calendar date.
 */
export function programmeDayDate(
  startDate: Date, dayNumber: number, restWeekday: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(
    startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()
  ));
  let counted = 0;
  // iterate calendar days; count only non-rest days
  // (bounded loop: dayNumber <= 366 guards runaway)
  for (let i = 0; i < 400; i++) {
    if (d.getUTCDay() !== restWeekday) {
      counted++;
      if (counted === dayNumber) break;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
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
