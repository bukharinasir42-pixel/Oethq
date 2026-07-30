import type { PastPaperSummaryDto } from "@/lib/types";

export const MAX_PAST_PAPERS = 10;

export function formatPastPaperDayTitle(dayNumber: number) {
  return `Past Paper ${dayNumber}`;
}

export function isPastPaperTestTitle(title: string) {
  return /past\s*paper/i.test(title.trim());
}

export function parsePastPaperDayNumber(title: string) {
  // Accepts "Past Paper 1", "Past Paper Day 1", and "Past Paper No 1" / "No. 1".
  const numbered = title.match(/Past\s*Paper\s+(?:Day\s+|No\.?\s+)?(\d+)/i);
  if (numbered) return Number(numbered[1]);
  return Number.MAX_SAFE_INTEGER;
}

export function getNextPastPaperDayNumber(pastPapers: PastPaperSummaryDto[]) {
  const dayNumbers = pastPapers.map((paper) => parsePastPaperDayNumber(paper.title));

  if (dayNumbers.length === 0) {
    return 1;
  }

  return Math.max(...dayNumbers) + 1;
}

export function sortPastPapersByDay(pastPapers: PastPaperSummaryDto[]) {
  return [...pastPapers].sort(
    (left, right) => parsePastPaperDayNumber(left.title) - parsePastPaperDayNumber(right.title)
  );
}
