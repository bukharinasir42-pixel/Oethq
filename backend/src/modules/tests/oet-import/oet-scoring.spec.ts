import { matchFillBlank } from "./oet-scoring";
import type { OetFillAnswer } from "./oet-test-schema";

/**
 * Marking a short answer.
 *
 * Every case below came from a real result screen. A candidate typing "<0.3mL"
 * has given the same answer as "<0.3 mL", and marking that wrong is not a
 * cosmetic problem: it is a mark taken off someone preparing for an exam, and
 * they have no way to tell it was the grader rather than them.
 */

const key = (terms: string[], mode: "or" | "and" = "or"): OetFillAnswer =>
  ({ display: terms[0], mode, terms, caseSensitive: false }) as OetFillAnswer;

const reading = (user: string, terms: string[], mode: "or" | "and" = "or") =>
  matchFillBlank(user, key(terms, mode), "READING");

describe("short answer marking: the formatting a candidate actually types", () => {
  it.each([
    ["a missing space before the unit", "<0.3mL", ["<0.3 mL"]],
    ["a lower-case unit", "250-500ml", ["250-500 mL"]],
    ["a unit the key stopped short of", ">6.0mmol/L", [">6.0 mmol"]],
    ["a typed comparator for a symbol", ">=26.5 umol", ["≥26.5 µmol"]],
    ["micro spelled out", "26.5 micromol/L", ["≥26.5 µmol"]],
    ["an abbreviated unit", "15-30 mins", ["15 to 30 minutes"]],
    ["a written-out range", "250 to 500 mL", ["250-500 mL"]],
    ["an en dash for a hyphen", "15–30 minutes", ["15 to 30 minutes"]],
    ["no comparator where the key has one", "0.3 ML", ["<0.3 mL"]],
    ["a percentage", "25-30%", ["25-30%"]],
    ["percent spelled out", "25 to 30 percent", ["25-30%"]]
  ])("accepts %s", (_why, user, terms) => {
    expect(reading(user, terms)).toBe(true);
  });

  it.each([
    ["the opposite comparator", ">0.3 mL", ["<0.3 mL"]],
    ["a different figure", "100-200 mL", ["250-500 mL"]],
    // Both of these scored before the measurement path existed: the word-level
    // normaliser deleted the comparator and the decimal point, so "33-50%"
    // reduced to "33 50" and matched a key of "<33%" by substring.
    ["a neighbouring range", "33-50%", ["<33%"]],
    ["a figure inside another figure", "6", ["26.5"]],
    ["nothing", "", ["<0.3 mL"]]
  ])("rejects %s", (_why, user, terms) => {
    expect(reading(user, terms)).toBe(false);
  });
});

describe("short answer marking: phrases are unaffected", () => {
  it("accepts the answer inside a longer phrase, as Reading always has", () => {
    expect(reading("nebulised ipratropium bromide", ["ipratropium bromide"])).toBe(true);
    expect(reading("the patient's ability to tolerate oral medication", ["ability to tolerate oral medication"])).toBe(true);
  });

  it("still rejects a different drug", () => {
    expect(reading("salbutamol", ["ipratropium bromide"])).toBe(false);
  });

  it("requires every term in and mode", () => {
    expect(reading("salbutamol and aminophylline", ["salbutamol", "aminophylline"], "and")).toBe(true);
    expect(reading("salbutamol", ["salbutamol", "aminophylline"], "and")).toBe(false);
  });

  it("is unaffected by a leading article", () => {
    expect(reading("the surgical emphysema", ["surgical emphysema"])).toBe(true);
  });
});

describe("short answer marking: Listening still wants the whole answer", () => {
  const listening = (user: string, terms: string[]) => matchFillBlank(user, key(terms), "LISTENING");

  it("does not accept a substring", () => {
    expect(listening("nebulised ipratropium bromide", ["ipratropium bromide"])).toBe(false);
    expect(listening("ipratropium bromide", ["ipratropium bromide"])).toBe(true);
  });

  it("still forgives the spacing of a measurement", () => {
    expect(listening("<0.3mL", ["<0.3 mL"])).toBe(true);
  });
});
