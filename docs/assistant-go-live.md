# Going live with the assistant

Three steps and it works.

---

## 1. Put your key on the API server

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Backend `.env` or your ECS task environment, then restart the API.

**Never give it a `NEXT_PUBLIC_` name and never put it in the frontend.** A key in
the browser bundle is a key anyone can read and spend. Every call goes through
your own server; the browser never sees the key.

With no key set the chat button does not render at all, so this is also the off
switch.

Two other settings worth knowing:

| Variable | Why |
|---|---|
| `TRUST_PROXY=true` | The anonymous rate limit is keyed on the visitor's IP. Behind a CDN, without this, every visitor looks like the proxy and one person hitting the cap locks out everyone. |
| `ANTHROPIC_CHAT_MODEL` | Defaults to `claude-opus-5`. `claude-sonnet-5` is about half the price, `claude-haiku-4-5` about a fifth. The spend estimate in admin follows whichever is set. |
| `PUBLIC_APP_URL` | Protects your own email domain from the ingest redactor, so `support@oethq.com` survives while a student's address does not. |

## 2. Load the knowledge

```bash
cd backend
npm run chat:ingest -- /path/to/oethq-knowledge --dry-run   # check first
npm run chat:ingest -- /path/to/oethq-knowledge             # load it
```

**Do not ingest `SUMMARY.md`.** It is the gap analysis written for you, not
answers for students. If it slips in, delete that batch in **Admin → Assistant**.

The 2,093 entries are already loaded here and verified. Re-running creates a new
batch rather than replacing the old one, so switch the old one off in admin
before you re-ingest the same material.

## 3. Check it before you point traffic at it

**Admin → Assistant → Try a question.** Type the questions your students really
ask and confirm the right entry comes back. This costs nothing — no model call is
made. If the right passage is not in that list, the assistant cannot answer it,
and the fix is another entry, not different wording.

Then send a few real messages through the widget and read them in
**Admin → Assistant → Conversations**.

---

## How it behaves

**A visitor on the public pages** gets the sales flow from your prompt: understand,
diagnose out loud for free, check, recommend exactly one plan, send the link.

**A signed-in student** gets support and is never sold to — no tier
recommendation, no checkout link, no request for their number. They have already
paid.

**Ten replies, then it closes.** The prompt paces towards a recommendation by
reply 8 and the link by reply 10. At reply 11 the thread closes with a handoff to
your team, and that close costs nothing because the model is never called for it.
Students are not capped — cutting off a paying student mid-problem is a support
failure, not a sales optimisation. Say the word if you want them capped too.

**It asks for a WhatsApp number** once when the chat opens and once more after it
has given real advice. Never a third time. Numbers appear under
**Admin → Assistant → Leads** with the traffic channel that produced them, a
contacted flag, and a button that copies the lot for a spreadsheet.

**It cannot send a broken link.** Only URLs on the allowlist survive; anything
else on oethq.com is rewritten to the site root before the student sees it, and
logged so you can see what it was reaching for. That is enforced after the model
has spoken, not merely asked for in the prompt.

**Photos work.** A student can send their score report and the assistant reads
the four sub-test scores off it. Images are shrunk in the browser before upload —
which also strips the GPS coordinates a phone photo carries — and are never
stored. Only a count is kept.

**Dictation works** in Chrome, Edge and Safari, using the browser's own
recogniser. No GPU, no second vendor, no per-minute cost, and the audio never
leaves the device. The button is simply absent in Firefox, which has no such
feature. It is weaker than Whisper on a strong accent, which is why the
transcript lands in the input box as editable text rather than being sent.

**It never appears during an exam**, or in admin.

---

## Running cost

Roughly **2 US cents per message** on Opus 5. About $20 per 1,000 messages.

Almost the entire prompt — instructions, your verified facts, the link
allowlist, the catalogue and the sales script, about 8,955 tokens — sits inside
the prompt cache and is billed at a tenth of the normal rate. Only 13 tokens are
charged at full rate on each message. **Admin → Assistant** shows the cache hit
rate and the running spend.

Switching `ANTHROPIC_CHAT_MODEL` to `claude-sonnet-5` roughly halves it. Read a
day of real answers before deciding — the job is answering only from the
retrieved passages, and that is where the model tiers actually differ.

---

## Still needs a decision from you

These came from the delivery and are still open. The assistant is deliberately
silent on each until you answer.

1. **Per-tier checkout URLs.** Only `https://oethq.com` is on the allowlist, so
   that is the only link it can send. Give me the working checkout URL for each
   tier and it will use them with no code change.
2. **Payment methods.** Four years of history shows card, bank transfer PKR,
   Wise, UPI and STC Pay. Until you confirm, it says "pay by card at checkout"
   and nothing more.
3. **The platform your cohort classes run on.** It confirms the classes exist and
   that students choose their own days and times, but never names a platform.
4. **The two held-back answers** in `oethq-knowledge-review/` — individual
   Speaking sessions on Zoom, and a YouTube membership refund.
5. **Website copy discrepancies** the delivery flagged: the Reading page says 99%
   where you confirmed 90%; Complete Materials shows "Up to 60d" against a tier
   giving 270 days; the homepage states the 90% claim with one condition where
   your approved wording needs two; the site links to `wa.me/15109540245`.

## One thing to check yourself

The delivery reports that every URL on oethq.com except the homepage returns 404
when opened cold. **I could not verify this** — outbound network access is blocked
in my sandbox. What I can confirm is that `/courses/reading` and the others *do
exist as routes in your codebase*, so if they 404 live it is a hosting or deploy
configuration problem, not a missing page.

Check it in ten seconds: open a private window and paste
`https://oethq.com/courses/reading` into the address bar directly, rather than
clicking through from the homepage. If that 404s, it is real, and it is costing
you every sale that starts from a link.
