export const MAX_PAST_PAPERS = 10;

export function formatPastPaperDayTitle(dayNumber: number) {
  return `Past Paper Day ${dayNumber}`;
}

export function parsePastPaperDayNumber(title: string) {
  const numbered = title.match(/Past\s*Paper\s+(?:Day\s+)?(\d+)/i);
  if (numbered) return Number(numbered[1]);
  return Number.MAX_SAFE_INTEGER;
}

export function isPastPaperTestTitle(title: string) {
  return /past\s*paper/i.test(title.trim());
}
