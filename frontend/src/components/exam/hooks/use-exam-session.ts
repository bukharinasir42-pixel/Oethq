"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
  getFirstQuestionIndexForListeningPage,
  getListeningPageForQuestionSequence,
  getListeningPageForTrackIndex,
  LISTENING_QUESTION_PAGE_COUNT
} from "@/lib/test-question-templates";
import {
  getPartBExtractIds,
  getPartCExtractIds,
  getQuestionsInReadingPartCExtract,
  getReadingPartBCDeadlineIso,
  getReadingPartBCEarlyDeadlineIso
} from "@/components/exam/exam-utils";
import {
  clearLocalExamProgress,
  readLocalExamProgress,
  writeLocalExamProgress
} from "@/components/exam/local-exam-progress";
import { resolveReadingPartCExtractIdForQuestion } from "@/lib/reading-part-c-booklets";
import type { ListeningTrackDto, RetainedResultDto, TestAttemptDto, TestDetailDto, TestQuestionDto } from "@/lib/types";

type RunnerResponse = {
  retainedResult: RetainedResultDto;
  attempt: TestAttemptDto;
};

export type ExamSession = {
  audioRef: React.RefObject<HTMLAudioElement>;
  attempt: TestAttemptDto;
  test: TestDetailDto;
  questions: TestQuestionDto[];
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQuestion: TestQuestionDto;
  timeRemainingSeconds: number;
  sectionRemainingSeconds: number | null;
  /** True once Reading Part A's 15-minute window has ended — Part A is not editable. */
  isPartALocked: boolean;
  audioPositionSeconds: number;
  audioDurationSeconds: number;
  setAudioDurationSeconds: React.Dispatch<React.SetStateAction<number>>;
  setAudioPositionSeconds: React.Dispatch<React.SetStateAction<number>>;
  audioStarted: boolean;
  audioCompleted: boolean;
  section: string;
  saving: boolean;
  submitting: boolean;
  result: RetainedResultDto | null;
  listeningTracks: ListeningTrackDto[];
  listeningTrackIndex: number;
  listeningPageIndex: number;
  listeningPageCount: number;
  currentListeningTrack: ListeningTrackDto | null;
  listeningFinalCountdownEndsAt: string | null;
  postAudioSecondsLeft: number | null;
  answeredCount: number;
  saveProgress: (opts?: { keepalive?: boolean; silent?: boolean }) => Promise<void>;
  submitAttempt: (autoSubmit?: boolean) => Promise<void>;
  /** Lock Part A now and start the shared Parts B & C timer. */
  finishPartAEarly: () => Promise<void>;
  onListeningAudioEnded: () => Promise<void>;
  startAudio: () => Promise<void>;
  onAudioPlaybackFailed: () => void;
  goNext: () => void;
  goPrevious: () => void;
  canJumpToQuestion: (targetIndex: number) => boolean;
  canJumpToPart: (part: string) => boolean;
  jumpToPart: (part: string) => void;
  partCExtractIds: string[];
  activePartCExtractId: string | null;
  partCQuestionsInExtract: TestQuestionDto[];
  partBExtractIds: string[];
  activePartBExtractId: string | null;
};

type UseExamSessionArgs = {
  token: string;
  testId: string;
};

function waitForAudioReady(element: HTMLAudioElement) {
  if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Audio failed to load"));
    };
    const cleanup = () => {
      element.removeEventListener("canplay", onReady);
      element.removeEventListener("error", onError);
    };
    element.addEventListener("canplay", onReady);
    element.addEventListener("error", onError);
  });
}

export function useExamSession({ token, testId }: UseExamSessionArgs) {
  const audioRef = useRef<HTMLAudioElement>(null!);
  const listeningAutoStartTrackRef = useRef<string | null>(null);
  const startAudioRef = useRef<() => Promise<void>>(null!);
  const partALockTransitionRef = useRef(false);
  const skipListeningTrackSyncRef = useRef(false);
  const saveProgressRef = useRef<(opts?: { keepalive?: boolean; silent?: boolean }) => Promise<void>>(
    async () => undefined
  );
  const [attempt, setAttempt] = useState<TestAttemptDto | null>(null);
  const [test, setTest] = useState<TestDetailDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(0);
  const [sectionRemainingSeconds, setSectionRemainingSeconds] = useState<number | null>(null);
  const [audioPositionSeconds, setAudioPositionSeconds] = useState(0);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(0);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioCompleted, setAudioCompleted] = useState(false);
  const [section, setSection] = useState("");
  const [sectionEndsAt, setSectionEndsAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RetainedResultDto | null>(null);
  const [listeningTrackIndex, setListeningTrackIndex] = useState(0);
  const [listeningPageIndex, setListeningPageIndex] = useState(0);
  const [listeningFinalCountdownEndsAt, setListeningFinalCountdownEndsAt] = useState<string | null>(null);
  const [postAudioSecondsLeft, setPostAudioSecondsLeft] = useState<number | null>(null);

  const questions = useMemo(() => test?.questions || [], [test]);
  const partAQuestionIds = useMemo(
    () => new Set(questions.filter((question) => question.part === "A").map((question) => question.id)),
    [questions]
  );
  const isPartALocked = useMemo(() => {
    if (test?.type !== "READING") return false;
    if (section === "READING_PART_BC") return true;
    if (section === "READING_PART_A" && sectionRemainingSeconds === 0 && sectionEndsAt) return true;
    return false;
  }, [section, sectionEndsAt, sectionRemainingSeconds, test?.type]);
  const listeningTracks = useMemo((): ListeningTrackDto[] => {
    if (!test || test.type !== "LISTENING") return [];
    const fromModel = (test.listeningTracks || []).filter((t) => t.asset?.signedUrl);
    if (fromModel.length > 0) return fromModel;
    if (test.audioAsset?.signedUrl) {
      return [
        {
          id: "legacy",
          sortOrder: 0,
          label: "Listening session",
          asset: test.audioAsset
        }
      ];
    }
    return [];
  }, [test]);
  const currentListeningTrack = listeningTracks[listeningTrackIndex] ?? null;
  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  const partBExtractIds = useMemo(() => getPartBExtractIds(questions), [questions]);

  const activePartBExtractId = useMemo(() => {
    if (currentQuestion?.part !== "B") return null;
    if (currentQuestion.extractId) return currentQuestion.extractId;
    if (currentQuestion.sequence >= 21 && currentQuestion.sequence <= 26) {
      return `reading-b-${currentQuestion.sequence - 20}`;
    }
    const partBQuestions = questions
      .filter((q) => q.part === "B")
      .sort((left, right) => left.sequence - right.sequence);
    const index = partBQuestions.findIndex((q) => q.id === currentQuestion.id);
    return partBExtractIds[index] || partBExtractIds[0] || null;
  }, [currentQuestion, partBExtractIds, questions]);

  const partCExtractIds = useMemo(() => getPartCExtractIds(questions), [questions]);

  const activePartCExtractId = useMemo(() => {
    if (currentQuestion?.part !== "C") return null;
    return resolveReadingPartCExtractIdForQuestion(currentQuestion);
  }, [currentQuestion]);

  const partCQuestionsInExtract = useMemo(() => {
    if (!activePartCExtractId) return [];
    return getQuestionsInReadingPartCExtract(questions, activePartCExtractId);
  }, [activePartCExtractId, questions]);

  const loadAttempt = useCallback(async () => {
    try {
      const [testResponse, currentAttempt] = await Promise.all([
        apiFetch<TestDetailDto>(`/tests/${testId}`, { token }),
        apiFetch<TestAttemptDto | null>(`/tests/${testId}/attempts/current`, { token })
      ]);

      const activeAttempt =
        currentAttempt ||
        (await apiFetch<TestAttemptDto>(`/tests/${testId}/attempts/start`, {
          method: "POST",
          token
        }));

      const local = readLocalExamProgress(testId);
      const localMatches = local?.attemptId === activeAttempt.id;
      const serverIndex = activeAttempt.currentQuestionIndex || 0;
      const restoredIndex =
        localMatches && typeof local.currentQuestionIndex === "number"
          ? Math.max(serverIndex, local.currentQuestionIndex)
          : serverIndex;
      const restoredSection =
        localMatches && local.section === "READING_PART_BC" && activeAttempt.section === "READING_PART_A"
          ? activeAttempt.section // server is source of truth for Part A lock
          : activeAttempt.section;
      const restoredTrack = localMatches
        ? Math.max(activeAttempt.currentListeningTrackIndex ?? 0, local.listeningTrackIndex ?? 0)
        : (activeAttempt.currentListeningTrackIndex ?? 0);

      setTest(testResponse);
      setAttempt(activeAttempt);
      setAnswers((activeAttempt.answersJson as Record<string, string>) || {});
      setCurrentQuestionIndex(restoredIndex);
      // Wall-clock timers — never restart from a full duration on refresh.
      setTimeRemainingSeconds(
        activeAttempt.expiresAt
          ? Math.max(0, Math.ceil((new Date(activeAttempt.expiresAt).getTime() - Date.now()) / 1000))
          : activeAttempt.timeRemainingSeconds || 0
      );
      setAudioPositionSeconds(activeAttempt.audioPositionSeconds || 0);
      setAudioCompleted(activeAttempt.audioCompleted);
      setSection(restoredSection);
      partALockTransitionRef.current = restoredSection === "READING_PART_BC";
      const sectionEnd =
        restoredSection === "READING_PART_BC"
          ? activeAttempt.sectionExpiresAt ||
            getReadingPartBCDeadlineIso(
              activeAttempt.startedAt,
              testResponse.partATimer,
              testResponse.partBCTimer
            )
          : activeAttempt.sectionExpiresAt || null;
      setSectionEndsAt(sectionEnd);
      setSectionRemainingSeconds(
        sectionEnd ? Math.max(0, Math.ceil((new Date(sectionEnd).getTime() - Date.now()) / 1000)) : null
      );
      setListeningTrackIndex(restoredTrack);
      const pageFromQuestion =
        testResponse.type === "LISTENING" && testResponse.questions?.[restoredIndex]
          ? getListeningPageForQuestionSequence(testResponse.questions[restoredIndex].sequence)
          : getListeningPageForTrackIndex(restoredTrack);
      const restoredPage =
        localMatches && typeof local.listeningPageIndex === "number"
          ? Math.max(pageFromQuestion, local.listeningPageIndex)
          : pageFromQuestion;
      setListeningPageIndex(restoredPage);
      skipListeningTrackSyncRef.current = true;
      setListeningFinalCountdownEndsAt(activeAttempt.listeningFinalCountdownEndsAt ?? null);

      writeLocalExamProgress({
        attemptId: activeAttempt.id,
        testId,
        currentQuestionIndex: restoredIndex,
        section: restoredSection,
        listeningPageIndex: restoredPage,
        listeningTrackIndex: restoredTrack,
        savedAt: Date.now()
      });
    } catch (caughtError: unknown) {
      setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load test attempt");
    }
  }, [testId, token]);

  useEffect(() => {
    void loadAttempt();
  }, [loadAttempt]);

  const saveProgress = useCallback(
    async (opts?: { keepalive?: boolean; silent?: boolean }) => {
      if (!attempt) return;
      if (!opts?.silent) setSaving(true);
      try {
        const response = await apiFetch<TestAttemptDto>(`/tests/attempts/${attempt.id}/progress`, {
          method: "PUT",
          token,
          keepalive: opts?.keepalive,
          body: {
            section,
            currentQuestionIndex,
            timeRemainingSeconds,
            audioPositionSeconds,
            audioCompleted,
            currentListeningTrackIndex: listeningTrackIndex,
            listeningFinalCountdownEndsAt: listeningFinalCountdownEndsAt ?? null,
            questionCountAnswered: Object.values(answers).filter(Boolean).length,
            answers: Object.entries(answers).map(([questionId, responseValue]) => ({
              questionId,
              response: responseValue
            }))
          }
        });
        if (opts?.keepalive) return;
        setAttempt(response);
        setSection(response.section);
        if (response.section === "READING_PART_BC" && section === "READING_PART_A") {
          setCurrentQuestionIndex(response.currentQuestionIndex ?? currentQuestionIndex);
          const serverAnswers = (response.answersJson as Record<string, string>) || {};
          setAnswers((previous) => {
            const merged = { ...previous, ...serverAnswers };
            for (const questionId of partAQuestionIds) {
              if (serverAnswers[questionId] !== undefined) {
                merged[questionId] = serverAnswers[questionId];
              }
            }
            return merged;
          });
        }
        // Keep wall-clock section deadline from server — never invent a fresh timer.
        setSectionEndsAt(response.sectionExpiresAt || null);
        setSectionRemainingSeconds(
          response.sectionExpiresAt
            ? Math.max(0, Math.ceil((new Date(response.sectionExpiresAt).getTime() - Date.now()) / 1000))
            : null
        );
        if (response.expiresAt) {
          setTimeRemainingSeconds(
            Math.max(0, Math.ceil((new Date(response.expiresAt).getTime() - Date.now()) / 1000))
          );
        }
        setListeningTrackIndex(response.currentListeningTrackIndex ?? listeningTrackIndex);
        setListeningFinalCountdownEndsAt(response.listeningFinalCountdownEndsAt ?? null);
        writeLocalExamProgress({
          attemptId: response.id,
          testId,
          currentQuestionIndex: response.currentQuestionIndex ?? currentQuestionIndex,
          section: response.section,
          listeningPageIndex,
          listeningTrackIndex: response.currentListeningTrackIndex ?? listeningTrackIndex,
          savedAt: Date.now()
        });
      } catch (caughtError: unknown) {
        if (!opts?.silent && !opts?.keepalive) {
          toast.error(caughtError instanceof Error ? caughtError.message : "Auto-save failed");
        }
      } finally {
        if (!opts?.silent) setSaving(false);
      }
    },
    [
      answers,
      attempt,
      audioCompleted,
      audioPositionSeconds,
      currentQuestionIndex,
      listeningFinalCountdownEndsAt,
      listeningPageIndex,
      listeningTrackIndex,
      partAQuestionIds,
      section,
      testId,
      timeRemainingSeconds,
      token
    ]
  );

  saveProgressRef.current = saveProgress;

  useEffect(() => {
    if (!attempt || result) return;
    const tick = () => {
      setTimeRemainingSeconds((current) => {
        if (attempt.expiresAt) {
          return Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
        }
        return current > 0 ? current - 1 : 0;
      });
      setSectionRemainingSeconds(
        sectionEndsAt ? Math.max(0, Math.ceil((new Date(sectionEndsAt).getTime() - Date.now()) / 1000)) : null
      );
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [attempt, result, sectionEndsAt]);

  // Persist position locally immediately so refresh can restore even before the network save lands.
  useEffect(() => {
    if (!attempt || result) return;
    writeLocalExamProgress({
      attemptId: attempt.id,
      testId,
      currentQuestionIndex,
      section,
      listeningPageIndex,
      listeningTrackIndex,
      savedAt: Date.now()
    });
  }, [
    attempt,
    currentQuestionIndex,
    listeningPageIndex,
    listeningTrackIndex,
    result,
    section,
    testId
  ]);

  // Debounced server save when the candidate moves or answers.
  useEffect(() => {
    if (!attempt || result) return;
    const timer = window.setTimeout(() => {
      void saveProgressRef.current({ silent: true });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [
    answers,
    attempt,
    currentQuestionIndex,
    listeningPageIndex,
    listeningTrackIndex,
    result,
    section
  ]);

  useEffect(() => {
    if (!attempt || result) return;
    const autosave = window.setInterval(() => {
      void saveProgressRef.current({ silent: true });
    }, 15000);
    const flush = () => {
      void saveProgressRef.current({ keepalive: true, silent: true });
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.clearInterval(autosave);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [attempt, result]);

  const submitAttempt = useCallback(
    async (autoSubmit = false) => {
      if (!attempt) return;
      setSubmitting(true);
      try {
        const response = await apiFetch<RunnerResponse>(`/tests/attempts/${attempt.id}/submit`, {
          method: "POST",
          token,
          body: {
            section,
            currentQuestionIndex,
            timeRemainingSeconds,
            audioPositionSeconds,
            audioCompleted,
            autoSubmit,
            currentListeningTrackIndex: listeningTrackIndex,
            listeningFinalCountdownEndsAt: null,
            questionCountAnswered: answeredCount,
            answers: Object.entries(answers).map(([questionId, responseValue]) => ({
              questionId,
              response: responseValue
            }))
          }
        });
        setAttempt(response.attempt);
        setResult(response.retainedResult);
        clearLocalExamProgress(testId);
        toast.success(autoSubmit ? "Time expired. Attempt auto-submitted." : "Attempt submitted.");
      } catch (caughtError: unknown) {
        toast.error(caughtError instanceof Error ? caughtError.message : "Failed to submit attempt");
      } finally {
        setSubmitting(false);
      }
    },
    [
      answeredCount,
      answers,
      attempt,
      audioCompleted,
      audioPositionSeconds,
      currentQuestionIndex,
      listeningTrackIndex,
      section,
      testId,
      timeRemainingSeconds,
      token
    ]
  );

  const pushListeningProgress = useCallback(
    async (opts: {
      nextTrackIndex: number;
      nextAudioPosition: number;
      nextAudioCompleted: boolean;
      nextDeadline: string | null;
    }) => {
      if (!attempt) return;
      setSaving(true);
      try {
        const response = await apiFetch<TestAttemptDto>(`/tests/attempts/${attempt.id}/progress`, {
          method: "PUT",
          token,
          body: {
            section,
            currentQuestionIndex,
            timeRemainingSeconds,
            audioPositionSeconds: opts.nextAudioPosition,
            audioCompleted: opts.nextAudioCompleted,
            currentListeningTrackIndex: opts.nextTrackIndex,
            listeningFinalCountdownEndsAt: opts.nextDeadline,
            questionCountAnswered: Object.values(answers).filter(Boolean).length,
            answers: Object.entries(answers).map(([questionId, responseValue]) => ({
              questionId,
              response: responseValue
            }))
          }
        });
        setAttempt(response);
        setSectionEndsAt(response.sectionExpiresAt || null);
        setSectionRemainingSeconds(
          response.sectionExpiresAt
            ? Math.max(0, Math.ceil((new Date(response.sectionExpiresAt).getTime() - Date.now()) / 1000))
            : null
        );
        setListeningTrackIndex(response.currentListeningTrackIndex ?? 0);
        setListeningFinalCountdownEndsAt(response.listeningFinalCountdownEndsAt ?? null);
        setAudioPositionSeconds(response.audioPositionSeconds || 0);
        setAudioCompleted(response.audioCompleted);
        setAudioStarted(false);
      } catch (caughtError: unknown) {
        toast.error(caughtError instanceof Error ? caughtError.message : "Could not save listening progress");
      } finally {
        setSaving(false);
      }
    },
    [answers, attempt, currentQuestionIndex, section, timeRemainingSeconds, token]
  );

  const onListeningAudioEnded = useCallback(async () => {
    if (!attempt || test?.type !== "LISTENING") return;
    const n = listeningTracks.length;
    const idx = listeningTrackIndex;
    if (n === 0) return;
    setAudioStarted(false);
    if (idx >= n - 1) {
      const ends = new Date(Date.now() + 10_000).toISOString();
      await pushListeningProgress({
        nextTrackIndex: idx,
        nextAudioPosition: audioPositionSeconds,
        nextAudioCompleted: true,
        nextDeadline: ends
      });
    } else {
      await pushListeningProgress({
        nextTrackIndex: idx + 1,
        nextAudioPosition: 0,
        nextAudioCompleted: false,
        nextDeadline: null
      });
    }
  }, [
    attempt,
    audioPositionSeconds,
    listeningTrackIndex,
    listeningTracks.length,
    pushListeningProgress,
    test?.type
  ]);

  const submitAttemptRef = useRef(submitAttempt);
  submitAttemptRef.current = submitAttempt;

  const jumpToListeningPage = useCallback(
    (pageIndex: number) => {
      if (pageIndex < 0 || pageIndex >= LISTENING_QUESTION_PAGE_COUNT) return;
      setListeningPageIndex(pageIndex);
      const nextQuestionIndex = getFirstQuestionIndexForListeningPage(questions, pageIndex);
      if (nextQuestionIndex >= 0) {
        setCurrentQuestionIndex(nextQuestionIndex);
      }
    },
    [questions]
  );

  useEffect(() => {
    if (!test || test.type !== "LISTENING" || result) return;
    // Skip once after resume hydrate so track sync does not wipe the restored question index.
    if (skipListeningTrackSyncRef.current) {
      skipListeningTrackSyncRef.current = false;
      return;
    }
    const page = getListeningPageForTrackIndex(listeningTrackIndex);
    setListeningPageIndex((prev) => {
      if (prev === page) return prev;
      const nextIndex = getFirstQuestionIndexForListeningPage(questions, page);
      if (nextIndex >= 0) {
        setCurrentQuestionIndex(nextIndex);
      }
      return page;
    });
  }, [listeningTrackIndex, questions, result, test]);

  useEffect(() => {
    if (!test || test.type !== "LISTENING" || result || !currentQuestion) return;
    const pageForQuestion = getListeningPageForQuestionSequence(currentQuestion.sequence);
    setListeningPageIndex((prev) => (prev === pageForQuestion ? prev : pageForQuestion));
  }, [currentQuestion?.sequence, result, test]);

  useEffect(() => {
    if (!listeningFinalCountdownEndsAt) {
      setPostAudioSecondsLeft(null);
      return;
    }
    const endMs = new Date(listeningFinalCountdownEndsAt).getTime();
    const tick = () => setPostAudioSecondsLeft(Math.max(0, Math.ceil((endMs - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [listeningFinalCountdownEndsAt]);

  useEffect(() => {
    if (!listeningFinalCountdownEndsAt || result || test?.type !== "LISTENING") return;
    const endMs = new Date(listeningFinalCountdownEndsAt).getTime();
    const id = window.setInterval(() => {
      if (Date.now() >= endMs) {
        void submitAttemptRef.current(true);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [listeningFinalCountdownEndsAt, result, test?.type]);

  const transitionToPartBC = useCallback(
    async (opts: { early: boolean }) => {
      if (!attempt || !test || test.type !== "READING") return;
      if (section !== "READING_PART_A" || partALockTransitionRef.current) return;

      partALockTransitionRef.current = true;
      const firstNonPartAIndex = questions.findIndex((question) => question.part !== "A");
      const nextIndex = firstNonPartAIndex >= 0 ? firstNonPartAIndex : currentQuestionIndex;
      const nextEndIso = opts.early
        ? getReadingPartBCEarlyDeadlineIso(test.partBCTimer)
        : getReadingPartBCDeadlineIso(attempt.startedAt, test.partATimer, test.partBCTimer);
      const nextEndMs = new Date(nextEndIso).getTime();

      setSection("READING_PART_BC");
      setCurrentQuestionIndex(nextIndex);
      setSectionEndsAt(nextEndIso);
      setSectionRemainingSeconds(Math.max(0, Math.ceil((nextEndMs - Date.now()) / 1000)));
      if (opts.early) {
        setTimeRemainingSeconds(Math.max(0, Math.ceil((nextEndMs - Date.now()) / 1000)));
      }
      toast.message(opts.early ? "Part A finished" : "Part A time is up", {
        description: opts.early
          ? "Part A is locked. Your 45-minute Parts B & C timer has started."
          : "Part A is locked. You have 45 minutes for Parts B and C."
      });

      try {
        const response = await apiFetch<TestAttemptDto>(`/tests/attempts/${attempt.id}/progress`, {
          method: "PUT",
          token,
          body: {
            section: "READING_PART_BC",
            finishPartAEarly: opts.early,
            currentQuestionIndex: nextIndex,
            timeRemainingSeconds: opts.early
              ? Math.max(0, Math.ceil((nextEndMs - Date.now()) / 1000))
              : timeRemainingSeconds,
            audioPositionSeconds,
            audioCompleted,
            currentListeningTrackIndex: listeningTrackIndex,
            listeningFinalCountdownEndsAt: listeningFinalCountdownEndsAt ?? null,
            questionCountAnswered: Object.values(answers).filter(Boolean).length,
            answers: Object.entries(answers).map(([questionId, responseValue]) => ({
              questionId,
              response: responseValue
            }))
          }
        });
        setAttempt(response);
        setSection(response.section);
        setCurrentQuestionIndex(response.currentQuestionIndex ?? nextIndex);
        setAnswers((response.answersJson as Record<string, string>) || answers);
        const syncedEnd = response.sectionExpiresAt || nextEndIso;
        setSectionEndsAt(syncedEnd);
        setSectionRemainingSeconds(
          Math.max(0, Math.ceil((new Date(syncedEnd).getTime() - Date.now()) / 1000))
        );
        if (response.expiresAt) {
          setTimeRemainingSeconds(
            Math.max(0, Math.ceil((new Date(response.expiresAt).getTime() - Date.now()) / 1000))
          );
        }
      } catch (caughtError: unknown) {
        // Allow retry if the server rejected the transition.
        partALockTransitionRef.current = false;
        toast.error(caughtError instanceof Error ? caughtError.message : "Could not finish Part A");
      }
    },
    [
      answers,
      attempt,
      audioCompleted,
      audioPositionSeconds,
      currentQuestionIndex,
      listeningFinalCountdownEndsAt,
      listeningTrackIndex,
      questions,
      section,
      test,
      timeRemainingSeconds,
      token
    ]
  );

  const finishPartAEarly = useCallback(async () => {
    await transitionToPartBC({ early: true });
  }, [transitionToPartBC]);

  useEffect(() => {
    if (!attempt || result) return;
    if (timeRemainingSeconds === 0) {
      void submitAttempt(true);
      return;
    }
    if (
      test?.type !== "READING" ||
      section !== "READING_PART_A" ||
      !sectionEndsAt ||
      sectionRemainingSeconds !== 0 ||
      partALockTransitionRef.current
    ) {
      return;
    }
    void transitionToPartBC({ early: false });
  }, [
    attempt,
    result,
    section,
    sectionEndsAt,
    sectionRemainingSeconds,
    submitAttempt,
    test?.type,
    timeRemainingSeconds,
    transitionToPartBC
  ]);

  // Parts B & C: when the shared 45-minute section timer ends, auto-submit.
  useEffect(() => {
    if (!attempt || result || test?.type !== "READING") return;
    if (section !== "READING_PART_BC") return;
    if (sectionRemainingSeconds !== 0 || !sectionEndsAt) return;
    void submitAttempt(true);
  }, [attempt, result, section, sectionEndsAt, sectionRemainingSeconds, submitAttempt, test?.type]);

  const setAnswersGuarded: React.Dispatch<React.SetStateAction<Record<string, string>>> = useCallback(
    (update) => {
      setAnswers((previous) => {
        const next = typeof update === "function" ? update(previous) : update;
        if (!isPartALocked) return next;
        const frozen = { ...next };
        for (const questionId of partAQuestionIds) {
          if (previous[questionId] !== undefined) {
            frozen[questionId] = previous[questionId];
          } else {
            delete frozen[questionId];
          }
        }
        return frozen;
      });
    },
    [isPartALocked, partAQuestionIds]
  );

  const canJumpToQuestion = (targetIndex: number) => {
    const targetQuestion = questions[targetIndex];
    if (!targetQuestion || !currentQuestion || targetIndex < 0) return false;
    if (test?.type === "READING" && section === "READING_PART_A" && targetQuestion.part !== "A") return false;
    // After Part A expires, Part A stays locked — no return, no edits.
    if (test?.type === "READING" && isPartALocked && targetQuestion.part === "A") return false;
    if (test?.type === "READING" && section === "READING_PART_BC" && targetQuestion.part !== "A") return true;
    if (currentQuestion.part === "B" && targetIndex < currentQuestionIndex) return false;
    if (currentQuestion.part === "C" && targetQuestion.part === "B") return false;
    return true;
  };

  const getFirstQuestionIndexForPart = (part: string) => questions.findIndex((question) => question.part === part);

  const canJumpToPart = (part: string) => {
    const targetIndex = getFirstQuestionIndexForPart(part);
    if (targetIndex < 0) return false;
    return canJumpToQuestion(targetIndex);
  };

  const jumpToPart = (part: string) => {
    const targetIndex = getFirstQuestionIndexForPart(part);
    if (targetIndex >= 0 && canJumpToQuestion(targetIndex)) {
      setCurrentQuestionIndex(targetIndex);
    }
  };

  const goNext = () => {
    if (!currentQuestion) return;
    if (test?.type === "LISTENING") {
      if (listeningPageIndex >= LISTENING_QUESTION_PAGE_COUNT - 1) return;
      jumpToListeningPage(listeningPageIndex + 1);
      return;
    }
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= questions.length) return;
    if (!canJumpToQuestion(nextIndex)) return;
    setCurrentQuestionIndex(nextIndex);
  };

  const goPrevious = () => {
    if (!currentQuestion) return;
    if (test?.type === "LISTENING") {
      if (listeningPageIndex <= 0) return;
      jumpToListeningPage(listeningPageIndex - 1);
      return;
    }
    if (currentQuestionIndex === 0) return;
    const previousIndex = currentQuestionIndex - 1;
    if (!canJumpToQuestion(previousIndex)) return;
    setCurrentQuestionIndex(previousIndex);
  };

  const onAudioPlaybackFailed = useCallback(() => {
    setAudioStarted(false);
  }, []);

  const startAudio = useCallback(async () => {
    if (audioCompleted || audioStarted) return;
    const element = audioRef.current;
    if (!element) return;
    try {
      const resumeAt = Math.max(0, audioPositionSeconds);
      if (Math.abs(element.currentTime - resumeAt) > 0.25) {
        element.currentTime = resumeAt;
      }
      await waitForAudioReady(element);
      await element.play();
      setAudioStarted(true);
    } catch (caughtError) {
      setAudioStarted(false);
      const message = caughtError instanceof Error ? caughtError.message : "Unable to start audio playback";
      if (message.toLowerCase().includes("interact") || message.toLowerCase().includes("gesture")) {
        toast.error("Click anywhere to start the audio playback.");
        const playOnInteraction = () => {
          void startAudioRef.current();
          document.removeEventListener("click", playOnInteraction);
        };
        document.addEventListener("click", playOnInteraction);
      } else {
        toast.error(message);
      }
    }
  }, [audioCompleted, audioPositionSeconds, audioStarted]);

  startAudioRef.current = startAudio;

  useEffect(() => {
    if (!test || test.type !== "LISTENING" || result || audioCompleted || listeningFinalCountdownEndsAt) return;
    if (!currentListeningTrack?.asset?.signedUrl || audioStarted) return;

    const trackKey = `${listeningTrackIndex}-${currentListeningTrack.id}`;
    if (listeningAutoStartTrackRef.current === trackKey) return;

    let cancelled = false;
    let attempts = 0;

    const tryAutoStart = () => {
      if (cancelled || attempts >= 24) return;
      attempts += 1;
      if (!audioRef.current) {
        window.setTimeout(tryAutoStart, 100);
        return;
      }
      listeningAutoStartTrackRef.current = trackKey;
      void startAudio();
    };

    const timer = window.setTimeout(tryAutoStart, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    audioCompleted,
    audioStarted,
    currentListeningTrack?.asset?.signedUrl,
    currentListeningTrack?.id,
    listeningFinalCountdownEndsAt,
    listeningTrackIndex,
    result,
    startAudio,
    test
  ]);

  const session: ExamSession | null =
    attempt && test && currentQuestion
      ? {
          audioRef,
          attempt,
          test,
          questions,
          answers,
          setAnswers: setAnswersGuarded,
          currentQuestionIndex,
          setCurrentQuestionIndex,
          currentQuestion,
          timeRemainingSeconds,
          sectionRemainingSeconds,
          isPartALocked,
          audioPositionSeconds,
          audioDurationSeconds,
          setAudioDurationSeconds,
          setAudioPositionSeconds,
          audioStarted,
          audioCompleted,
          section,
          saving,
          submitting,
          result,
          listeningTracks,
          listeningTrackIndex,
          listeningPageIndex,
          listeningPageCount: LISTENING_QUESTION_PAGE_COUNT,
          currentListeningTrack,
          listeningFinalCountdownEndsAt,
          postAudioSecondsLeft,
          answeredCount,
          saveProgress,
          submitAttempt,
          finishPartAEarly,
          onListeningAudioEnded,
          startAudio,
          onAudioPlaybackFailed,
          goNext,
          goPrevious,
          canJumpToQuestion,
          canJumpToPart,
          jumpToPart,
          partCExtractIds,
          activePartCExtractId,
          partCQuestionsInExtract,
          partBExtractIds,
          activePartBExtractId
        }
      : null;

  return { loadError, session, result };
}
