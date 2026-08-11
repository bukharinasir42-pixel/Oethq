import { apiFetch } from "@/lib/api";

export type OptionVerdict = "correct" | "distractor" | "partial";

export type DistractorType =
  | "wrong_referent" | "adjacent_entity" | "partial_support" | "superseded"
  | "true_not_asked" | "lexical_lure" | "unstated_state" | "absolute_language"
  | "unlicensed_ranking" | "sufficiency_overclaim" | "function_mismatch"
  | "speaker_attribution" | "over_inference" | "direct_information" | "near_miss_form";

export type Explanation = {
  questionNumber: number;
  part: "A" | "B" | "C" | null;
  evidence: string;
  evidenceLetter: string | null;
  reasoning: string;
  stemFocus: string | null;
  questionType: string | null;
  difficulty: "C1" | "C2" | "C3" | null;
  counterfactual: string | null;
  lesson: string | null;
  skillTag: string | null;
  options: Record<string, { verdict: OptionVerdict; trap?: DistractorType; why: string }> | null;
};

/** What a student is told the trap was. His terms where he has one. */
export const TRAP_LABEL: Record<DistractorType, string> = {
  wrong_referent: "Reversed referent",
  adjacent_entity: "Neighbouring entity",
  partial_support: "Half supported",
  superseded: "Superseded later",
  true_not_asked: "True, but not asked",
  lexical_lure: "Word you recognised",
  unstated_state: "Unstated awareness",
  absolute_language: "Absolute language",
  unlicensed_ranking: "Ranking not in the text",
  sufficiency_overclaim: "Overclaims sufficiency",
  function_mismatch: "Wrong rhetorical act",
  speaker_attribution: "Wrong speaker",
  over_inference: "Built theory",
  direct_information: "Directly stated, not derived",
  near_miss_form: "Right topic, wrong form"
};

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
