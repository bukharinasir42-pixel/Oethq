import type { TestSummaryDto } from "@/lib/types";

export function formatTestDayTitle(type: "LISTENING" | "READING", dayNumber: number) {
  const label = type === "LISTENING" ? "Listening" : "Reading";
  return `${label} Day ${dayNumber}`;
}

export function parseTestDayNumber(title: string) {
  const match = title.match(/Day\s+(\d+)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function getNextTestDayNumber(tests: TestSummaryDto[], type: "LISTENING" | "READING") {
  const dayNumbers = tests
    .filter((test) => test.type === type)
    .map((test) => parseTestDayNumber(test.title));

  if (dayNumbers.length === 0) {
    return 1;
  }

  return Math.max(...dayNumbers) + 1;
}

export function sortTestsByDay(tests: TestSummaryDto[]) {
  return [...tests].sort((left, right) => parseTestDayNumber(left.title) - parseTestDayNumber(right.title));
}
