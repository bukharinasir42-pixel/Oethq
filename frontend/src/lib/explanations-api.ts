import { apiFetch } from "@/lib/api";

export type OptionVerdict = "correct" | "distractor" | "partial";

export type Explanation = {
  questionNumber: number;
  part: "A" | "B" | "C" | null;
  evidence: string;
  evidenceLetter: string | null;
  reasoning: string;
  skillTag: string | null;
  options: Record<string, { verdict: OptionVerdict; why: string }> | null;
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
