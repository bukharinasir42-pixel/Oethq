# Reading explanations — the file format

## The short version: one file

The simplest upload is a **single JSON carrying the paper, the answer key and
the explanations together**. Drop it into the admin panel and all three go live
in one action.

```bash
# build the combined files, one per paper
npm run explanations:merge -- ./papers ./explanations ./out
```

Everything below describes authoring the two halves separately, which is the
right way to *write* them, because a paper and its explanations change at very
different rates. Merging is the packaging step before upload.

An item that is still a draft is held back even inside a combined file, so a
paper whose prose is half written can be uploaded without putting a blank
explanation in front of a student.

---

Explanations travel in their **own file**, one per paper. The paper is never
touched to add, correct or publish an explanation.

That separation is deliberate. The papers carry structure that took real work to
get right: headings, tables, bullets, notes, the Part A layout. Re-importing a
paper to fix a sentence in an explanation would put all of that back in the blast
radius of an editorial change. The question number is what joins the two.

```
papers/          the papers.        Imported once, changed rarely.
explanations/    the explanations.  Re-imported freely, as often as you like.
```

## Loading a file

```bash
# one paper, or a whole folder
npm run explanations:import -- ./explanations
npm run explanations:import -- ./explanations/oet-reading-mock-no-5-2026.json

# see what would match, without writing anything
npm run explanations:import -- ./explanations --dry
```

A file is matched to its paper by `meta.testId`, then `meta.title`, then the
filename, each compared against the imported paper's title with punctuation and
casing ignored. A file that matches nothing is reported and the run exits
non-zero, because a silent miss looks exactly like a successful run.

The same thing is available to an admin over HTTP:

```
POST /admin/oet-tests/:id/explanations/import
```

## The shape

```json
{
  "schemaVersion": "1.0",
  "meta": {
    "testId": "oet-reading-mock-no-5-2026",
    "title": "OET HQ Reading Test No. 5 (2026)",
    "subtest": "reading"
  },
  "items": {
    "A1":  { "part": "A", "n": 1,  "...": "..." },
    "B21": { "part": "B", "n": 21, "...": "..." },
    "C27": { "part": "C", "n": 27, "ti": 0, "...": "..." }
  }
}
```

Item keys are labels. **`n` is what binds** an explanation to a question, so a
mis-keyed item still lands correctly as long as `n` is right.

## One item

| Field | Required | What it is |
|---|---|---|
| `n` | yes | the question number, 1 to 42 |
| `part` | yes | `A`, `B` or `C` |
| `correct` | MCQ | must agree with the paper's key |
| `evidence` | **yes** | `[{ "loc": "Text A" \| "¶4" \| "Email", "quote": "…" }]` |
| `reasoning` | to publish | why the key is right |
| `bridge` | where useful | `[{ "stem": "held back", "text": "withheld" }]` |
| `options` | MCQ | `{ "A": { "ok": false, "tag": "partial", "fails": "…", "why": "…" } }` |
| `commonWrong` | short answer | `[{ "wrote": "…", "why": "…" }]` |
| `skill` | recommended | one line, what the item is testing |
| `questionType` | recommended | a readable name, or one of the ten enum values |
| `difficulty` | recommended | `C1`, `C2` or `C3` |
| `trap` | optional | what the student was likely to have done |
| `lesson` | optional | the transferable rule |
| `note` | optional | grey callout, for a key concern or a caveat |
| `confidence` | optional | `high`, `medium`, `low`. Admin only, never shown to a student |
| `status` | optional | `draft` holds the item back from students |

`reasoning`, `why`, `trap`, `lesson` and `note` are rendered as HTML. `<b>`,
`<i>`, `<em>` and `<strong>` are kept; everything else is neutralised on import.

### The quote is the whole feature

The walkthrough finds `quote` in the passage and highlights it. A quote that has
been paraphrased, had its punctuation tidied, or been stitched together from two
non-adjacent sentences will not be found, and the student is then told to look at
a highlight that is not there. That is worse than no explanation at all.

- Copy the quote character for character.
- Two sentences that are not adjacent are **two entries**, not one quote.
- `…` inside a quote elides a clause. Each side is located and marked separately.
- Curly quotes, dashes and whitespace differences are tolerated. Word changes are not.

Check before importing:

```bash
npm run paper:check -- ./papers          # papers with explanations embedded
```

### Two-pass authoring

A paper is normally authored in two passes: locate and verify the evidence for
all 42 items, then write the analysis. The format supports that directly.

An item with evidence but no `reasoning` is **stored as a draft**. The located
evidence is real work and is not thrown away, the admin queue shows exactly what
is still owed, and no student sees a half-written explanation. Fill in the prose
and re-import: drafts become published automatically.

An item a human has edited in the admin screen is **never overwritten** by an
import. That edit is the most considered version of the text that exists.

### Distractor tags

`tag` names why a wrong option is wrong. Short and long names are both accepted,
so a file written in either vocabulary imports without a find and replace.

| Short | Stored as | Shown to the student |
|---|---|---|
| `referent` | `wrong_referent` | It swaps who does what |
| `adjacent` | `adjacent_entity` | It talks about the wrong thing |
| `partial` | `partial_support` | Half right, half wrong |
| `superseded` | `superseded` | The text changes this later |
| `notasked` | `true_not_asked` | True, but not the question |
| `lure` | `lexical_lure` | A word you saw, used to trick you |
| `state` | `unstated_state` | The text never says anyone thought or knew this |
| `absolute` | `absolute_language` | Words that are too strong |
| `ranking` | `unlicensed_ranking` | It compares things the text never compares |
| `completeness` | `sufficiency_overclaim` | It says one thing is enough, but more is needed |
| `function` | `function_mismatch` | The text does not do this |
| `speaker` | `speaker_attribution` | The wrong person said it |
| `absent` | `not_stated` | Not in the text at all |
| `overinfer` | `over_inference` | It goes too far from what the text says |
| `form` | `near_miss_form` | The right area, but the wrong word |

An unrecognised tag is dropped rather than stored. The taxonomy is the teaching,
and an invented category would teach the wrong shape.

### `ok` and `verdict`

`"ok": true` and `"ok": false` are accepted, and map to `correct` and
`distractor`. They cannot express the third verdict, `partial` — an option that
is **true in the passage but does not answer the question asked**. That option is
the one that separates a C from a B, so where an option is of that kind, say so
explicitly:

```json
"B": { "verdict": "partial", "tag": "notasked", "fails": "…", "why": "…" }
```

### `fails`

The exact phrase **from the option** that breaks. It is quoted back to the
student, so it has to appear in the option verbatim. "This option overstates the
case" teaches nothing; pointing at the word `proves` teaches the habit.

## What a student never sees

`confidence`, and any item still held as a draft. A student told an explanation
is medium confidence learns to discount every explanation on the page, including
the ones that are certain, so that signal stays in the admin queue where it is
actionable.

---

# Answer keys — what the marker accepts

Short answers are marked leniently on **formatting** and strictly on **meaning**.
A candidate who types `<0.3mL` has answered `<0.3 mL`, and marking that wrong is
a mark taken off someone preparing for an exam who has no way to tell it was the
grader rather than them.

Accepted automatically, on every key, without listing them as terms:

| The key says | The candidate types | Marked |
|---|---|---|
| `<0.3 mL` | `<0.3mL`, `0.3 ML`, `<0.3 ml` | correct |
| `250-500 mL` | `250-500ml`, `250 to 500 mL`, `250–500 mL` | correct |
| `>6.0 mmol` | `>6.0mmol/L`, `6.0 mmol/l` | correct |
| `≥26.5 µmol` | `>=26.5 umol`, `26.5 micromol/L` | correct |
| `15 to 30 minutes` | `15-30 mins`, `15–30 minutes` | correct |
| `25-30%` | `25 to 30 percent` | correct |

Still wrong, and deliberately so:

| The key says | The candidate types | Marked |
|---|---|---|
| `<0.3 mL` | `>0.3 mL` | wrong — opposite comparator |
| `<33%` | `33-50%` | wrong — the neighbouring category |
| `250-500 mL` | `100-200 mL` | wrong |

A comparator the key has and the candidate omits is accepted, since the question
normally supplies the direction. Two comparators that **disagree** never are.

Reading keeps its substring rule for phrases, so `nebulised ipratropium bromide`
satisfies a key of `ipratropium bromide`. Listening still wants the whole answer.

## Auditing the keys

```bash
npm run keys:check -- ./papers
```

Reports two things:

- **errors** — a key that does not accept its own displayed answer. Every
  candidate who copies what the review screen shows them would be marked wrong.
- **warnings** — a realistic retyping the key would reject, and keys with only
  one accepted wording where a synonym plausibly exists.

Formatting is handled by the marker, so a warning here is a genuine content
question: is there a second correct way to say this? `UTI` for `urinary tract
infection`, `declines` for `deteriorates`. Those belong in `terms`; spacing and
unit case do not.
