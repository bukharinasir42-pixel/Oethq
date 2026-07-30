# OET Test Import — JSON format

Paste a single JSON document in **Admin → OET Tests → Import**. It validates live,
then creates a **draft (unpublished)** test. Publish it afterward to make it live.
Once imported, the exam **renders** (Part A/B/C) and **scores automatically** using the
official OET model — Reading via the Rasch-equated raw→scaled table, Listening via the
÷42→scaled formula — producing a scaled score (0–500) and A–E grade. No code changes needed.

Two ready-to-fill skeletons live here (already validated, 42 questions each):

- [`oet-reading-template.json`](oet-reading-template.json)
- [`oet-listening-template.json`](oet-listening-template.json)

Replace the placeholder text with your content and keep the structure/keys the same.

> **Format is JSON, not CSV.** A spreadsheet must be converted to this shape first.
> (CSV is only used for the *Spelling bank* and *skill-drills* libraries, not tests.)

---

## Hard rules (the validator enforces these)

| Field | Rule |
|---|---|
| `schemaVersion` | must be **1** |
| `type` | `"READING"` or `"LISTENING"` |
| `title` | required, non-empty |
| `timing.totalMinutes` | required number (Reading 60, Listening 45) |
| Question numbers | **globally unique, no gaps**, covering the exact range below |
| Reading numbering | Part A **1–20**, Part B **21–26**, Part C **27–42** |
| Listening numbering | Part A **1–24**, Part B **25–30**, Part C **31–42** |
| Reading `partA.texts` | **exactly 4** texts, letters `A`,`B`,`C`,`D` |

---

## Question types

**`letter_match`** (Reading Part A "in which text…"):
```json
{ "n": 1, "type": "letter_match", "prompt": "…?", "answer": "A" }
```
`answer` must be one of `A`/`B`/`C`/`D`.

**`fill_blank`** (short-answer / note-completion):
```json
{ "n": 17, "type": "fill_blank", "prompt": "… [blank] …",
  "answer": { "display": "shown on key", "mode": "or",
              "terms": ["accepted", "alt spelling"], "caseSensitive": false } }
```
- Put the token `[blank]` in `prompt` where the input should appear; omit it for a
  trailing input (Reading short-answer).
- `mode: "or"` → **any** term counts as correct. `mode: "and"` → **every** term must
  appear (substring match after normalisation). `caseSensitive` defaults to `false`.

**`mcq`** (Part B, Part C):
```json
{ "n": 27, "type": "mcq", "prompt": "…",
  "options": { "A": "…", "B": "…", "C": "…", "D": "…" }, "answer": "A" }
```
`answer` must be one of the option **keys**. Use 3 options (A–C) for Part B and Listening
Part C; 4 options (A–D) for Reading Part C.
In **Part B** you write items with an extract (`docHtml` for Reading, `contextHtml` for
Listening); the importer treats each item as an MCQ — no `"type"` field needed on Part B items.

---

## Content blocks (Reading Part A texts)

Each of the 4 texts holds an ordered `blocks` array:
```json
{ "type": "p", "html": "<p>Paragraph. Inline <b>HTML</b> allowed.</p>" }
{ "type": "table", "head": ["Col 1", "Col 2"], "rows": [["a","b"], ["c","d"]] }
```
Reading Part C uses `paras` (an array of paragraph strings) instead of blocks.

---

## Skill differences at a glance

| | Reading | Listening |
|---|---|---|
| Part A | 4 texts + Q1–20 (`letter_match`/`fill_blank`) | `extracts[]`, note-completion `fill_blank`, Q1–24 |
| Part B | 6 `items` (MCQ-3), Q21–26 | 6 `items` (MCQ-3), Q25–30 |
| Part C | 2 `texts` × 8 MCQ-4, Q27–42 | 2 `extracts` × 6 MCQ-3, Q31–42 |
| Audio | — | `audioUrl` (optional; can attach in builder after import) |

The example templates use a common split (Part A reading = 16 matching + 4 short-answer;
Listening Part A = 2 extracts × 12). You can redistribute types/counts freely **as long as
the numbering rules above hold**.
