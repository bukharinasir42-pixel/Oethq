# OET one-paste test import

Add a full OET Reading or Listening test by pasting ONE JSON document. The JSON
is validated, stored on `Test.contentJson`, and drives both the student renderer
and the official OET scorer. Only **published** tests appear on the live front end.

- **Schema (source of truth):** [`oet-test-schema.ts`](./oet-test-schema.ts)
- **Validator (paste feedback):** [`oet-test-validator.ts`](./oet-test-validator.ts)
- **Official scoring:** [`oet-scoring.ts`](./oet-scoring.ts)
- **Working samples / templates:**
  - [`samples/reading-sample.json`](./samples/reading-sample.json) — the provided Reading test converted to the format.
  - [`samples/listening-sample.json`](./samples/listening-sample.json) — the provided Listening test converted.

## Shape (top level)

```jsonc
{
  "schemaVersion": 1,
  "type": "READING" | "LISTENING",
  "title": "...",
  "description": "...",          // optional
  "instructions": "...",         // optional (pre-test)
  "audioUrl": "",                // LISTENING only — upload/attach audio in the builder
  "timing": { "totalMinutes": 60, "partAMinutes": 15, "partBCMinutes": 45 },
  "partA": { ... }, "partB": { ... }, "partC": { ... }
}
```

Global question numbers: **Reading** A 1–20, B 21–26, C 27–42. **Listening** A 1–24, B 25–30, C 31–42. Total 42.

Question types: `letter_match` (Reading Part A, answer A–D), `fill_blank`
(`answer: { display, mode: "or"|"and", terms: [...] }`), `mcq`
(`options: {A,B,C[,D]}`, `answer: "B"`). Fill-blanks accept multiple `terms`;
Reading matches by substring, Listening by exact (normalized).

## Scoring (official OET)

- **Reading:** raw /42 → equating table → scaled 0–500 → Grade E/D/C/C+/B/A.
- **Listening:** scaled = round(correct/42×500 / 10)×10 → Grade by threshold
  (A ≥450, B ≥350, C+ ≥300, C ≥200, D ≥100, else E). **Pass = scaled ≥ 350 (Grade B+).**

## API

- `POST /oet-tests/validate` (admin) — `{ json }` → `{ ok, errors[] | title, totalQuestions }`.
- `POST /oet-tests/import` (admin) — `{ json, testId? }` → creates/replaces a draft `Test`.
- `PUT /tests/:id/publish` (admin) — publish/unpublish (imported tests allowed).
- `GET /oet-tests/:id/play` (auth) — candidate payload, answer key stripped.
- `POST /oet-tests/:id/attempts/start`, `PUT /oet-attempts/:id/progress`,
  `POST /oet-attempts/:id/submit`, `GET /oet-attempts/:id/result`.
