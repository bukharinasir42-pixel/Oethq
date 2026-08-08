/**
 * The cohort calendar maths. Everything a student sees — which day is "today",
 * when each class starts, what the timeline says — is derived from these three
 * functions, so they are tested against hand-checked calendar dates rather than
 * against themselves.
 *
 * Reference month: August 2026.
 *   Sat 1 · Sun 2 · Mon 3 · Tue 4 · Wed 5 · Thu 6 · Fri 7 · Sat 8 · Sun 9
 *   Mon 10 · Tue 11 · Wed 12 · Thu 13 · Fri 14 · Sat 15 · Sun 16 · Mon 17
 */
import { dayNumberOnDate, nextClassDayAfter, programmeDayDate } from "./cohort-time";

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

/** Midnight-UTC Date for a calendar date, which is how anchors are stored. */
const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const ymd = (c: { year: number; month: number; day: number }) =>
  `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;

const PICK_FOUR = new Set([MON, WED, FRI, SAT]);
const LEGACY_SIX = new Set([MON, TUE, WED, THU, FRI, SAT]); // every day but Sunday

describe("programmeDayDate — four chosen weekdays", () => {
  // Day 1 = Mon 3 Aug 2026.
  const anchor = at(2026, 8, 3);

  it("advances one programme day per class day, not per calendar day", () => {
    const dates = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
      (n) => ymd(programmeDayDate(anchor, 1, n, PICK_FOUR))
    );
    expect(dates).toEqual([
      "2026-08-03", // Mon — Day 1
      "2026-08-05", // Wed — Day 2
      "2026-08-07", // Fri — Day 3
      "2026-08-08", // Sat — Day 4
      "2026-08-10", // Mon — Day 5   (skips Sun 9)
      "2026-08-12", // Wed — Day 6
      "2026-08-14", // Fri — Day 7
      "2026-08-15", // Sat — Day 8
      "2026-08-17"  // Mon — Day 9
    ]);
  });

  it("delivers exactly four days of content per calendar week", () => {
    const day1 = programmeDayDate(anchor, 1, 1, PICK_FOUR);
    const day5 = programmeDayDate(anchor, 1, 5, PICK_FOUR);
    const spanDays = (at(day5.year, day5.month, day5.day).getTime()
      - at(day1.year, day1.month, day1.day).getTime()) / 86_400_000;
    expect(spanDays).toBe(7); // four class days later is exactly one week on
  });

  it("only ever lands on a chosen weekday", () => {
    for (let n = 1; n <= 40; n++) {
      const c = programmeDayDate(anchor, 1, n, PICK_FOUR);
      expect(PICK_FOUR.has(at(c.year, c.month, c.day).getUTCDay())).toBe(true);
    }
  });

  it("counts backwards for days before the anchor", () => {
    // Anchored at Day 5 = Mon 10 Aug; Day 1 must still be Mon 3 Aug.
    expect(ymd(programmeDayDate(at(2026, 8, 10), 5, 1, PICK_FOUR))).toBe("2026-08-03");
    expect(ymd(programmeDayDate(at(2026, 8, 10), 5, 4, PICK_FOUR))).toBe("2026-08-08");
  });

  it("slides an anchor that is no longer a class day onto the next one", () => {
    // Anchored on Tue 4 Aug, which is not in the set — Day 1 becomes Wed 5 Aug.
    expect(ymd(programmeDayDate(at(2026, 8, 4), 1, 1, PICK_FOUR))).toBe("2026-08-05");
  });

  it("still terminates when a student somehow has one class day a week", () => {
    const onlySat = new Set([SAT]);
    expect(ymd(programmeDayDate(at(2026, 8, 1), 1, 4, onlySat))).toBe("2026-08-22");
  });
});

describe("programmeDayDate — the legacy six-day calendar is unchanged", () => {
  const anchor = at(2026, 8, 3); // Mon

  it("skips only Sunday", () => {
    const dates = [1, 2, 3, 4, 5, 6, 7].map((n) => ymd(programmeDayDate(anchor, 1, n, LEGACY_SIX)));
    expect(dates).toEqual([
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
      "2026-08-07", "2026-08-08", "2026-08-10" // Sun 9 skipped
    ]);
  });
});

describe("dayNumberOnDate", () => {
  const anchor = at(2026, 8, 3); // Day 1 = Mon 3 Aug

  it("names the day a class date belongs to", () => {
    expect(dayNumberOnDate(anchor, 1, { year: 2026, month: 8, day: 3 }, PICK_FOUR)).toBe(1);
    expect(dayNumberOnDate(anchor, 1, { year: 2026, month: 8, day: 8 }, PICK_FOUR)).toBe(4);
    expect(dayNumberOnDate(anchor, 1, { year: 2026, month: 8, day: 17 }, PICK_FOUR)).toBe(9);
  });

  it("returns a negative number on a rest day, carrying the last class day", () => {
    // Tue 4 Aug is not a class day; the last one was Day 1 (Mon 3rd).
    expect(dayNumberOnDate(anchor, 1, { year: 2026, month: 8, day: 4 }, PICK_FOUR)).toBe(-1);
    // Sun 9 Aug — the last class day was Day 4 (Sat 8th).
    expect(dayNumberOnDate(anchor, 1, { year: 2026, month: 8, day: 9 }, PICK_FOUR)).toBe(-4);
  });

  it("returns 0 before the programme starts", () => {
    expect(dayNumberOnDate(anchor, 1, { year: 2026, month: 8, day: 1 }, PICK_FOUR)).toBe(0);
    expect(dayNumberOnDate(anchor, 1, { year: 2026, month: 7, day: 30 }, PICK_FOUR)).toBe(0);
  });

  it("is the exact inverse of programmeDayDate", () => {
    for (let n = 1; n <= 40; n++) {
      const c = programmeDayDate(anchor, 1, n, PICK_FOUR);
      expect(dayNumberOnDate(anchor, 1, c, PICK_FOUR)).toBe(n);
    }
  });

  it("counts from a re-anchored schedule without disturbing the numbering", () => {
    // Re-anchored: Day 12 sits on Wed 12 Aug.
    const reanchored = at(2026, 8, 12);
    expect(dayNumberOnDate(reanchored, 12, { year: 2026, month: 8, day: 12 }, PICK_FOUR)).toBe(12);
    expect(dayNumberOnDate(reanchored, 12, { year: 2026, month: 8, day: 14 }, PICK_FOUR)).toBe(13);
    expect(dayNumberOnDate(reanchored, 12, { year: 2026, month: 8, day: 15 }, PICK_FOUR)).toBe(14);
    // A date before the anchor still reads back as an earlier day, not as zero.
    expect(dayNumberOnDate(reanchored, 12, { year: 2026, month: 8, day: 10 }, PICK_FOUR)).toBe(11);
  });
});

describe("nextClassDayAfter", () => {
  it("finds the next chosen weekday, strictly after the date given", () => {
    // From Mon 3rd (itself a class day) the next is Wed 5th, not Mon 3rd.
    expect(ymd(nextClassDayAfter({ year: 2026, month: 8, day: 3 }, PICK_FOUR))).toBe("2026-08-05");
    // From Sat 8th, across the weekend gap, to Mon 10th.
    expect(ymd(nextClassDayAfter({ year: 2026, month: 8, day: 8 }, PICK_FOUR))).toBe("2026-08-10");
    // From a rest day.
    expect(ymd(nextClassDayAfter({ year: 2026, month: 8, day: 9 }, PICK_FOUR))).toBe("2026-08-10");
  });

  it("crosses a month boundary", () => {
    expect(ymd(nextClassDayAfter({ year: 2026, month: 8, day: 31 }, PICK_FOUR))).toBe("2026-09-02");
  });
});

describe("changing class days mid-programme", () => {
  /**
   * The rule the product promises: days already taught keep their dates, and
   * only days from the next one on move onto the new weekdays.
   */
  it("leaves taught days alone and re-lays only what follows", () => {
    const original = at(2026, 8, 3); // Day 1 = Mon 3 Aug, on Mon/Wed/Fri/Sat
    // The student has reached Day 4 (Sat 8 Aug) and switches to Tue/Thu/Sat/Sun.
    const reached = dayNumberOnDate(original, 1, { year: 2026, month: 8, day: 8 }, PICK_FOUR);
    expect(reached).toBe(4);

    const newDays = new Set([TUE, THU, SAT, SUN]);
    const next = nextClassDayAfter({ year: 2026, month: 8, day: 8 }, newDays);
    expect(ymd(next)).toBe("2026-08-09"); // Sun 9th

    const newAnchor = at(next.year, next.month, next.day);
    const newAnchorDay = reached + 1; // Day 5

    // History is untouched: Days 1–4 still read off the old calendar.
    expect(ymd(programmeDayDate(original, 1, 1, PICK_FOUR))).toBe("2026-08-03");
    expect(ymd(programmeDayDate(original, 1, 4, PICK_FOUR))).toBe("2026-08-08");

    // The future follows the new weekdays, with no day number skipped or repeated.
    expect(ymd(programmeDayDate(newAnchor, newAnchorDay, 5, newDays))).toBe("2026-08-09"); // Sun
    expect(ymd(programmeDayDate(newAnchor, newAnchorDay, 6, newDays))).toBe("2026-08-11"); // Tue
    expect(ymd(programmeDayDate(newAnchor, newAnchorDay, 7, newDays))).toBe("2026-08-13"); // Thu
    expect(ymd(programmeDayDate(newAnchor, newAnchorDay, 8, newDays))).toBe("2026-08-15"); // Sat
  });

  it("never sends the student backwards when they switch", () => {
    const original = at(2026, 8, 3);
    for (let reachedDay = 1; reachedDay <= 20; reachedDay++) {
      const on = programmeDayDate(original, 1, reachedDay, PICK_FOUR);
      const newDays = new Set([TUE, THU, SAT, SUN]);
      const next = nextClassDayAfter(on, newDays);
      const nextDate = at(next.year, next.month, next.day);
      // The next programme day always lands strictly after the day just reached.
      expect(nextDate.getTime()).toBeGreaterThan(at(on.year, on.month, on.day).getTime());
      // And it is a day the student actually chose.
      expect(newDays.has(nextDate.getUTCDay())).toBe(true);
    }
  });
});
