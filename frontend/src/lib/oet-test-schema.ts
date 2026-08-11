/**
 * oet-test-schema.ts — the canonical one-paste import format for OET Reading &
 * Listening tests. This is the SINGLE SOURCE OF TRUTH shared by:
 *   - the importer (validates a pasted JSON blob → creates a draft Test),
 *   - the student renderer (renders the exam exactly like the reference HTML),
 *   - the official OET scorer (grades against the embedded answer key).
 *
 * A frontend type-only mirror lives at frontend/src/lib/oet-test-schema.ts —
 * keep the two in sync.
 *
 * Structure (both skills): 3 parts, 42 questions, global question numbers 1–42.
 *   READING   : Part A 1–20, Part B 21–26, Part C 27–42.  60 min (A=15, B+C=45).
 *   LISTENING : Part A 1–24, Part B 25–30, Part C 31–42.  45 min, one audio.
 */

export const OET_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------- content

/**
 * A block of rich reading content.
 *
 * Real OET Part A texts are not prose. They are guidelines and reference
 * material: sub-headings, bulleted criteria, numbered protocol steps, dosage
 * tables. Before `list` and `heading` existed here, every one of those
 * collapsed into a paragraph, which is not a cosmetic loss — Part A is a
 * SCANNING task, and the structure is what the student scans. A bulleted list
 * of four contraindications read as one grey block of prose makes the paper
 * harder than the real exam, and trains the wrong skill.
 *
 * No wording is ever changed. This only lets the paper look like the paper.
 */
export type OetTextBlock =
  | { type: "p"; html: string }
  | { type: "table"; head: string[]; rows: string[][] }
  /** A sub-heading inside a text, e.g. "Contraindications". */
  | { type: "heading"; text: string }
  /** A bulleted or numbered list. `items` may contain inline HTML. */
  | { type: "list"; ordered?: boolean; items: string[] }
  /** A boxed callout — a warning, a note, a "do not exceed" panel. */
  | { type: "note"; html: string; label?: string };

/** One of the four Part A reading texts (A/B/C/D). */
export type OetReadingText = {
  letter: "A" | "B" | "C" | "D";
  title: string;
  blocks: OetTextBlock[];
};

// ---------------------------------------------------------------- questions

/** Accepted-answer spec for a fill-blank. `mode:"or"` = any term matches;
 *  `mode:"and"` = every term must appear (substring, after normalization).
 *  `display` is the human-readable canonical answer shown on the answer key. */
export type OetFillAnswer = {
  display: string;
  mode: "or" | "and";
  terms: string[];
  caseSensitive?: boolean;
};

/** Reading Part A "in which text (A–D)…" letter-match question. */
export type OetLetterMatchQuestion = {
  n: number;
  type: "letter_match";
  prompt: string;
  /** Correct text letter. */
  answer: "A" | "B" | "C" | "D";
  explanation?: OetExplanation;
};

/** Fill-blank / note-completion. `prompt` may contain the token `[blank]`
 *  where the input renders (Listening note-completion); if absent the input
 *  renders after the prompt (Reading short-answer). */
export type OetFillBlankQuestion = {
  n: number;
  type: "fill_blank";
  prompt: string;
  answer: OetFillAnswer;
  explanation?: OetExplanation;
};

/** Single-answer MCQ. `options` keys are the option letters (A/B/C for 3-option,
 *  A/B/C/D for 4-option); `answer` is the correct key. */
export type OetMcqQuestion = {
  n: number;
  type: "mcq";
  prompt: string;
  options: Record<string, string>;
  answer: string;
  explanation?: OetExplanation;
};

export type OetQuestion = OetLetterMatchQuestion | OetFillBlankQuestion | OetMcqQuestion;

// ------------------------------------------------------------- explanations

/**
 * Why a wrong option is wrong.
 *
 * `partial` is the one that matters and the one most answer keys omit: an
 * option that is TRUE in the passage but does not answer the question asked.
 * That is the trap that separates a B from a C+, and a student who is only told
 * "the answer is B" never learns to see it.
 */
export type OetOptionVerdict = "correct" | "distractor" | "partial";

/**
 * The named trap an option is running, from the Dr Nasir distractor taxonomy.
 *
 * Naming it is not decoration. The method is that a candidate should learn to
 * recognise the SHAPE of a trap, not just that they got one item wrong — so the
 * explanation tells them what they were likely to have done, by name.
 */
export type OetDistractorType =
  | "wrong_referent"        // D1  agency reversed, or property on the wrong noun
  | "adjacent_entity"       // D2  right sentence, neighbouring entity
  | "partial_support"       // D3  one component supported, another not asserted
  | "superseded"            // D4  later contrast signal overturns it
  | "true_not_asked"        // D5  true, but not the function the stem asked for
  | "lexical_lure"          // D6  echoes a salient word you definitely saw
  | "unstated_state"        // D7  adds realise / believe / is discussed
  | "absolute_language"     // D8  only / all / always / never over-claims
  | "unlicensed_ranking"    // D9  a comparison the text never makes
  | "sufficiency_overclaim" // D10 treats one intervention as the whole story
  | "function_mismatch"     // D11 a rhetorical act the passage never performs
  | "speaker_attribution"   // D12 said, but by the wrong participant
  | "over_inference"        // D13 a candidate-built multi-step theory
  | "direct_information"    // D14 a directly-stated fact on an inference item
  | "near_miss_form";       // D15 right topic, wrong category / form / spelling

export type OetOptionExplanation = {
  verdict: OetOptionVerdict;
  /** Which trap, when the option is wrong. Omitted for the correct option. */
  trap?: OetDistractorType;
  why: string;
};

/** The ten Reading Part C question types. */
export type OetQuestionType =
  | "fact"
  | "main_idea"
  | "purpose"
  | "inference"
  | "reference"
  | "vocabulary"
  | "tone"
  | "comparison"
  | "cause_effect"
  | "detail";

/** C1 easy, C2 moderate, C3 hard — the declared difficulty index. */
export type OetDifficulty = "C1" | "C2" | "C3";

/**
 * The explanation for one question, authored alongside the paper.
 *
 * Optional everywhere: a paper without explanations imports exactly as before
 * and simply has no "Check explanation" button. Papers that carry them light it
 * up with no further step.
 */
export type OetExplanation = {
  /** The exact sentence(s) from the passage the answer comes from, verbatim so
   *  the review screen can find and highlight them in the text. */
  evidence: string;
  /** Part A only: which of the four texts (A–D) the evidence sits in. */
  evidenceLetter?: "A" | "B" | "C" | "D";
  /**
   * Why that evidence gives the answer.
   *
   * Deliberately SHORT. In the source method the correct answer's reasoning is
   * brief and the length lives in the distractor analysis, because the
   * difficulty is rarely in comprehending the passage — it is in reading the
   * options properly.
   */
  reasoning: string;
  /**
   * The stem restated with the operative word stressed, e.g.
   * "What do we learn about SCHIZOPHRENIA — not epilepsy — in paragraph 2?"
   * Answering what is asked rather than what is written is the single most
   * repeated corrective in the method, and this is where it lands.
   */
  stemFocus?: string;
  /** Which of the ten question types this is. */
  questionType?: OetQuestionType;
  /** C1 / C2 / C3, and whether the mark was an affordable one to drop. */
  difficulty?: OetDifficulty;
  /**
   * Counterfactual stem rewriting: "If the question had asked what we learn
   * about epilepsy, option D would have been correct."
   *
   * The most powerful device in the method for isolating what a distractor
   * actually answers — it shows the option is not nonsense, it is an answer to
   * a different question.
   */
  counterfactual?: string;
  /**
   * The transferable rule. Rendered LAST, deliberately: the item teaches the
   * rule, the rule does not introduce the item.
   */
  lesson?: string;
  /** Free-text tag, kept for papers authored before questionType existed. */
  skillTag?: string;
  /** Keyed by option letter. MCQ only. */
  options?: Record<string, OetOptionExplanation>;
};

// ---------------------------------------------------------------- reading parts

export type OetReadingPartA = {
  instructions?: string;
  topic: string;
  texts: OetReadingText[];
  /** Q1–20: letter_match and/or fill_blank. */
  questions: (OetLetterMatchQuestion | OetFillBlankQuestion)[];
};

/** Part B (both skills for reading): 6 independent extracts, one MCQ each. */
export type OetReadingPartBItem = {
  n: number;
  /** e.g. "Memo", "Policy", "Email". */
  kind?: string;
  docTitle?: string;
  /** The extract body (HTML allowed). */
  docHtml: string;
  prompt: string;
  options: Record<string, string>;
  answer: string;
  explanation?: OetExplanation;
};

export type OetReadingPartB = {
  instructions?: string;
  items: OetReadingPartBItem[];
};

export type OetReadingPartCText = {
  title: string;
  wordCount?: number;
  /** Ordered paragraphs (HTML; keep <b>/<u> reference words). */
  paras: string[];
  /** 8 MCQ (4-option) questions. */
  questions: OetMcqQuestion[];
};

export type OetReadingPartC = {
  instructions?: string;
  texts: OetReadingPartCText[];
};

// ---------------------------------------------------------------- listening parts

/** A heading that groups a run of Part A note-completion questions. */
export type OetListeningGroup = {
  heading: string;
  questionNumbers: number[];
};

export type OetListeningPartAExtract = {
  heading: string;
  /** Intro/context booklet for the extract (HTML allowed). */
  contextHtml: string;
  groups: OetListeningGroup[];
  /** Note-completion fill-blank questions for this extract. */
  questions: OetFillBlankQuestion[];
};

export type OetListeningPartA = {
  instructions?: string;
  extracts: OetListeningPartAExtract[];
};

/** Part B (listening): 6 extracts, per-question context, MCQ-3. */
export type OetListeningPartBItem = {
  n: number;
  extractLabel?: string;
  contextHtml: string;
  prompt: string;
  options: Record<string, string>;
  answer: string;
};

export type OetListeningPartB = {
  instructions?: string;
  items: OetListeningPartBItem[];
};

/** Part C (listening): 2 extracts, shared per-extract context, MCQ-3. */
export type OetListeningPartCExtract = {
  heading: string;
  contextHtml: string;
  questions: OetMcqQuestion[];
};

export type OetListeningPartC = {
  instructions?: string;
  extracts: OetListeningPartCExtract[];
};

// ---------------------------------------------------------------- top level

export type OetTiming = {
  totalMinutes: number;
  partAMinutes?: number;
  partBCMinutes?: number;
};

export type OetReadingImport = {
  schemaVersion: number;
  type: "READING";
  title: string;
  description?: string;
  instructions?: string;
  timing: OetTiming;
  partA: OetReadingPartA;
  partB: OetReadingPartB;
  partC: OetReadingPartC;
};

export type OetListeningImport = {
  schemaVersion: number;
  type: "LISTENING";
  title: string;
  description?: string;
  instructions?: string;
  /** Single session audio; its duration drives the timer. Optional at import
   *  time (admin can upload/attach the audio in the builder afterwards). */
  audioUrl?: string;
  timing: OetTiming;
  partA: OetListeningPartA;
  partB: OetListeningPartB;
  partC: OetListeningPartC;
};

export type OetTestImport = OetReadingImport | OetListeningImport;

// ---------------------------------------------------------------- helpers

/** Flatten every question across all parts in global-number order. */
export function collectQuestions(doc: OetTestImport): OetQuestion[] {
  const out: OetQuestion[] = [];
  if (doc.type === "READING") {
    out.push(...doc.partA.questions);
    out.push(...doc.partB.items.map(mcqFromItem));
    for (const t of doc.partC.texts) out.push(...t.questions);
  } else {
    for (const e of doc.partA.extracts) out.push(...e.questions);
    out.push(...doc.partB.items.map(mcqFromItem));
    for (const e of doc.partC.extracts) out.push(...e.questions);
  }
  return out.sort((a, b) => a.n - b.n);
}

function mcqFromItem(item: { n: number; prompt: string; options: Record<string, string>; answer: string }): OetMcqQuestion {
  return { n: item.n, type: "mcq", prompt: item.prompt, options: item.options, answer: item.answer };
}
