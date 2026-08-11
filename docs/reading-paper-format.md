# OET Reading paper — the JSON format

Everything a Reading paper needs, in one file: the texts, the questions, the
answer key, and the explanations. Import it once and the paper is live with its
explanations already published.

**Working sample:**
`backend/src/modules/tests/oet-import/samples/reading-with-explanations.sample.json`

That file is a real, importable paper. Open it alongside this document — it shows
every field below in place, with four fully worked explanations.

---

## Part 1 — Making Part A look like the real document

Part A is a **scanning task on a 15-minute timer**. The structure of the source
document is the thing the student scans, so it has to survive into the JSON. A
list of four contraindications flattened into a paragraph makes the practice
paper harder than the real exam and trains the wrong skill.

Each of the four texts is a list of blocks. There are five kinds.

```json
{ "letter": "B", "title": "Diagnosis and Screening", "blocks": [

  { "type": "p", "html": "Ordinary prose. Inline <b>bold</b> and <u>underline</u> are kept." },

  { "type": "heading", "text": "Indications for screening" },

  { "type": "list", "items": [
      "Family origin in a high-prevalence region.",
      "A partner already identified as a carrier."
  ]},

  { "type": "list", "ordered": true, "items": [
      "Full blood count with red cell indices.",
      "Serum ferritin, to exclude iron deficiency."
  ]},

  { "type": "note", "label": "Caution",
    "html": "Iron should not be prescribed on the basis of microcytosis alone." },

  { "type": "table",
    "head": ["Agent", "Route", "Usual dose"],
    "rows": [["Deferiprone", "Oral", "75 mg/kg/day"]] }
]}
```

| Use | When the source document has |
|---|---|
| `heading` | A sub-heading inside a text — "Contraindications", "Dosage" |
| `list` | Bullets. Add `"ordered": true` for a numbered protocol |
| `note` | A boxed warning or "do not exceed" panel. `label` is optional |
| `table` | Any table. First column is styled as a row header |
| `p` | Everything else |

**Never change the wording.** These blocks only restore the shape the document
already had.

---

## Part 2 — Explanations

Add an `explanation` object to any question. It is **optional everywhere** — a
paper without them imports exactly as before and simply has no "Check
explanation" button.

```json
{
  "n": 27,
  "type": "mcq",
  "prompt": "The comparison with infrastructure chiefly emphasises brain health's",
  "options": { "A": "…", "B": "…", "C": "…", "D": "…" },
  "answer": "B",

  "explanation": {
    "evidence": "Neurological and mental-health conditions affect far more than the people diagnosed with them.",
    "evidenceLetter": "B",
    "reasoning": "The opening sentence states the claim directly, and the question tests whether you recognise it under a paraphrase rather than the writer's own wording.",
    "skillTag": "paraphrase recognition",
    "options": {
      "A": { "verdict": "partial",    "why": "This is stated later in the passage and is true, but it is not what this question asks about." },
      "B": { "verdict": "correct",    "why": "This restates the opening claim in different words." },
      "C": { "verdict": "distractor", "why": "The passage does not support this, and it reverses the relationship described." },
      "D": { "verdict": "distractor", "why": "Not mentioned anywhere in the text." }
    }
  }
}
```

### The fields

| Field | Required | What it is |
|---|---|---|
| `evidence` | **yes** | The sentence, or at most two consecutive sentences, **quoted exactly** from the passage |
| `reasoning` | **yes** | Two or three sentences on why that evidence gives the answer |
| `evidenceLetter` | Part A only | Which text the evidence is in: `"A"`–`"D"` |
| `skillTag` | no | Two or three words: `"paraphrase recognition"`, `"scanning for a figure"` |
| `options` | MCQ only | A verdict on **every** option |

### `evidence` must be quoted exactly

The review screen searches for this string in the passage and highlights it. A
paraphrase silently downgrades the feature to a quote in a box — the student is
told to look at a highlight that is not there.

Quote it character for character. Differences in whitespace and in quote style
(`"` vs `"`) are handled automatically; **rewording is not**.

### The three verdicts

| Verdict | Means |
|---|---|
| `correct` | The right option |
| `partial` | **True in the passage, but not an answer to the question asked** |
| `distractor` | Unsupported, contradicted, or about something else |

**`partial` is the one that matters.** It is the trap between a C+ and a B, and
it is what almost every answer key leaves out. Use it whenever it genuinely
applies, and in the `why`, say what *is* true first and then what the question
actually asked:

> "The memo does describe what to do if temperatures go out of range, so this
> feels supported. But it never says any medication has actually been
> compromised, and the question asks for the purpose of the memo, not for one
> instruction inside it."

That sentence teaches. "Option C is incorrect" does not.

### Part A questions

Part A has no options, so no `options` block — just `evidence`, `evidenceLetter`
and `reasoning`. The most useful reasoning here is about **where to look and
why**, because Part A is a race:

> "The question asks about blood-test findings that point to a carrier, so the
> target is numbers from a blood count. Text B is the diagnosis text and gives
> the MCV and MCH thresholds directly. Candidates lose this one by reading Text A
> first because it mentions the word *carrier*, but Text A explains inheritance,
> not test results."

---

## The prompt for your thinking model

Paste this into the session that writes your papers.

> You are producing an OET Reading paper as a single JSON file for the OET HQ
> platform. Follow the format in `reading-with-explanations.sample.json` exactly.
>
> Two things beyond the usual paper content.
>
> **1. Preserve the structure of the Part A source documents.** Where the
> original has a sub-heading use `{"type":"heading","text":"…"}`, where it has
> bullets use `{"type":"list","items":[…]}` (add `"ordered": true` for numbered
> steps), where it has a warning box use `{"type":"note","label":"…","html":"…"}`,
> and where it has a table use the `table` block. Never change the wording —
> only restore the shape the document already had. Part A is a scanning task and
> the structure is what the candidate scans.
>
> **2. Give every question an `explanation` object.**
>
> - `evidence` — the sentence, or at most two consecutive sentences, from the
>   passage that contain the answer, **quoted exactly, character for character**.
>   Do not paraphrase, do not tidy punctuation, do not join sentences that are
>   not adjacent. This string is searched for in the passage and highlighted, so
>   an inexact quote breaks the feature.
> - `evidenceLetter` — Part A only: which text (A–D) the evidence is in.
> - `reasoning` — two or three sentences on *why* that evidence gives the answer.
>   Name the mechanism being tested: a paraphrase to recognise, a scan target,
>   the writer's opinion as distinct from a reported fact, a qualifier like
>   "rarely" or "only after". For Part A, say where to look and why, and name the
>   text candidates are most likely to waste time in. Never write filler like
>   "the passage says so".
> - `skillTag` — two or three words for what the question tests.
> - `options` — multiple choice only. A verdict on **every** option:
>   `"correct"`, `"partial"`, or `"distractor"`.
>   **`partial` means the option is true according to the passage but does not
>   answer the question that was asked**, or is true only under a condition the
>   question excludes. This is the most important category and the one candidates
>   lose marks to — use it whenever it genuinely applies, and do not default
>   everything to `distractor`. In the `why` for a partial, state what IS true
>   first, then what the question actually asked.
>
> Write plainly, in the second person, addressed to the candidate. Short
> sentences. No markdown, no bold, no headings inside these strings.
>
> Return the complete paper as one JSON object. Nothing before or after it.

---

## Importing

Admin → Test Builder → import, or:

```bash
curl -X POST https://your-api/oet-tests/import \
  -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" \
  --data-binary @your-paper.json
```

The response tells you how many explanations were taken:

```json
{ "id": "…", "type": "READING", "totalQuestions": 42,
  "explanations": { "saved": 42, "skipped": 0 } }
```

**Check `skipped`.** A skipped explanation is one missing `evidence` or
`reasoning` — it was dropped rather than blocking the import, so a shortfall is
visible here and not weeks later when a student opens the review screen.

Explanations that arrive in the paper's JSON are **published immediately** — you
wrote them. Anything drafted by Claude for older papers is held until an admin
approves it.

Re-importing a paper updates its explanations, **except** any an admin has edited
by hand in the panel. That edit is the most considered version of the text that
exists and a re-import must not silently discard it.

---

## Two things worth knowing

**Explanations are per question, not per paper.** Ship a paper with explanations
on ten questions and the review screen works for those ten; the rest show the
question, the student's answer and the correct answer, as they do today. You do
not have to do a whole paper at once.

**A student who opens the explanations has seen the answers.** Every attempt
after that is flagged as practice and kept out of their progress and their Pass
Predictor. They can re-sit the paper as often as they like — the score simply
stops counting, so the honest one remains the one that matters.
