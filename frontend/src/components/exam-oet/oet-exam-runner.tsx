"use client";

/**
 * OetExamRunner — owns the lifecycle for a contentJson-driven OET test:
 * starts/resumes the attempt, debounce-autosaves answers, submits for official
 * OET grading, and swaps in the skill-specific results screen. The skill exam
 * screens (owned flow + timers + nav + highlighting) are rendered by
 * OetReadingExam / OetListeningExam against the shared contract.
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

export function OetExamRunner({ testId, playable }: { testId: string; playable: OetPlayable }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<OetResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAnswers = useRef<Record<string, string>>({});

  const begin = useCallback(async () => {
    setPhase("starting");
    setErrorMsg(null);
    try {
      const res = await oetTestsApi.start(testId);
      setAttemptId(res.attemptId);
      setInitialAnswers(res.answers ?? {});
      latestAnswers.current = res.answers ?? {};
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
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void oetTestsApi.saveProgress(attemptId, answers).catch(() => {});
      }, 1200);
    },
    [attemptId]
  );

  const handleSubmit = useCallback(
    async (answers: Record<string, string>) => {
      if (!attemptId) return;
      setPhase("submitting");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      try {
        const res = await oetTestsApi.submit(attemptId, answers, false);
        setResult(res);
        setPhase("results");
        window.scrollTo({ top: 0 });
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Could not submit the test");
        setPhase("error");
      }
    },
    [attemptId]
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
