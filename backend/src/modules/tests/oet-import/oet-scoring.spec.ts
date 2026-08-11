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

describe("short answer marking: the same word, spelled the other way", () => {
  it.each([
    ["American spelling", "cerebral edema", ["cerebral oedema"]],
    ["British spelling against an American key", "cerebral oedema", ["cerebral edema"]],
    ["anaesthetist", "anesthetist", ["anaesthetist"]],
    ["-ize for -ise", "stabilize the", ["stabilise the"]],
    ["sulfate for sulphate", "magnesium sulfate", ["magnesium sulphate"]],
    ["haemoglobin", "hemoglobin", ["haemoglobin"]]
  ])("accepts %s", (_why, user, terms) => {
    expect(reading(user, terms)).toBe(true);
  });
});

describe("short answer marking: a synonym is a wrong answer", () => {
  /**
   * Part A asks the candidate to find a word in the text and write it down, so
   * the word has to be THE word. These all mean the right thing and none of
   * them is what the passage says, which is the entire point of the task.
   *
   * The drug pairs are the ones that look most like a technicality. They are
   * not: no passage in the current 22 papers prints "norepinephrine",
   * "epinephrine", "meperidine" or "albuterol" anywhere. A candidate writing
   * one has supplied it from their own training, not located it in the text.
   * Where a passage does print both forms, both belong in that paper's key.
   */
  it.each([
    ["the American drug name", "norepinephrine", ["noradrenaline"]],
    ["the British drug name against an American key", "adrenaline", ["epinephrine"]],
    ["pethidine as meperidine", "meperidine", ["pethidine"]],
    ["salbutamol as albuterol", "albuterol", ["salbutamol"]],
    ["paracetamol as acetaminophen", "acetaminophen", ["paracetamol"]],
    ["a plain synonym", "declines", ["deteriorates"]],
    ["a close synonym", "worsens", ["deteriorates"]],
    ["an abbreviation the text does not print", "UTI", ["urinary tract infection"]],
    ["an expansion the text does not print", "acute tubular necrosis", ["ATN"]],
    ["a near paraphrase", "kidney failure", ["renal failure"]]
  ])("rejects %s", (_why, user, terms) => {
    expect(reading(user, terms)).toBe(false);
  });

  it("accepts both forms when the paper's key carries both, as it does where the text prints both", () => {
    expect(reading("EEG", ["EEG", "electroencephalography"])).toBe(true);
    expect(reading("electroencephalography", ["EEG", "electroencephalography"])).toBe(true);
  });
});

describe("short answer marking: word form", () => {
  it.each([
    ["a singular for a plural", "leg", ["legs"]],
    ["a plural for a singular", "arrhythmias", ["arrhythmia"]],
    ["a plural noun phrase", "blood test", ["blood tests"]],
    ["the base verb", "deteriorate", ["deteriorates"]],
    ["the past tense", "deteriorated", ["deteriorates"]],
    ["the participle", "deteriorating", ["deteriorates"]]
  ])("accepts %s", (_why, user, terms) => {
    expect(reading(user, terms)).toBe(true);
  });

  it("does not collapse words that merely end in s", () => {
    expect(reading("ga", ["gas"])).toBe(false);
    expect(reading("sepsi", ["sepsis"])).toBe(false);
  });
});

describe("short answer marking: spelling still counts", () => {
  it.each([
    ["a misspelled long word", "rhabdomyolisis", ["rhabdomyolysis"]],
    ["a misspelled short word", "diarhoea", ["diarrhoea"]],
    ["a dropped letter", "creatinne", ["creatinine"]],
    ["a swapped letter", "pyridostigmene", ["pyridostigmine"]],
    ["a different drug entirely", "dobutamine", ["dopamine"]],
    ["a different word", "urease", ["urea"]]
  ])("rejects %s", (_why, user, terms) => {
    expect(reading(user, terms)).toBe(false);
  });
});

describe("short answer marking: a comparator written as words", () => {
  it.each([
    ["greater than for >", "greater than 6.0 mmol/L", [">6.0 mmol"]],
    ["more than for >", "more than 6.0 mmol", [">6.0 mmol"]],
    ["at least for ≥", "at least 26.5 umol", ["≥26.5 µmol"]],
    ["less than for <", "less than 0.3 mL", ["<0.3 mL"]],
    ["below for <", "below 0.3 mL", ["<0.3 mL"]],
    ["the bare figure where the key qualifies it", "80%", ["up to 80%"]],
    ["an approximation the key does not have", "approximately 25-30%", ["25-30%"]]
  ])("accepts %s", (_why, user, terms) => {
    expect(reading(user, terms)).toBe(true);
  });

  it("still rejects a comparator pointing the other way", () => {
    expect(reading("more than 0.3 mL", ["<0.3 mL"])).toBe(false);
    expect(reading("at least 33%", ["<33%"])).toBe(false);
  });
});
