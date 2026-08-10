import type { OetListeningImport, OetReadingImport } from "@/lib/oet-test-schema";
import type { OetResult } from "@/lib/oet-tests-api";

/**
 * Contract between the exam runner (owns load/attempt/autosave/submit) and the
 * skill-specific exam screens (own the flow, timers, nav, highlighting).
 * Answers are keyed by GLOBAL question number (1–42) as a string map.
 */
export type OetReadingExamProps = {
  content: OetReadingImport;
  initialAnswers: Record<string, string>;
  /** Called on every answer change so the runner can debounce-autosave. */
  onAnswersChange: (answers: Record<string, string>) => void;
  /** Final submit (manual or timer auto-submit). */
  onSubmit: (answers: Record<string, string>) => void;
  submitting: boolean;
  /**
   * Keys the student's highlights in local storage.
   *
   * The TEST id, not the attempt id: reloading mid-exam starts a fresh attempt,
   * so keying on the attempt would throw the marking away at exactly the moment
   * it is most wanted. Cleared on submit, so a later sitting starts clean.
   */
  highlightKey?: string | null;
};

export type OetListeningExamProps = {
  content: OetListeningImport;
  initialAnswers: Record<string, string>;
  onAnswersChange: (answers: Record<string, string>) => void;
  onSubmit: (answers: Record<string, string>) => void;
  submitting: boolean;
  /** Resolved session-audio URL (null when none attached to this test). */
  audioUrl?: string | null;
};

export type OetResultsProps = {
  result: OetResult;
  onRetake: () => void;
};
