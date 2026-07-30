import {
  formatPastPaperDayTitle,
  isPastPaperTestTitle,
  parsePastPaperDayNumber
} from "./past-paper-title.utils";

describe("past paper title utils", () => {
  it("detects past paper test titles", () => {
    expect(isPastPaperTestTitle("Past Paper Day 3 — Listening")).toBe(true);
    expect(isPastPaperTestTitle("Listening Day 3")).toBe(false);
  });

  it("parses day numbers from past paper titles", () => {
    expect(parsePastPaperDayNumber(formatPastPaperDayTitle(3))).toBe(3);
    expect(parsePastPaperDayNumber("Past Paper Day 3 — Reading")).toBe(3);
    expect(parsePastPaperDayNumber("Past Paper 3 — Listening")).toBe(3);
  });
});
