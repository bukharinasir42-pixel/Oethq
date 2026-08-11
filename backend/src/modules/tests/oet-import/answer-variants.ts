/**
 * answer-variants.ts — the same word, written in a different form.
 *
 * Part A asks the candidate to find a word in the text and write it down. The
 * word has to be THE word: a synonym is a wrong answer even when it means the
 * same thing, because locating the right word is the whole of what the task
 * tests. That rule draws the boundary for everything in this file.
 *
 * On the accepted side, and only this side:
 *
 *  - **The same word spelled the other way.** "cerebral edema" for "cerebral
 *    oedema", "stabilize" for "stabilise". One word, two national spellings.
 *  - **The same word in another grammatical form.** "leg" for "legs",
 *    "deteriorate" for "deteriorates". The gap dictates the ending and finding
 *    the word is what was being tested.
 *
 * On the rejected side, deliberately:
 *
 *  - **A different word.** "declines" is not "deteriorates". "norepinephrine"
 *    is not "noradrenaline" unless the passage happens to use both, and none of
 *    the current papers does. Where a text genuinely offers two forms, both are
 *    in the text, so both belong in that paper's answer key rather than in a
 *    rule here that cannot see the passage.
 *  - **A misspelling.** "rhabdomyolisis" is not "rhabdomyolysis". Every rule
 *    below is an exact substitution of a known form or a known suffix. Nothing
 *    is fuzzy, nothing is a distance measure, and a word that is simply wrong
 *    stays wrong.
 */

/**
 * British and American spellings of the same word.
 *
 * Deliberately a list of stems rather than the letter rules ("oe" to "e") that
 * would express it more briefly. Those rules do not know what a word is, and
 * would quietly turn "does" into "des" and "shoes" into "shes". Every entry
 * here is a real medical or general term, so the transformation cannot reach
 * a word it was not meant for.
 */
const SPELLING_STEMS: Array<[RegExp, string]> = [
  // ae and oe
  [/\banaesth/g, "anesth"],
  [/\banaem/g, "anem"],
  [/\bhaem/g, "hem"],
  [/ischaem/g, "ischem"],
  [/leukaem/g, "leukem"],
  [/\bgynaec/g, "gynec"],
  [/\bpaediatr/g, "pediatr"],
  [/orthopaed/g, "orthoped"],
  [/\bcaec/g, "cec"],
  [/\boedem/g, "edem"],
  [/\boesophag/g, "esophag"],
  [/\boestrog/g, "estrog"],
  [/\bfoet/g, "fet"],
  [/\bcoeliac/g, "celiac"],
  [/diarrhoea/g, "diarrhea"],
  [/gonorrhoea/g, "gonorrhea"],
  [/\bpyaemi/g, "pyemi"],
  [/\btoxaemi/g, "toxemi"],
  [/\bsepticaemi/g, "septicemi"],
  [/\bhypovolaemi/g, "hypovolemi"],
  [/\bhypercapni/g, "hypercapni"],
  [/\bhypoxaemi/g, "hypoxemi"],
  [/\bhyperkalaemi/g, "hyperkalemi"],
  [/\bhypokalaemi/g, "hypokalemi"],
  [/\bhypernatraemi/g, "hypernatremi"],
  [/\bhyponatraemi/g, "hyponatremi"],
  [/\bhyperglycaemi/g, "hyperglycemi"],
  [/\bhypoglycaemi/g, "hypoglycemi"],
  [/\bbacteraemi/g, "bacteremi"],
  [/\buraemi/g, "uremi"],
  // our and or
  [/\btumour/g, "tumor"],
  [/\bcolour/g, "color"],
  [/\bbehaviour/g, "behavior"],
  [/\bodour/g, "odor"],
  [/\bvapour/g, "vapor"],
  [/\bhumour/g, "humor"],
  [/\bfavour/g, "favor"],
  // re and er
  [/\blitre/g, "liter"],
  [/\bmillilitre/g, "milliliter"],
  [/\bcentre/g, "center"],
  [/\bfibre/g, "fiber"],
  [/\bmetre/g, "meter"],
  // ph and f
  [/sulphat/g, "sulfat"],
  [/sulphur/g, "sulfur"],
  [/sulphonyl/g, "sulfonyl"],
  // ce and se
  [/\bdefence/g, "defense"],
  [/\blicence/g, "license"],
  [/\bpractise/g, "practice"],
  // the ise and yse families, last so the stems above are already settled
  [/ise\b/g, "ize"],
  [/ising\b/g, "izing"],
  [/ised\b/g, "ized"],
  [/isation\b/g, "ization"],
  [/yse\b/g, "yze"],
  [/ysing\b/g, "yzing"],
  [/ysed\b/g, "yzed"]
];

/**
 * One word, reduced to the form it shares with its plural and its tenses.
 *
 * "leg" and "legs" are the same answer; so are "deteriorate", "deteriorates",
 * "deteriorated" and "deteriorating", since the gap in the sentence dictates
 * which one fits and finding the word is what was being tested.
 *
 * Every rule strips a known suffix and nothing else. Short words are left
 * alone, and words ending "ss", "us" and "is" are protected, so "sepsis" and
 * "gas" survive intact and no two different answers are pushed together.
 */
function stemWord(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(sses|shes|ches|xes)$/.test(w)) w = w.slice(0, -2);
  // "ss", "us" and "is" are not plural endings, so "sepsis", "virus" and
  // "access" keep their last letter. "gas" is short enough to be left alone by
  // the length guard, which is why no rule needs to name it.
  else if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);

  if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);

  // A trailing "e" is what keeps "deteriorate" apart from "deteriorated" once
  // the suffix is off, so it comes off too and the whole family converges.
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/**
 * A phrase reduced to the form every reasonable way of writing it shares.
 *
 * Regional spelling and drug names first, since those change the letters a
 * suffix rule would then look at, and word forms last.
 */
export function canonicalPhrase(value: string): string {
  let s = String(value || "").toLowerCase();
  for (const [from, to] of SPELLING_STEMS) s = s.replace(from, to);
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map(stemWord)
    .join(" ")
    .trim();
}
