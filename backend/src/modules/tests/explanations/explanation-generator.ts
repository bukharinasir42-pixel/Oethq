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

const MODEL = process.env.ANTHROPIC_EXPLANATION_MODEL?.trim() || "claude-opus-5";

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

const SYSTEM = `You write answer explanations for OET Reading practice papers, for healthcare professionals preparing for the exam.

You are given the passage, the question, the options and the CORRECT ANSWER. The answer is already known and is not in question — never dispute it, never re-derive it. Your job is to explain it.

For each question produce:

1. evidence — the sentence, or at most two consecutive sentences, from the passage that contain the answer. QUOTE IT EXACTLY, character for character, from the passage you were given. Do not paraphrase, do not tidy the punctuation, do not join sentences that are not adjacent. This string is searched for in the passage and highlighted, so an inexact quote breaks it.

2. reasoning — two or three sentences on WHY that evidence gives the answer. Name the mechanism the question is testing: a paraphrase the candidate had to recognise, a scan target, the writer's opinion as distinct from a reported fact, a qualifier like "rarely" or "only after". Be specific to this question. Never write filler like "the passage says so".

3. options — for multiple choice ONLY, a verdict on every option:
   - "correct" for the right one.
   - "partial" when the option is TRUE according to the passage but does not answer the question that was asked, or is true only under a condition the question excludes. This is the most important category and the one candidates lose marks to. Use it whenever it genuinely applies.
   - "distractor" when the option is not supported, contradicts the passage, or is about something else entirely.
   For each, one sentence saying precisely why. For a "partial", say what IS true and then what the question actually asked.

4. skillTag — two or three words for what the question tests, e.g. "paraphrase recognition", "opinion vs fact", "scanning for a figure", "qualifier".

Write plainly, in the second person, addressed to the candidate. No markdown, no headings, no bold. Short sentences.

Return ONLY a JSON array, one object per question, in the order given:
[{"n": 1, "evidence": "...", "reasoning": "...", "skillTag": "...", "options": {"A": {"verdict": "distractor", "why": "..."}}}]
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
