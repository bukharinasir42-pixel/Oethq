"use client";

/**
 * OetExamRunner — owns the lifecycle for a contentJson-driven OET test:
 * starts/resumes the attempt, debounce-autosaves answers, submits for official
 * OET grading, and swaps in the skill-specific results screen. The skill exam
 * screens (owned flow + timers + nav + highlighting) are rendered by
 * OetReadingExam / OetListeningExam against the shared contract.
 *
 * Losing an attempt is the worst thing this component can do — 45 minutes of a
 * paying student's work — so three things protect it:
 *
 *  1. Answers are mirrored to localStorage on every keystroke, so nothing is
 *     ever only in memory or only on the server.
 *  2. Autosave failures are SURFACED, not swallowed. A session can now end
 *     mid-exam (the two-device cap evicts the least recently used device, and an
 *     admin can cancel access), which silently 401s every save. Without a
 *     warning the student writes for another half hour against a dead
 *     connection and only finds out when they submit.
 *  3. A failed submit keeps the exam mounted with the answers intact. It used to
 *     drop to an error screen whose "Try again" called begin(), which starts a
 *     FRESH attempt — turning a transient network failure into total data loss.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { OetReadingExam } from "@/components/exam-oet/reading/oet-reading-exam";
import { OetListeningExam } from "@/components/exam-oet/listening/oet-listening-exam";
import { OetReadingResults } from "@/components/exam-oet/reading/oet-reading-results";
import { OetListeningResults } from "@/components/exam-oet/listening/oet-listening-results";
import { ScreenshotGuard } from "@/components/exam/screenshot-guard";
import { oetTestsApi, type OetPlayable, type OetResult } from "@/lib/oet-tests-api";
import type { OetListeningImport, OetReadingImport } from "@/lib/oet-test-schema";

type Phase = "starting" | "exam" | "submitting" | "results" | "error";

/** Local mirror of an attempt's answers, so a dead connection cannot erase work. */
const backupKey = (attemptId: string) => `oet_attempt_${attemptId}`;

function readBackup(attemptId: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(backupKey(attemptId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

function writeBackup(attemptId: string, answers: Record<string, string>) {
  try {
    localStorage.setItem(backupKey(attemptId), JSON.stringify(answers));
  } catch {
    /* storage full or denied — the server save is still the primary path */
  }
}

function clearBackup(attemptId: string) {
  try {
    localStorage.removeItem(backupKey(attemptId));
  } catch {
    /* nothing to do */
  }
}

export function OetExamRunner({ testId, playable }: { testId: string; playable: OetPlayable }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<OetResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** Set when a submit fails. The exam stays mounted; this drives the retry bar. */
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** True once autosave has failed and not yet recovered. */
  const [saveFailing, setSaveFailing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAnswers = useRef<Record<string, string>>({});

  const begin = useCallback(async () => {
    setPhase("starting");
    setErrorMsg(null);
    setSubmitError(null);
    setSaveFailing(false);
    try {
      const res = await oetTestsApi.start(testId);
      // Prefer the local mirror when it holds more than the server does: that is
      // exactly the case where saves were failing and the student reloaded.
      const fromServer = res.answers ?? {};
      const local = readBackup(res.attemptId);
      const answers =
        local && Object.keys(local).length > Object.keys(fromServer).length ? local : fromServer;
      setAttemptId(res.attemptId);
      setInitialAnswers(answers);
      latestAnswers.current = answers;
      setResult(null);
      setPhase("exam");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not start the test");
      setPhase("error");
    }
  }, [testId]);

  useEffect(() => {
    void begin();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [begin]);

  const handleAnswersChange = useCallback(
    (answers: Record<string, string>) => {
      latestAnswers.current = answers;
      if (!attemptId) return;
      // Mirror locally first and synchronously — this must not depend on the
      // network, the debounce, or the tab staying open.
      writeBackup(attemptId, answers);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void oetTestsApi
          .saveProgress(attemptId, answers)
          .then(() => setSaveFailing(false))
          .catch(() => setSaveFailing(true));
      }, 1200);
    },
    [attemptId]
  );

  const submitAnswers = useCallback(
    async (answers: Record<string, string>) => {
      if (!attemptId) return;
      setPhase("submitting");
      setSubmitError(null);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      try {
        const res = await oetTestsApi.submit(attemptId, answers, false);
        clearBackup(attemptId);
        setResult(res);
        setPhase("results");
        window.scrollTo({ top: 0 });
      } catch (e) {
        // Back to the exam, NOT an error screen. Every answer is still on
        // screen and still mirrored locally; the student can retry.
        setSubmitError(e instanceof Error ? e.message : "Could not submit the test");
        setPhase("exam");
      }
    },
    [attemptId]
  );

  const handleSubmit = useCallback(
    (answers: Record<string, string>) => {
      latestAnswers.current = answers;
      void submitAnswers(answers);
    },
    [submitAnswers]
  );

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <p className="text-sm font-semibold text-rose-600">{errorMsg}</p>
        <button type="button" onClick={() => void begin()} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Try again
        </button>
      </div>
    );
  }

  if (phase === "starting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading your test…</div>
    );
  }

  if (phase === "results" && result) {
    return result.type === "READING" ? (
      <OetReadingResults result={result} onRetake={() => void begin()} />
    ) : (
      <OetListeningResults result={result} onRetake={() => void begin()} />
    );
  }

  const submitting = phase === "submitting";
  const isReading = playable.content.type === "READING";
  return (
    <>
      <ScreenshotGuard active context={isReading ? "oet-reading-test" : "oet-listening-test"} />

      {submitError ? (
        <div
          role="alert"
          style={{
            position: "fixed", insetInline: 0, top: 0, zIndex: 9999,
            background: "#B42318", color: "#fff", padding: "10px 14px",
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
            font: "600 13px/1.4 system-ui, sans-serif"
          }}
        >
          <span>{submitError} Your answers are safe on this device.</span>
          <button
            type="button"
            onClick={() => void submitAnswers(latestAnswers.current)}
            style={{
              marginInlineStart: "auto", background: "#fff", color: "#B42318",
              border: 0, borderRadius: 8, padding: "5px 12px", fontWeight: 700, cursor: "pointer"
            }}
          >
            Submit again
          </button>
        </div>
      ) : saveFailing ? (
        <div
          role="status"
          style={{
            position: "fixed", insetInline: 0, top: 0, zIndex: 9999,
            background: "#B45309", color: "#fff", padding: "9px 14px",
            font: "600 13px/1.4 system-ui, sans-serif", textAlign: "center"
          }}
        >
          Your answers are not reaching the server. They are saved on this device — keep this tab open and finish the test.
        </div>
      ) : null}

      {isReading ? (
        <OetReadingExam
          content={playable.content as OetReadingImport}
          initialAnswers={initialAnswers}
          onAnswersChange={handleAnswersChange}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      ) : (
        <OetListeningExam
          content={playable.content as OetListeningImport}
          initialAnswers={initialAnswers}
          onAnswersChange={handleAnswersChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          audioUrl={playable.test.audioUrl ?? null}
        />
      )}
    </>
  );
}
