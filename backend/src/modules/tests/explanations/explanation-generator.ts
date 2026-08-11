import Anthropic from "@anthropic-ai/sdk";
import { parseExplanation, type ParsedExplanation } from "./explanations.service";

/**
 * explanation-generator.ts — draft explanations for a paper that has none.
 *
 * Every paper from now on carries its explanations in its own JSON. This exists
 * for the back catalogue, and everything it produces is a DRAFT that a human
 * must approve. It is a first pass to edit, not an authority.
 *
 * Two rules shape the prompt, and both come from what makes an explanation
 * worth reading rather than merely present:
 *
 *  - **The evidence must be quoted verbatim from the passage.** The review
 *    screen locates that string in the text and highlights it, so a paraphrase
 *    silently degrades the feature to a quote in a box. The generated evidence
 *    is verified against the passage here, and a chunk that cannot be found is
 *    rejected rather than shipped.
 *  - **Every wrong option gets a verdict, and `partial` is a real category.**
 *    An option that is true in the passage but does not answer the question is
 *    the trap that separates a C+ from a B. A model left to itself calls
 *    everything a distractor, so it is told the difference explicitly.
 */

/** The default drafting model. Overridable per deployment. */
export const DEFAULT_EXPLANATION_MODEL = "claude-opus-5";

const MODEL = process.env.ANTHROPIC_EXPLANATION_MODEL?.trim() || DEFAULT_EXPLANATION_MODEL;

/** One paper's worth of questions is too much for a single call to do well. */
const BATCH_SIZE = 6;

const MAX_TOKENS = 4000;

export type GeneratorQuestion = {
  n: number;
  type: "letter_match" | "fill_blank" | "mcq";
  prompt: string;
  options?: Record<string, string>;
  answer: string;
  /** The text the answer must come from. */
  passage: string;
  /** Part A only: which text (A–D) the passage is. */
  letter?: string;
};

const SYSTEM = `You write OET Reading answer explanations in the method of Dr Nasir Bukhari, for healthcare professionals preparing for the exam.

You are given the passage, the question, the options and the CORRECT ANSWER. The answer is settled. Never dispute it and never re-derive it. Your job is to explain it in his way.

THE METHOD, IN ONE LINE
Answer what is being asked, not what is being written. Almost every wrong option is genuinely present in the passage; that is what makes it a trap.

PRODUCE, FOR EACH QUESTION:

stemFocus — the stem restated with the operative word stressed in CAPITALS, naming what it excludes where that matters. "What do we learn about SCHIZOPHRENIA, not epilepsy, in the second paragraph?"

evidence — the sentence, or at most two consecutive sentences, from the passage that carry the answer. QUOTE IT EXACTLY, character for character. Never paraphrase, never tidy punctuation, never join non-adjacent sentences. This string is located and highlighted in the passage, so an inexact quote breaks it.

reasoning — SHORT. Two or three sentences. The correct answer is usually simple; the difficulty lives in the options, and that is where the length belongs. Make the paraphrase mapping explicit where one is doing the work ("rare and relatively infrequent carry the same meaning here").

questionType — one of: fact, main_idea, purpose, inference, reference, vocabulary, tone, comparison, cause_effect, detail.

difficulty — C1 easy, C2 moderate, C3 hard. A paper is never uniformly hard. If the item was easy, say so plainly in the lesson; dropping an affordable mark is worth naming.

options — every option, with a verdict and, when wrong, the NAMED trap:
  wrong_referent — the agent and patient are reversed, or a property is attached to the wrong noun.
  adjacent_entity — right sentence, but about the neighbouring entity rather than the one the stem named.
  partial_support — one component supported, another simply not asserted. Treat these component by component: say what IS supported first, then name the exact phrase that is not.
  superseded — asserted earlier, then overturned by a later contrast signal in the same paragraph.
  true_not_asked — a true statement, but not the function the stem asked for. Learn is different from fact.
  lexical_lure — echoes a salient word the candidate definitely saw, so recognition replaced comprehension.
  unstated_state — adds realise, believe, recognise, is aware, is discussed, when the text describes only a state of affairs.
  absolute_language — only, all, always, never, solely, proves. These change meaning absolutely and cannot be bent.
  unlicensed_ranking — asserts a comparison or ranking the text never makes.
  sufficiency_overclaim — treats one intervention as the whole story when the text specifies more.
  function_mismatch — describes a rhetorical act the passage does not perform (questioning when it is describing).
  speaker_attribution — genuinely said, but by the wrong participant.
  direct_information — a directly stated fact offered on an item that requires a derived conclusion.
  near_miss_form — right topic, wrong grammatical or taxonomic category (a drug where a class was asked for).

counterfactual — the strongest device in the method. Take the most tempting wrong option and rewrite the stem so that it WOULD be correct: "If the question had asked what we learn about epilepsy, option D would have been correct." This shows the option is not nonsense, it answers a different question. Include it whenever a distractor is genuinely tempting.

lesson — the transferable rule, one sentence, stated LAST. The item teaches the rule; the rule does not introduce the item.

HOW TO WRITE
Second person, addressed to the candidate. "You located the synonym, then you stopped." Short sentences. Plain professional language.
NEVER use an em dash or an en dash. Use a comma, or start a new sentence.
Never merely assert that an option is incorrect. Always name the failing component.
No markdown, no bold, no headings inside any string.
Do not soften. If the item was elementary, say so.
No motivational or closing remarks. Analysis only.

Return ONLY a JSON array, one object per question, in the order given:
[{"n": 1, "stemFocus": "...", "evidence": "...", "reasoning": "...", "questionType": "inference", "difficulty": "C2", "counterfactual": "...", "lesson": "...", "options": {"A": {"verdict": "partial", "trap": "partial_support", "why": "..."}}}]
No prose before or after the array.`;

/** Normalised for comparison: whitespace and quote style vary harmlessly. */
function loose(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Strip tags so a quote can be matched against what the student actually reads. */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|h[1-6]|tr|div)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Is the quoted evidence actually in the passage?
 *
 * The whole feature rests on locating this string. Verifying it here — rather
 * than discovering it failed in the browser — is the difference between a
 * highlight that lands and a silent downgrade.
 */
export function evidenceIsInPassage(evidence: string, passage: string): boolean {
  return loose(plain(passage)).includes(loose(plain(evidence)));
}

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export type GeneratedExplanation = ParsedExplanation & { n: number; evidenceVerified: boolean };

export class ExplanationGenerator {
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  private anthropic(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) throw Object.assign(new Error("ANTHROPIC_API_KEY is not set."), { statusCode: 503 });
      this.client = new Anthropic({ apiKey, maxRetries: 2 });
    }
    return this.client;
  }

  /**
   * Draft explanations for a set of questions.
   *
   * Batched, because a single call covering 42 questions produces noticeably
   * thinner reasoning on the later ones — the model has a fixed output budget
   * and spends it early.
   */
  async generate(questions: GeneratorQuestion[]): Promise<GeneratedExplanation[]> {
    const out: GeneratedExplanation[] = [];

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);
      const payload = batch.map((q) => ({
        n: q.n,
        passage: plain(q.passage).slice(0, 12000),
        passageLetter: q.letter ?? null,
        question: plain(q.prompt),
        options: q.options
          ? Object.fromEntries(Object.entries(q.options).map(([k, v]) => [k, plain(v)]))
          : undefined,
        correctAnswer: q.answer
      }));

      let text = "";
      try {
        const res = await this.anthropic().messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          // Explaining a distractor is genuine reasoning, and this runs in the
          // background against a batch — unlike the chat widget, nobody is
          // watching a cursor blink, so the latency buys real quality here.
          thinking: { type: "adaptive" },
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: JSON.stringify(payload, null, 1) }]
        });
        if (res.stop_reason === "refusal") continue;
        text = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[explanations] generation failed for a batch:", e instanceof Error ? e.message : e);
        continue;
      }

      const arr = extractJsonArray(text);
      if (!arr) continue;

      for (const item of arr) {
        const o = item as Record<string, unknown>;
        const n = Number(o.n);
        const source = batch.find((q) => q.n === n);
        if (!source) continue;
        const parsed = parseExplanation(o);
        if (!parsed) continue;
        out.push({
          ...parsed,
          n,
          evidenceLetter: parsed.evidenceLetter ?? source.letter ?? null,
          evidenceVerified: evidenceIsInPassage(parsed.evidence, source.passage)
        });
      }
    }

    return out;
  }
}
