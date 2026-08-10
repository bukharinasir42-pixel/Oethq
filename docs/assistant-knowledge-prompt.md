# Building the assistant's knowledge base from your chats and voice notes

You do not need to export anything by hand. If another Claude Code session
already has your WhatsApp chats and voice notes, that session can write the
knowledge base for you, in exactly the shape this application ingests.

Paste the prompt below into **that** session — the one that has the chats and the
audio. It writes a folder of files. Bring the folder here and run one command.

---

## The prompt to paste

> I want to build the knowledge base for a customer-facing chatbot on our website,
> oethq.com. We are OET HQ — we prepare healthcare professionals (nurses, doctors,
> dentists, pharmacists, physiotherapists and others) for the OET exam.
>
> You have our WhatsApp conversations and the transcripts of our voice notes.
> I want you to turn them into a **question-and-answer knowledge base**.
>
> **Create a folder called `oethq-knowledge/` containing JSON files**, grouped by
> topic — for example `fees-and-payment.json`, `courses-and-whats-included.json`,
> `live-classes-and-schedule.json`, `access-and-devices.json`,
> `writing-and-speaking.json`, `the-oet-exam-itself.json`,
> `refunds-and-problems.json`. Use whatever topics the material actually
> supports; do not invent a topic to fill a gap.
>
> Each file must be a JSON array in exactly this shape:
>
> ```json
> [
>   {
>     "question": "Can I pay in instalments?",
>     "answer": "No. Payment is a single card payment at checkout, and access opens as soon as it clears."
>   }
> ]
> ```
>
> Rules, all of which matter:
>
> 1. **One question, one answer, one entry.** If a single conversation covers
>    fees and class times, that is two entries, not one.
>
> 2. **Write the question the way a customer actually asks it**, including the
>    common misspellings and phrasings you see in the chats ("installments",
>    "how many days validity", "is it for dentist also"). This is what the search
>    matches against, so a question phrased in polished English will not be found
>    by someone typing the way our customers type. Where the same thing is asked
>    several different ways, add several entries with the same answer.
>
> 3. **The answer must be a fact we actually stated**, written cleanly in our
>    voice. Do not copy a message verbatim with its typos and greetings, and do
>    not add anything we never said. If we answered the same question
>    inconsistently over time, use the most recent answer and add a
>    `"note": "we have answered this differently in the past"` field to that
>    entry so I can check it.
>
> 4. **Never include anyone's personal details.** No customer names, phone
>    numbers, email addresses, order references, or anything that identifies an
>    individual. Write "a student asked" rather than naming them. Our own contact
>    address is fine.
>
> 5. **Leave out prices, and leave out specific dates.** Our live prices come from
>    our database and are supplied to the bot separately; a price baked into this
>    file would go stale and start contradicting the checkout page. Describe how
>    payment works, not what it costs.
>
> 6. **Include the awkward answers, not just the flattering ones** — what we do
>    not offer, what is not included, what people are commonly disappointed by,
>    what we tell someone whose exam is in ten days. A bot that can only answer
>    easy questions sends every hard one to a human.
>
> 7. **Cover the voice notes too.** Much of what we explain properly is only in
>    the audio. If something is explained at length there and only briefly in
>    text, take the long version.
>
> Aim for completeness over brevity — several hundred entries across the files is
> expected and welcome. Then write me a short `SUMMARY.md` in the same folder
> listing each file, how many entries it has, and — importantly — **the questions
> you saw asked that our chats never actually answered**, so I know what gaps
> remain.

---

## Then bring the folder here

```bash
cd backend
npm run chat:ingest -- /path/to/oethq-knowledge --dry-run   # check first
npm run chat:ingest -- /path/to/oethq-knowledge             # load it
```

Each `.json` file is detected as a question-and-answer list automatically. That
format retrieves better than anything else — in testing it scored 5.60 against
0.80 for the same question answered inside a raw chat log, because one entry is
exactly one retrievable unit.

Then open **Admin → Assistant → Try a question**, type the questions your
customers really ask, and check the right entry comes back. That costs nothing —
no model call is made. If the right passage is not in that list, the assistant
cannot answer it, and the fix is another entry, not different wording.

---

## If you would rather not use the other session

Two other routes, in order of how much they are worth:

1. **Write the Q&A file yourself.** Two hours with the format above will beat a
   large, messy corpus. You already know the thirty questions you answer every
   week.
2. **Export WhatsApp directly.** In WhatsApp: open the chat → ⋮ → More → Export
   chat → Without media. That gives a `.txt` this application ingests as
   `conversation` format. It works, but it is the weakest of the three: raw chat
   logs retrieve less precisely than clean question-and-answer pairs.

Whatever route you take, phone numbers and email addresses are stripped on
ingest, on every format — but do not rely on that instead of keeping personal
details out of the file in the first place. It catches contact details, not names.
