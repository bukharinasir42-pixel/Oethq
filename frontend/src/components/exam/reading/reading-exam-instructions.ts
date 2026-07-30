export type ReadingSectionIntro = {
  title?: string;
  body: string;
};

const READING_PART_A_SECTION_INTROS: Array<{ atSequence: number; intro: ReadingSectionIntro }> = [
  {
    atSequence: 1,
    intro: {
      title: "Questions 1–7",
      body:
        "For each question, 1–7, decide which text (A, B, C or D) the information comes from. Write the letter A, B, C or D in the space provided. You may use any letter more than once"
    }
  },
  {
    atSequence: 8,
    intro: {
      title: "Questions 8–13",
      body:
        "Answer the following questions, 8–13, with a word or short phrase from one of the texts. Each answer may include words, numbers or both. You should not write full sentences"
    }
  },
  {
    atSequence: 14,
    intro: {
      title: "Questions 14–20",
      body:
        "Complete each of the sentences, 14–20, with a word or short phrase from one of the texts. Each answer may include words, numbers or both."
    }
  }
];

export const READING_PART_B_INTRO: ReadingSectionIntro = {
  body:
    "In this part of the test, there are six short extracts relating to the work of health professionals. For questions 21–26, choose the answer (A, B or C) which you think fits best according to the text"
};

export const READING_PART_C_INTRO: ReadingSectionIntro = {
  body:
    "In this part of the test, there are two texts about different aspects of healthcare. For questions 27–42, choose the answer (A, B, C or D) which you think fits best according to the text"
};

export function getReadingSectionIntroAtSequence(sequence: number): ReadingSectionIntro | null {
  const partAIntro = READING_PART_A_SECTION_INTROS.find((entry) => entry.atSequence === sequence);
  if (partAIntro) return partAIntro.intro;
  if (sequence === 21) return READING_PART_B_INTRO;
  if (sequence === 27) return READING_PART_C_INTRO;
  return null;
}

export function getReadingPartTransitionIntro(part: "B" | "C"): ReadingSectionIntro {
  return part === "B" ? READING_PART_B_INTRO : READING_PART_C_INTRO;
}
