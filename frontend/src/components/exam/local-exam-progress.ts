const STORAGE_PREFIX = "oet-exam-progress:";

export type LocalExamProgress = {
  attemptId: string;
  testId: string;
  currentQuestionIndex: number;
  section: string;
  listeningPageIndex: number;
  listeningTrackIndex: number;
  savedAt: number;
};

function storageKey(testId: string) {
  return `${STORAGE_PREFIX}${testId}`;
}

export function readLocalExamProgress(testId: string): LocalExamProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(testId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalExamProgress;
    if (!parsed?.attemptId || parsed.testId !== testId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalExamProgress(progress: LocalExamProgress) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(progress.testId), JSON.stringify(progress));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function clearLocalExamProgress(testId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(testId));
  } catch {
    // ignore
  }
}
