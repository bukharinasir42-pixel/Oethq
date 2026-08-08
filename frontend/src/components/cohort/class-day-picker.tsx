"use client";

/**
 * ClassDayPicker — choose the four weekdays you have class on, and the two
 * class times on each of them.
 *
 * Four, not "up to four": the programme is built around four class days a week,
 * so the control refuses to save until exactly four are selected and says how
 * many are still needed rather than silently disabling the button.
 *
 * Content runs in order across whichever days are picked — Day 1 on the first
 * class day, Day 2 on the next, and so on — so the choice changes *when* the
 * programme runs, never what is in it or the order it arrives in. The copy says
 * that plainly, because the obvious worry when choosing fewer days is that you
 * are giving something up.
 */
import { useMemo, useState } from "react";
import type { CohortClassDay } from "@/lib/cohort-api";

export const WEEKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" }
] as const;

export const REQUIRED_CLASS_DAYS = 4;

/** Half-hour slots, matching the rest of the cohort UI. */
function timeSlots(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) for (const m of ["00", "30"]) out.push(`${String(h).padStart(2, "0")}:${m}`);
  return out;
}

const fmt = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

const DEFAULT_TIMES = { class1Time: "20:00", class2Time: "21:30" };

/** The minimum gap the server enforces between the two classes, in minutes. */
const MIN_GAP_MIN = 60;
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
/**
 * Core Skills must come after the lecture, by at least the minimum gap. Measured
 * forward only — both classes run on the same calendar date, so a pair like
 * 23:00 / 00:30 is not "90 minutes later", it is 22.5 hours earlier.
 * Mirrors the server, which enforces the same rule.
 */
export function classPairProblem(class1: string, class2: string): string | null {
  const gap = minutesOf(class2) - minutesOf(class1);
  if (gap <= 0) return "Core Skills must start after the lecture — both classes run on the same day.";
  if (gap < MIN_GAP_MIN) return "Keep at least 1 hour between the two classes.";
  return null;
}

export type ClassDayPickerProps = {
  value: CohortClassDay[];
  onChange: (days: CohortClassDay[]) => void;
  /** Shown above the grid. Omit for the compact settings variant. */
  compact?: boolean;
};

export function ClassDayPicker({ value, onChange, compact = false }: ClassDayPickerProps) {
  // Remembers the times a day had before it was unticked, so a mis-click does
  // not throw the times away.
  const [remembered, setRemembered] = useState<Record<number, { class1Time: string; class2Time: string }>>({});

  const byWeekday = useMemo(() => new Map(value.map((d) => [d.weekday, d])), [value]);
  const chosen = value.length;
  const remaining = REQUIRED_CLASS_DAYS - chosen;

  const toggle = (weekday: number) => {
    const current = byWeekday.get(weekday);
    if (current) {
      setRemembered((r) => ({ ...r, [weekday]: { class1Time: current.class1Time, class2Time: current.class2Time } }));
      onChange(value.filter((d) => d.weekday !== weekday));
      return;
    }
    if (chosen >= REQUIRED_CLASS_DAYS) return; // the button label explains why
    const times = remembered[weekday] ?? lastUsedTimes(value) ?? DEFAULT_TIMES;
    onChange([...value, { weekday, ...times }].sort(byWeekOrder));
  };

  const setTime = (weekday: number, field: "class1Time" | "class2Time", time: string) => {
    onChange(value.map((d) => (d.weekday === weekday ? { ...d, [field]: time } : d)));
  };

  const slots = timeSlots();

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-sm leading-relaxed text-slate-700">
          📅 Pick the <b>{REQUIRED_CLASS_DAYS} days a week</b> you can show up. Your lectures run in
          order across the days you choose — Day 1 on your first class day, Day 2 on the next — so
          you never miss content, you just set the pace.
        </div>
      )}

      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Your class days">
          {WEEKDAYS.map((d) => {
            const on = byWeekday.has(d.value);
            const full = !on && chosen >= REQUIRED_CLASS_DAYS;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggle(d.value)}
                aria-pressed={on}
                disabled={full}
                title={full ? `You already have ${REQUIRED_CLASS_DAYS} days — remove one first` : undefined}
                // Inline, not Tailwind: the portal shell resets
                // `.oethq-portal button` to no border, no background and
                // inherited colour, which outranks utility classes and would
                // leave every day looking identical to every other.
                style={{
                  // 44x44 is the smallest reliably tappable target on a phone;
                  // at the previous size these came out 34px tall and the seven
                  // of them sit close together.
                  minWidth: 56, minHeight: 44, padding: "10px 16px", borderRadius: 12,
                  fontSize: 14, fontWeight: 700, lineHeight: 1.2,
                  cursor: full ? "not-allowed" : "pointer",
                  transition: "background .15s, border-color .15s, color .15s",
                  border: `1px solid ${on ? "#1D4ED8" : full ? "#E5EAF2" : "#CBD5E1"}`,
                  background: on ? "#1D4ED8" : full ? "#F6F8FB" : "#FFFFFF",
                  color: on ? "#FFFFFF" : full ? "#98A5B8" : "#33415B",
                  boxShadow: on ? "0 1px 2px rgba(16,42,90,.18)" : "none"
                }}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        <p className={`mt-2 text-xs font-medium ${remaining === 0 ? "text-emerald-700" : "text-slate-500"}`}>
          {remaining === 0
            ? `All ${REQUIRED_CLASS_DAYS} class days chosen — tap one to drop it and pick another.`
            : `Choose ${remaining} more ${remaining === 1 ? "day" : "days"}.`}
        </p>
      </div>

      {value.length > 0 && (
        <div className="space-y-2.5">
          {[...value].sort(byWeekOrder).map((d) => {
            const problem = classPairProblem(d.class1Time, d.class2Time);
            return (
              <div key={d.weekday} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="min-w-[84px] text-sm font-bold text-slate-800">
                    {WEEKDAYS.find((w) => w.value === d.weekday)?.label}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    🎓 Lecture
                    <select
                      value={d.class1Time}
                      onChange={(e) => setTime(d.weekday, "class1Time", e.target.value)}
                      aria-label={`Lecture time on ${WEEKDAYS.find((w) => w.value === d.weekday)?.label}`}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      {slots.map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    🧠 Core Skills
                    <select
                      value={d.class2Time}
                      onChange={(e) => setTime(d.weekday, "class2Time", e.target.value)}
                      aria-label={`Core Skills time on ${WEEKDAYS.find((w) => w.value === d.weekday)?.label}`}
                      className={`rounded-lg border px-2 py-1.5 text-sm font-medium text-slate-800 focus:outline-none ${
                        problem ? "border-rose-400 bg-rose-50" : "border-slate-300 focus:border-blue-500"
                      }`}
                    >
                      {slots.map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
                    </select>
                  </label>
                </div>
                {problem && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{problem}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Monday-first ordering for display; Sunday sorts last. */
const byWeekOrder = (a: CohortClassDay, b: CohortClassDay) =>
  WEEKDAYS.findIndex((w) => w.value === a.weekday) - WEEKDAYS.findIndex((w) => w.value === b.weekday);

/** Reuse the times already set, so picking four days is four clicks, not twelve. */
function lastUsedTimes(days: CohortClassDay[]) {
  const last = days[days.length - 1];
  return last ? { class1Time: last.class1Time, class2Time: last.class2Time } : null;
}

/** True when the selection is complete and every gap is legal. */
export function classDaysReady(days: CohortClassDay[]): boolean {
  return days.length === REQUIRED_CLASS_DAYS && days.every((d) => !classPairProblem(d.class1Time, d.class2Time));
}

/** "Mon · Wed · Fri · Sat", in week order. */
export function classDayLabel(days: CohortClassDay[]): string {
  return [...days].sort(byWeekOrder).map((d) => WEEKDAYS.find((w) => w.value === d.weekday)?.short).join(" · ");
}

/**
 * One line describing a student's schedule, for the summary strip.
 *
 * A picker student's `class1Time`/`class2Time` are unused placeholders, so
 * reading them there would show times they never chose. Their real times live
 * per day — collapsed to one pair when all four match, and called out as
 * varying when they do not.
 */
export function scheduleSummary(schedule: {
  mode: string; classDays?: CohortClassDay[]; class1Time: string; class2Time: string;
}): string {
  if (schedule.mode !== "PICK_FOUR" || !schedule.classDays?.length) {
    return `Lecture ${fmt(schedule.class1Time)} · Core Skills ${fmt(schedule.class2Time)}`;
  }
  const days = schedule.classDays;
  const uniform = days.every((d) => d.class1Time === days[0].class1Time && d.class2Time === days[0].class2Time);
  return uniform
    ? `${classDayLabel(days)} · ${fmt(days[0].class1Time)} & ${fmt(days[0].class2Time)}`
    : `${classDayLabel(days)} · times vary by day`;
}
