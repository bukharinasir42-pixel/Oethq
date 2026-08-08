"use client";

/**
 * CohortClasses — the shared Cohort Live Classes experience.
 * Fully API-driven: no fake data, no simulation controls. State is
 * server-derived; renders only what /cohort/* returns.
 *
 * Used by BOTH the dedicated page (/portal/cohort, variant="page") and the
 * portal dashboard (variant="dashboard") so the dashboard's journey days and
 * lecture/core-skill videos behave identically to the live cohort classes —
 * same schedule-aware states, countdown, attendance, catch-up and chat.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  cohortApi, type AttendanceDashboard, type CohortChatMessage, type CohortClassDay, type CohortDay,
  type CohortMe, type CohortSession, type CohortSlot, type TimelineDay
} from "@/lib/cohort-api";
import {
  ClassDayPicker, classDaysReady, REQUIRED_CLASS_DAYS, scheduleSummary, WEEKDAYS
} from "./class-day-picker";
import { useOwnership, type SkillKey } from "@/hooks/use-ownership";
import { SkillUpgradeModal } from "@/components/portal/skill-upgrade-modal";

// ---------- small helpers ----------
const COUNTRIES = ["Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bahrain","Bangladesh","Belgium","Brazil","Bulgaria","Cambodia","Cameroon","Canada","Chile","China","Colombia","Croatia","Cyprus","Czech Republic","Denmark","Egypt","Estonia","Ethiopia","Fiji","Finland","France","Georgia","Germany","Ghana","Greece","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Latvia","Lebanon","Libya","Lithuania","Malaysia","Maldives","Malta","Mauritius","Mexico","Morocco","Myanmar","Nepal","Netherlands","New Zealand","Nigeria","Norway","Oman","Pakistan","Palestine","Panama","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria","Taiwan","Tanzania","Thailand","Tunisia","Turkey","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uzbekistan","Vietnam","Yemen","Zambia","Zimbabwe"];

const TZ_HINT: Record<string, string> = {
  Pakistan: "Asia/Karachi", India: "Asia/Kolkata", "United Arab Emirates": "Asia/Dubai",
  "Saudi Arabia": "Asia/Riyadh", "United Kingdom": "Europe/London",
  "United States": "America/New_York", Australia: "Australia/Sydney",
  Philippines: "Asia/Manila", Nigeria: "Africa/Lagos", Bangladesh: "Asia/Dhaka",
  Nepal: "Asia/Kathmandu", "Sri Lanka": "Asia/Colombo", Egypt: "Africa/Cairo",
  "South Africa": "Africa/Johannesburg", Canada: "America/Toronto",
  Ireland: "Europe/Dublin", "New Zealand": "Pacific/Auckland",
  Qatar: "Asia/Qatar", Kuwait: "Asia/Kuwait", Oman: "Asia/Muscat",
  Malaysia: "Asia/Kuala_Lumpur", Singapore: "Asia/Singapore",
  Germany: "Europe/Berlin", Kenya: "Africa/Nairobi"
};

function timeOptions(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
  return out;
}
const fmtHHMM = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};

function Countdown({ targetIso }: { targetIso: string }) {
  const [left, setLeft] = useState(() => new Date(targetIso).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(targetIso).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetIso]);
  if (left <= 0) return <span className="text-sm font-semibold text-emerald-600">Starting…</span>;
  const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
  return (
    <div className="flex gap-2" role="timer" aria-live="polite" aria-label={`Starts in ${h} hours ${m} minutes`}>
      {[[h, "hrs"], [m, "min"], [s, "sec"]].map(([n, l]) => (
        <div key={l as string} className="w-14 rounded-lg border border-slate-200 bg-white py-1.5 text-center">
          <div className="font-bold text-blue-800">{String(n).padStart(2, "0")}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">{l}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- live class chat ----------
const CHAT_POLL_MS = 4000;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function isInstructor(role: string): boolean {
  return role === "ADMIN" || role === "STAFF";
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function ChatPanel({ day, slot, live }: { day: number; slot: CohortSlot; live: boolean }) {
  const [messages, setMessages] = useState<CohortChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastIsoRef = useRef<string | undefined>(undefined);
  const atBottomRef = useRef(true);
  const seenRef = useRef<Set<string>>(new Set());

  const merge = useCallback((incoming: CohortChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const next = [...prev];
      for (const m of incoming) {
        if (seenRef.current.has(m.id)) continue;
        seenRef.current.add(m.id);
        next.push(m);
      }
      if (next.length) lastIsoRef.current = next[next.length - 1].createdAtUtc;
      return next;
    });
  }, []);

  // Poll: full load once, then incremental by timestamp.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await cohortApi.chat(day, slot, lastIsoRef.current);
        if (!active) return;
        merge(res.messages);
        setError("");
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Chat unavailable");
      } finally {
        if (active) setLoaded(true);
      }
    };
    void tick();
    const t = setInterval(tick, CHAT_POLL_MS);
    return () => { active = false; clearInterval(t); };
  }, [day, slot, merge]);

  // Auto-scroll to newest only when the reader is already at the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setError("");
    try {
      const msg = await cohortApi.sendChat(day, slot, text);
      merge([msg]);
      setInput("");
      atBottomRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally { setSending(false); }
  };

  return (
    <div className="flex h-[340px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:h-auto">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`relative flex h-2.5 w-2.5 ${live ? "" : "opacity-40"}`}>
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live ? "bg-emerald-500" : "bg-slate-400"}`} />
          </span>
          <h3 className="text-sm font-bold text-slate-800">{live ? "Live Class Chat" : "Class Chat"}</h3>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{messages.length} message{messages.length === 1 ? "" : "s"}</span>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {!loaded ? (
          <p className="mt-6 text-center text-xs text-slate-400">Loading chat…</p>
        ) : messages.length === 0 ? (
          <div className="mt-8 text-center">
            <div className="text-2xl" aria-hidden>💬</div>
            <p className="mt-1 text-xs text-slate-500">Be the first to say hello. Ask questions here during the class.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-2.5 ${m.mine ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                isInstructor(m.role) ? "bg-gradient-to-br from-amber-500 to-orange-600" : m.mine ? "bg-blue-600" : "bg-slate-400"
              }`} aria-hidden>{initials(m.authorName)}</div>
              <div className={`min-w-0 max-w-[80%] ${m.mine ? "text-right" : ""}`}>
                <div className={`flex items-center gap-1.5 ${m.mine ? "justify-end" : ""}`}>
                  <span className="truncate text-xs font-semibold text-slate-700">{m.mine ? "You" : m.authorName}</span>
                  {isInstructor(m.role) && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">Instructor</span>
                  )}
                  <span className="text-[10px] text-slate-400">{relTime(m.createdAtUtc)}</span>
                </div>
                <div className={`mt-0.5 inline-block break-words rounded-2xl px-3 py-1.5 text-sm ${
                  m.mine ? "bg-blue-600 text-white" : isInstructor(m.role) ? "bg-amber-50 text-slate-800" : "bg-slate-100 text-slate-800"
                }`}>{m.text}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {error && <p role="alert" className="px-3 pb-1 text-[11px] font-medium text-rose-600">{error}</p>}

      <form
        className="flex items-center gap-2 border-t border-slate-100 p-2.5"
        onSubmit={(e) => { e.preventDefault(); void send(); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Message your class…"
          className="min-w-0 flex-1 rounded-full border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-40"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

// ---------- session card with real progress heartbeats ----------
export function SessionCard({
  day, session, onRefresh
}: { day: number; session: CohortSession; onRefresh: () => void }) {
  const [playing, setPlaying] = useState(false);
  const positionRef = useRef(session.resumePositionSec);
  const lastBeatRef = useRef(Date.now());

  // Throttled heartbeat every 30s while playing; flush on hide/unmount.
  useEffect(() => {
    if (!playing) return;
    const mode = session.state === "IN_PROGRESS" || session.state === "AVAILABLE" ? "live" : "recording";
    const beat = () => {
      const now = Date.now();
      const delta = Math.min(120, Math.round((now - lastBeatRef.current) / 1000));
      lastBeatRef.current = now;
      positionRef.current += delta;
      if (document.visibilityState === "visible") {
        void cohortApi.progress(day, session.slot, positionRef.current, delta, mode).catch(() => undefined);
      }
    };
    const t = setInterval(beat, 30000);
    const onHide = () => { if (document.visibilityState === "hidden") beat(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", beat);
    return () => {
      clearInterval(t); beat();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", beat);
    };
  }, [playing, day, session.slot, session.state]);

  const join = useCallback(async () => {
    if (session.state === "AVAILABLE" || session.state === "IN_PROGRESS") {
      await cohortApi.join(day, session.slot).catch(() => undefined);
    }
    lastBeatRef.current = Date.now();
    setPlaying(true);
    onRefresh();
  }, [day, session.slot, session.state, onRefresh]);

  const isLecture = session.slot === "LECTURE";
  const locked = ["LOCKED", "UPCOMING", "STARTING_SOON"].includes(session.state);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label={session.title}>
      <div className={`p-6 text-white ${isLecture ? "bg-gradient-to-r from-[#0A3060] to-[#1465C8]" : "bg-gradient-to-r from-[#0F4C9A] to-[#1E7FE0]"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">
            Day {day} · {isLecture ? "Class 1 of 2 · Daily Lecture" : "Class 2 of 2 · Core Skills Session"}
          </p>
          {session.earlyAccess && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              ⚡ Early access
            </span>
          )}
        </div>
        <h2 className="mt-2 text-xl font-extrabold leading-snug">{session.title}</h2>
        <p className="mt-1 text-sm opacity-85">Instructor: Dr Nasir Bukhari{session.durationMin ? ` · ${session.durationMin} min` : ""}</p>
        <p className="mt-3 text-xs opacity-90">🕐 {session.scheduledLocal} (your local time)</p>
      </div>

      <div className="p-6">
        {locked ? (
          <div className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
            <div className="text-2xl" aria-hidden>🕐</div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">
                {session.state === "LOCKED"
                  ? "This day hasn't opened yet."
                  : `Class starts at ${session.scheduledLocal.split(",").pop()?.trim() ?? session.scheduledLocal} — your chosen time.`}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                A reminder email arrives 30 minutes before. If you miss it, the recording plays right here, in this same place.
              </p>
            </div>
            {session.state !== "LOCKED" && <Countdown targetIso={session.scheduledAtUtc} />}
          </div>
        ) : playing ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="aspect-video overflow-hidden rounded-xl bg-slate-900 lg:col-span-2">
              {session.embedUrl ? (
                <iframe
                  src={session.embedUrl}
                  className="h-full w-full"
                  allow="autoplay; fullscreen; encrypted-media"
                  title={session.title}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-slate-300">
                  <span className="text-3xl" aria-hidden>🎥</span>
                  <p className="text-sm font-medium">
                    {session.state === "IN_PROGRESS" || session.state === "AVAILABLE"
                      ? "The live stream will appear here."
                      : "The recording will appear here."}
                  </p>
                  <p className="text-xs text-slate-400">Chat is live — say hello on the right.</p>
                </div>
              )}
            </div>
            <ChatPanel
              day={day}
              slot={session.slot}
              live={session.state === "IN_PROGRESS" || session.state === "AVAILABLE"}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-slate-50 p-8 text-center">
            {session.state === "COMPLETED" ? (
              <>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">✓ Session Completed</span>
                <button onClick={join} className="text-sm font-semibold text-blue-700 underline-offset-2 hover:underline">
                  Rewatch recording
                </button>
              </>
            ) : (
              <>
                {(session.state === "MISSED" || session.state === "RECORDING_AVAILABLE") && (
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                    Missed Session — recording available
                  </span>
                )}
                {session.watchPct > 0 && (
                  <p className="text-xs text-slate-500">Watched {session.watchPct}% · resumes automatically</p>
                )}
                <button
                  onClick={join}
                  className="transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  style={{ padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: "#1D4ED8", color: "#fff", border: "1px solid #1D4ED8",
                boxShadow: "0 2px 6px rgba(16,42,90,.22)", cursor: "pointer" }}
                >
                  {session.primaryAction} →
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- onboarding modal ----------
/**
 * `schedule` is whatever the student has saved so far. Someone who gave their
 * timezone but never picked their days — the state everyone lands in when the
 * day picker is introduced — resumes at step 2 with their country and timezone
 * already filled in, rather than being asked for them a second time.
 */
export function OnboardingModal({
  onDone, schedule
}: { onDone: () => void; schedule?: CohortMe["schedule"] }) {
  const hasTimezone = Boolean(schedule?.timezone);
  const [step, setStep] = useState<1 | 2>(hasTimezone ? 2 : 1);
  const [country, setCountry] = useState(schedule?.country ?? "");
  const [tz, setTz] = useState(schedule?.timezone ?? "");
  const [days, setDays] = useState<CohortClassDay[]>(schedule?.classDays ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const zones = useMemo(() => {
    try { return Intl.supportedValuesOf("timeZone"); } catch { return Object.values(TZ_HINT); }
  }, []);

  const next = async () => {
    setBusy(true); setError("");
    try {
      if (step === 1) {
        await cohortApi.saveTimezone(country, tz);
        setStep(2);
      } else {
        await cohortApi.saveClassDays(days);
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
         role="dialog" aria-modal="true" aria-labelledby="cohort-onboarding-title">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-[#0A3060] to-[#1465C8] p-7 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">
            {hasTimezone ? "Cohort setup" : `Step ${step} of 2 · Cohort setup`}
          </p>
          <h2 id="cohort-onboarding-title" className="mt-2 text-xl font-extrabold">
            {step === 1 ? "Where are you joining from?" : "Choose your class days"}
          </h2>
          <p className="mt-1 text-sm opacity-85">
            {step === 1
              ? "Every class runs in your local time — no timezone maths, ever."
              : `${REQUIRED_CLASS_DAYS} days a week, two classes on each. You choose which days and what time.`}
          </p>
        </div>
        <div className="space-y-4 p-7">
          {step === 1 ? (
            <>
              <label className="block text-sm font-semibold text-slate-800">
                Your country
                <select value={country}
                  onChange={(e) => { setCountry(e.target.value); setTz(TZ_HINT[e.target.value] ?? Intl.DateTimeFormat().resolvedOptions().timeZone); }}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Your timezone
                <select value={tz} onChange={(e) => setTz(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="">Select timezone…</option>
                  {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Auto-suggested from your country — change it if you live elsewhere.
                </span>
              </label>
            </>
          ) : (
            <>
              <ClassDayPicker value={days} onChange={setDays} />
              <p className="text-xs leading-relaxed text-slate-500">
                A reminder email arrives 30 minutes before each class. Missed classes stay
                available as recordings on the same day. You can change your days later —
                classes you have already had keep their dates.
              </p>
            </>
          )}
          {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}
          <div className="flex justify-between pt-1">
            {step === 2 && !hasTimezone ? (
              <button onClick={() => setStep(1)} className="transition"
              style={{ padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                background: "#fff", color: "#33415B", border: "1px solid #CBD5E1", cursor: "pointer" }}>← Back</button>
            ) : <span />}
            <button
              onClick={next}
              disabled={busy || (step === 1 ? !country || !tz : !classDaysReady(days))}
              className="transition disabled:opacity-40"
              style={{ padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: "#1D4ED8", color: "#fff", border: "1px solid #1D4ED8",
                boxShadow: "0 2px 6px rgba(16,42,90,.22)", cursor: "pointer" }}
            >
              {busy
                ? "Saving…"
                : step === 1
                  ? "Continue →"
                  : days.length === REQUIRED_CLASS_DAYS
                    ? "Save my schedule"
                    : `Pick ${REQUIRED_CLASS_DAYS - days.length} more`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- schedule settings (change class times / timezone after onboarding) ----------
export function ScheduleSettingsModal({
  schedule, onClose, onDone
}: { schedule: NonNullable<CohortMe["schedule"]>; onClose: () => void; onDone: () => void }) {
  const pickFour = schedule.mode === "PICK_FOUR";
  const [country, setCountry] = useState(schedule.country);
  const [tz, setTz] = useState(schedule.timezone);
  const [t1, setT1] = useState(schedule.class1Time);
  const [t2, setT2] = useState(schedule.class2Time);
  const [days, setDays] = useState<CohortClassDay[]>(schedule.classDays ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const zones = useMemo(() => {
    try { return Intl.supportedValuesOf("timeZone"); } catch { return Object.values(TZ_HINT); }
  }, []);

  const key = (list: CohortClassDay[]) =>
    [...list].sort((a, b) => a.weekday - b.weekday)
      .map((d) => `${d.weekday}:${d.class1Time}:${d.class2Time}`).join("|");
  const daysDirty = pickFour && key(days) !== key(schedule.classDays ?? []);
  const timesDirty = !pickFour && (t1 !== schedule.class1Time || t2 !== schedule.class2Time);
  const dirty = country !== schedule.country || tz !== schedule.timezone || daysDirty || timesDirty;
  const canSave = dirty && (!pickFour || classDaysReady(days));

  const save = async () => {
    setBusy(true); setError("");
    try {
      if (country !== schedule.country || tz !== schedule.timezone) {
        await cohortApi.saveTimezone(country, tz);
      }
      if (daysDirty) await cohortApi.saveClassDays(days);
      if (timesDirty) await cohortApi.saveSchedule(t1, t2);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes — please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
         role="dialog" aria-modal="true" aria-labelledby="cohort-settings-title">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-gradient-to-r from-[#0A3060] to-[#1465C8] p-7 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">Cohort settings</p>
            <h2 id="cohort-settings-title" className="mt-2 text-xl font-extrabold">Change your class schedule</h2>
            <p className="mt-1 text-sm opacity-85">
              {pickFour
                ? "Classes you have already had keep their dates — only what is still ahead of you moves. Sessions starting within the next 2 hours keep their current time."
                : "New times apply to every upcoming class. Sessions starting within the next 2 hours keep their current time."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white">✕</button>
        </div>
        <div className="space-y-4 p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Country
              <select value={country}
                onChange={(e) => { setCountry(e.target.value); setTz(TZ_HINT[e.target.value] ?? tz); }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Timezone
              <select value={tz} onChange={(e) => setTz(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                {!zones.includes(tz) && <option value={tz}>{tz.replace(/_/g, " ")}</option>}
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </select>
            </label>
          </div>
          {pickFour ? (
            <ClassDayPicker value={days} onChange={setDays} compact />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-800">
                  🎓 Class 1 — Daily Lecture
                  <select value={t1} onChange={(e) => setT1(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                    {timeOptions().map((t) => <option key={t} value={t}>{fmtHHMM(t)}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-800">
                  🧠 Class 2 — Core Skills
                  <select value={t2} onChange={(e) => setT2(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                    {timeOptions().map((t) => <option key={t} value={t}>{fmtHHMM(t)}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Keep at least 1 hour between the two classes. Your programme runs Monday–Saturday.
              </p>
            </>
          )}
          {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="transition"
              style={{ padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                background: "#fff", color: "#33415B", border: "1px solid #CBD5E1", cursor: "pointer" }}>Cancel</button>
            <button
              onClick={save}
              disabled={busy || !canSave}
              className="transition disabled:opacity-40"
              style={{ padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: "#1D4ED8", color: "#fff", border: "1px solid #1D4ED8",
                boxShadow: "0 2px 6px rgba(16,42,90,.22)", cursor: "pointer" }}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- shared experience (page + dashboard) ----------
export function CohortClasses({ variant = "page" }: { variant?: "page" | "dashboard" }) {
  const dashboardVariant = variant === "dashboard";
  const searchParams = useSearchParams();
  const [me, setMe] = useState<CohortMe | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [day, setDay] = useState<CohortDay | null>(null);
  const [dash, setDash] = useState<AttendanceDashboard | null>(null);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const { ownsSkill, loaded: ownershipLoaded } = useOwnership();
  const [lockedSkill, setLockedSkill] = useState<SkillKey | null>(null);

  const loadDay = useCallback(async (n?: number) => {
    try {
      if (n) setDay(await cohortApi.day(n));
      else {
        const t = await cohortApi.today();
        if (t.state === "ACTIVE") setDay(t as CohortDay);
        else setDay(null);
      }
    } catch { setDay(null); }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const meRes = await cohortApi.me();
      setMe(meRes);
      if (meRes.onboarded && meRes.schedule) {
        // Secondary panels are independent: one failing endpoint (e.g. a day with
        // no mapped content) must never blank the whole page.
        const [tl, pend, dashboard] = await Promise.all([
          cohortApi.days().catch(() => ({ days: [] })),
          cohortApi.pending().catch(() => ({ pendingCount: 0, days: [] })),
          cohortApi.attendance().catch(() => null)
        ]);
        setTimeline(tl.days); setPending(pend.pendingCount); setDash(dashboard);
        const paramDay = Number(searchParams.get("day"));
        await loadDay(Number.isInteger(paramDay) && paramDay > 0 ? paramDay : undefined);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your cohort. Please refresh.");
    } finally { setLoading(false); }
  }, [loadDay, searchParams]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const needsOnboarding = !loading && me && !me.onboarded;
  // Page auto-opens the onboarding modal; the dashboard shows an inline prompt
  // and only opens the modal on demand (never pop a modal on dashboard load).
  const onboardingModalOpen = Boolean((!dashboardVariant && needsOnboarding) || (dashboardVariant && showOnboard));

  if (loading) {
    return <div className={dashboardVariant ? "py-6 text-sm text-slate-500" : "p-10 text-sm text-slate-500"} aria-busy="true">Loading your cohort…</div>;
  }
  if (error) {
    return (
      <div className={dashboardVariant ? "rounded-2xl border border-rose-200 bg-rose-50 p-6" : "m-8 rounded-2xl border border-rose-200 bg-rose-50 p-6"}>
        <p className="font-semibold text-rose-700">Could not load Cohort Live Classes</p>
        <p className="mt-1 text-sm text-slate-600">{error}</p>
        <button onClick={() => void loadAll()} className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Try again</button>
      </div>
    );
  }

  return (
    <div className={dashboardVariant ? "space-y-4" : "mx-auto max-w-6xl px-4 pb-16 sm:px-6"}>
      {onboardingModalOpen && (
        <OnboardingModal schedule={me?.schedule} onDone={() => { setShowOnboard(false); void loadAll(); }} />
      )}

      {dashboardVariant ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-portal-display text-xl font-semibold tracking-tight text-[hsl(var(--primary-deep))]">
            Your live classes
          </h3>
          <div className="flex items-center gap-3">
            {me?.schedule && (
              <button
                onClick={() => setShowSettings(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                ✏️ {scheduleSummary(me.schedule)} — change
              </button>
            )}
            <a href="/portal/cohort" className="text-xs font-semibold text-primary hover:underline">Full view →</a>
          </div>
        </div>
      ) : (
        <header className="flex flex-wrap items-end justify-between gap-4 pt-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Cohort Live Classes</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              {me?.schedule?.mode === "PICK_FOUR"
                ? `Two classes on each of your ${REQUIRED_CLASS_DAYS} class days, at the times you chose, in your timezone.`
                : "Two classes every day at your chosen times, in your timezone."}{" "}
              Miss one? The recording plays right here, on the same day.
            </p>
          </div>
          {me?.schedule && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
              <div>
                <span className="font-semibold text-slate-800">Your schedule:</span>{" "}
                {scheduleSummary(me.schedule)}{" "}
                <span className="text-slate-400">({me.schedule.timezone.replace(/_/g, " ")})</span>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                ✏️ {me.schedule.mode === "PICK_FOUR" ? "Change class days or times" : "Change class times"}
              </button>
            </div>
          )}
        </header>
      )}

      {needsOnboarding && dashboardVariant && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center">
          <p className="text-2xl" aria-hidden>🎓</p>
          <p className="mt-1 font-semibold text-slate-800">Set up your live classes</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Pick your country, timezone and class times once. Your daily lecture and core-skills
            sessions then run right here — in your local time, with countdowns, recordings and catch-up.
          </p>
          <button
            onClick={() => setShowOnboard(true)}
            className="mt-3 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-800"
          >
            Set up now →
          </button>
        </div>
      )}

      {showSettings && me?.schedule && (
        <ScheduleSettingsModal
          schedule={me.schedule}
          onClose={() => setShowSettings(false)}
          onDone={() => { setShowSettings(false); void loadAll(); }}
        />
      )}

      <SkillUpgradeModal skill={lockedSkill} open={lockedSkill !== null} onOpenChange={(v) => { if (!v) setLockedSkill(null); }} />

      {/* Day timeline */}
      {timeline.length > 0 && (
        <nav aria-label="Programme days" className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {timeline.map((d) => {
            const active = day?.dayNumber === d.dayNumber;
            const tone =
              d.label === "Done" ? "text-emerald-600" :
              d.label === "Today" ? "text-orange-500" :
              d.label === "Catch-up" ? "text-rose-600" :
              d.label === "Available" ? "text-indigo-600" : "text-slate-400";
            return (
              <button
                key={d.dayNumber}
                onClick={() => void loadDay(d.dayNumber)}
                title={`${d.date} · ${d.title}`}
                className={`min-w-[64px] shrink-0 rounded-xl border px-2 py-2 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  active ? "border-blue-600 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-400"
                }`}
              >
                <div className="text-sm font-extrabold text-blue-800">{String(d.dayNumber).padStart(2, "0")}</div>
                <div className="text-[9px] font-semibold text-slate-500">{d.date.slice(5)}</div>
                <div className={`text-[9px] font-bold uppercase tracking-wide ${tone}`}>{d.label}</div>
              </button>
            );
          })}
        </nav>
      )}

      {pending > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <span aria-hidden>📌</span>
          <p className="text-sm text-slate-700">
            <b className="text-rose-700">Pending Catch-up:</b> {pending} incomplete day{pending > 1 ? "s" : ""}.
            Open a red day above to resume — recordings and tests stay available.
          </p>
        </div>
      )}

      {/* Sessions */}
      {day ? (
        <div className="mt-6 space-y-5">
          {day.sessions.map((s) => (
            <SessionCard key={s.slot} day={day.dayNumber} session={s} onRefresh={() => void loadDay(day.dayNumber)} />
          ))}

          {/* Assigned tests */}
          {day.tests.length > 0 && (
            <section aria-label="Today's Assigned Tests">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Today&apos;s Assigned Tests · Don&apos;t skip</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {day.tests.map((t) => {
                  const skillLocked = ownershipLoaded && !ownsSkill(t.type as SkillKey);
                  return (
                    <div key={t.testId} className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm ${skillLocked ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${skillLocked ? "bg-slate-100 grayscale" : "bg-blue-50"}`} aria-hidden>
                        {t.type === "READING" ? "📖" : "🎧"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-bold ${skillLocked ? "text-slate-500" : "text-slate-900"}`}>{t.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {skillLocked
                            ? `${t.type === "READING" ? "Reading" : "Listening"} not in your plan`
                            : `${t.status}${t.score !== null ? ` · ${t.score}${t.bandLabel ? ` (${t.bandLabel})` : ""}` : ""}`}
                        </p>
                      </div>
                      {skillLocked ? (
                        <button
                          type="button"
                          onClick={() => setLockedSkill(t.type as SkillKey)}
                          className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-400 hover:text-blue-700"
                        >
                          🔒 Upgrade
                        </button>
                      ) : (
                        <a
                          href={`/portal/tests/${encodeURIComponent(t.testId)}`}
                          className="shrink-0 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-800"
                        >
                          {t.action}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      ) : (
        me?.onboarded && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-slate-800">No active session today</p>
            <p className="mt-1 text-sm text-slate-500">
              Either your programme starts soon, or today is not one of your class days. Pick any open
              day above to review or catch up.
            </p>
            {(me?.schedule?.classDays?.length ?? 0) > 0 && (
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Your class days: {[...me!.schedule!.classDays]
                  .sort((a, b) => WEEKDAYS.findIndex((w) => w.value === a.weekday) - WEEKDAYS.findIndex((w) => w.value === b.weekday))
                  .map((d) => WEEKDAYS.find((w) => w.value === d.weekday)?.short)
                  .join(" · ")}
              </p>
            )}
          </div>
        )
      )}

      {/* Attendance & Accountability (full page only — the dashboard has its own stats) */}
      {dash && !dashboardVariant && (
        <section className="mt-10" aria-label="Attendance and Accountability">
          <h2 className="text-lg font-extrabold text-slate-900">Attendance &amp; Accountability</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Attendance", `${dash.attendanceRate}%`],
              ["Attended", String(dash.sessionsAttended)],
              ["Missed", String(dash.sessionsMissed)],
              ["Streak", `${dash.currentStreak}d${dash.currentStreak >= 3 ? " 🔥" : ""}`],
              ["Avg watch", `${dash.avgActiveWatchMin}m`]
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{k}</p>
                <p className="mt-1 text-xl font-extrabold text-blue-800">{v}</p>
              </div>
            ))}
          </div>

          {dash.log.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-xs">
                <caption className="sr-only">Class log with attendance and test scores</caption>
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                    {["Day", "Session", "Scheduled", "Joined", "Watch", "Attendance", "📖 Reading", "🎧 Listening"].map((h) => (
                      <th key={h} scope="col" className="border-b border-slate-100 px-4 py-3 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dash.log.map((r, i) => (
                    <tr key={i} className="border-b border-dashed border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-semibold">Day {r.dayNumber}</td>
                      <td className="px-4 py-3 text-slate-500">{r.slot === "LECTURE" ? "Daily Lecture" : "Core Skills"}</td>
                      <td className="px-4 py-3">{r.scheduledLocal}</td>
                      <td className="px-4 py-3">{r.firstJoinedLocal ?? "—"}</td>
                      <td className="px-4 py-3">{r.activeWatchMin}m</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          r.attendance === "ATTENDED" ? "bg-emerald-50 text-emerald-700" :
                          r.attendance === "LATE" ? "bg-amber-50 text-amber-700" :
                          r.attendance === "MISSED" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"
                        }`}>{r.attendance === "ATTENDED" ? "✓ Attended" : r.attendance === "MISSED" ? "✗ Missed" : r.attendance}</span>
                      </td>
                      {[r.reading, r.listening].map((t, j) => (
                        <td key={j} className="px-4 py-3">
                          {t === undefined ? "" : t === null || t.score === null
                            ? <span className="text-slate-400">—</span>
                            : <span className="font-bold text-emerald-700">✓ {t.score}{t.band ? ` ${t.band}` : ""}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
