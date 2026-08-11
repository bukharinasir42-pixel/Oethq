import { apiFetch } from "@/lib/api";

export type OptionVerdict = "correct" | "distractor" | "partial";

export type DistractorType =
  | "wrong_referent" | "adjacent_entity" | "partial_support" | "superseded"
  | "true_not_asked" | "lexical_lure" | "unstated_state" | "absolute_language"
  | "unlicensed_ranking" | "sufficiency_overclaim" | "function_mismatch"
  | "speaker_attribution" | "over_inference" | "direct_information"
  | "near_miss_form" | "not_stated";

/** One located quote. `loc` labels it for the student: "Text B", "¶3", "Email". */
export type EvidenceQuote = { loc: string | null; quote: string };

/** One row of the paraphrase mapping: the stem's wording, and the text's. */
export type BridgePair = { stem: string; text: string };

/** A near miss a short-answer item attracts, and why it scores nothing. */
export type CommonWrong = { wrote: string; why: string };

export type ExplanationOption = {
  verdict: OptionVerdict;
  trap?: DistractorType;
  /** The exact phrase in the option that breaks. Quoted back at the student. */
  fails?: string;
  why: string;
};

export type Explanation = {
  questionNumber: number;
  part: "A" | "B" | "C" | null;
  /** The primary quote. `evidenceQuotes` is what the screen renders. */
  evidence: string;
  evidenceLetter: string | null;
  evidenceQuotes: EvidenceQuote[];
  reasoning: string;
  bridge: BridgePair[] | null;
  commonWrong: CommonWrong[] | null;
  stemFocus: string | null;
  questionType: string | null;
  /** A readable name for the question type where the enum is too coarse. */
  typeLabel: string | null;
  difficulty: "C1" | "C2" | "C3" | null;
  counterfactual: string | null;
  lesson: string | null;
  skillTag: string | null;
  skillLabel: string | null;
  trapNote: string | null;
  note: string | null;
  options: Record<string, ExplanationOption> | null;
};

/**
 * What a student is told the trap was, in plain words.
 *
 * These are deliberately not the technical names. The audience is a nurse or a
 * doctor reading in a second language after a twelve-hour shift, and a category
 * they have to decode first is a category that teaches nothing. The technical
 * name stays in the data, where the analytics need it; only the display changes.
 */
export const TRAP_LABEL: Record<DistractorType, string> = {
  wrong_referent: "It swaps who does what",
  adjacent_entity: "It talks about the wrong thing",
  partial_support: "Half right, half wrong",
  superseded: "The text changes this later",
  true_not_asked: "True, but not the question",
  lexical_lure: "A word you saw, used to trick you",
  unstated_state: "The text never says anyone thought or knew this",
  absolute_language: "Words that are too strong",
  unlicensed_ranking: "It compares things the text never compares",
  sufficiency_overclaim: "It says one thing is enough, but more is needed",
  function_mismatch: "The text does not do this",
  speaker_attribution: "The wrong person said it",
  over_inference: "It goes too far from what the text says",
  direct_information: "Stated outright, when you had to work it out",
  near_miss_form: "The right area, but the wrong word",
  not_stated: "Not in the text at all"
};

/**
 * Section headings in the walkthrough. Plain English, one place to change them.
 */
export const WALKTHROUGH_LABELS = {
  skill: "What this question is testing",
  stem: "What the question is really asking",
  evidence: "Proof in the text",
  bridge: "Same meaning, different words",
  reasoning: "Why this answer is right",
  options: "Why the other answers are wrong",
  commonWrong: "Answers that do not get the mark",
  trap: "The trap",
  counterfactual: "If the question had asked something else",
  lesson: "Remember this next time",
  fails: "The part that is wrong:",
  highlighted: "highlighted on the left",
  quotedHere: "quoted here",
  hint: "The sentence with the answer is highlighted in yellow below.",
  hintMissed: "The sentence is quoted on the right. It could not be found automatically in this text.",
  youWrote: "You wrote",
  yourAnswer: "You picked",
  accepted: "Right answer",
  correct: "Right answer",
  youChose: "you picked this",
  notAnswered: "Not answered"
} as const;

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  fact: "Fact based",
  main_idea: "Main idea",
  purpose: "Purpose",
  inference: "Inference",
  reference: "Reference",
  vocabulary: "Vocabulary",
  tone: "Attitude and tone",
  comparison: "Comparison",
  cause_effect: "Cause and effect",
  detail: "Detail"
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  C1: "C1 · easy",
  C2: "C2 · moderate",
  C3: "C3 · hard"
};

/**
 * Approved explanations for a paper.
 *
 * Fetching this is also what records that the student has seen the answers, so
 * it is called when the review screen opens and not before — the server decides
 * that, not a click handler here, because a click handler can be skipped.
 */
export async function fetchExplanations(testId: string): Promise<Explanation[]> {
  try {
    const res = await apiFetch<{ items: Explanation[] }>(`/oet-tests/${testId}/explanations`);
    return res.items ?? [];
  } catch {
    return [];
  }
}

export type ExplanationStatus = { available: boolean; count: number; viewed: boolean };

/** Whether to show the "Check explanation" button, and whether they've looked. */
export async function fetchExplanationStatus(testId: string): Promise<ExplanationStatus> {
  try {
    return await apiFetch<ExplanationStatus>(`/oet-tests/${testId}/explanations/status`);
  } catch {
    return { available: false, count: 0, viewed: false };
  }
}
