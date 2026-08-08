# OET HQ AI Assistant — Build Plan

Status: **awaiting approval**. No code written yet.

An assistant that answers in the Dr Nasir team's voice, grounded in the academy's
own lectures and method, across three surfaces: the student portal, the public
website, and WhatsApp.

---

## 1. What this is (and is not)

This is **not** a model trained from scratch. It is an existing frontier model
wrapped in three layers we own:

| Layer | What it does | Source |
|---|---|---|
| **Voice** | How the team talks — openings, corrections, encouragement, pacing, catchphrases | Distilled offline from 3 years of WhatsApp chats |
| **Knowledge** | What the team teaches — the method, not generic internet OET advice | 40 hrs of lecture transcripts, indexed for retrieval |
| **Guardrails** | What it must never do, and when to hand off to a human | Explicit rules, enforced in code and prompt |

Fine-tuning on chat pairs is a possible **phase 4** optimisation. It is the last
15%, not the first 80%, and should not be attempted before the retrieval layer
is working and measured.

---

## 2. Decisions locked

| Decision | Choice |
|---|---|
| Persona | "Dr Nasir team" — the academy's voice, not an individual doctor |
| Tone | Direct but **softened** from raw WhatsApp bluntness |
| Roles | Doubt-solver + tutor/coach + sales agent (three modes, one voice) |
| Trigger | Reactive only — never messages first |
| Surfaces | Student portal, public website, WhatsApp Cloud API |
| Pricing | Free to everyone, with per-visitor caps on the public tier |
| Modality | Text only |
| Knowledge | 40 hrs English transcripts, evergreen, never dated in answers, rights owned |
| Personalisation | Yes — logged-in students' scores, weak skills, exam date |
| Writing marking | **Out of scope**, handled separately by Dr Nasir |
| Sales outcome | Capture lead + notify team; humans close |
| Prices | AI may state them |
| Discounts | Allowed only under conditions Dr Nasir supplies |
| Escalation | Admin queue inside the existing platform dashboard |
| Public tier | Full-quality answers, hard daily cap per visitor |
| AI disclosure | **Only when directly asked** (see §10, Risk R1) |
| Teaching style | Pushes students to reason rather than handing over answers |

### Chat-data handling (fixed constraint)

The WhatsApp archive is used **offline only**, to extract a voice-and-objections
guide. Raw chats never enter the running system and never enter the vector
store. Names, phone numbers and identifiers are stripped before bulk reading.
Chats touching payments, refunds, complaints, visas/immigration, or personal and
medical disclosures are excluded from the read entirely.

The assistant learns *how the team talks* — never *what any individual student
said*. Students span all regions including the UK and EU, so this constraint is
what keeps the build clean regardless of what the original consent covered.

---

## 3. Architecture

```
                    ┌──────────────────────────────────────┐
  Portal chat ──┐   │           Assistant Service          │
  Public widget ├──▶│                                      │
  WhatsApp      ┘   │  1. Identify  → student / anon / wa  │
                    │  2. Route     → doubt | coach | sales│
                    │  3. Retrieve  → pgvector top-k       │
                    │  4. Context   → student's own data   │
                    │  5. Generate  → persona + guardrails │
                    │  6. Post-check→ escalate? capture?   │
                    └──────────────┬───────────────────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 ▼                 ▼                 ▼
          Conversation log   Lead capture      Escalation queue
                                   └──── Admin dashboard ────┘
```

### The three modes

The router picks a mode per message from who is asking and what they asked.

**Doubt-solver** — a student asks why an answer is wrong, or about a lecture
point. Retrieves from transcripts, explains using the academy's method, and
prefers a leading question over a handed-over answer.

**Coach** — motivation, study planning, "am I ready", "I keep failing". Reads
the student's real scores and weak sub-skills. This is where the softened voice
matters most.

**Sales** — pricing, comparisons, "is it worth it". Handles objections in the
team's own proven language, states prices, and captures a lead.

**Sales mode is disabled for logged-in students with an active subscription.**
A paying student's tutor must never upsell mid-question. This is a hard rule,
not a prompt suggestion.

### Retrieval

Postgres already runs the platform, so retrieval lives there via the `pgvector`
extension. No new database, no external vector service, one less thing for the
developer to maintain.

40 hrs of transcript is roughly 350–450k words → about 3,000–5,000 chunks after
overlap. Indexing cost is a one-off of a few dollars. Query cost is negligible.

Chunking preserves lecture and topic as metadata so answers can cite *which*
lecture a point comes from — without ever mentioning a date, per the evergreen
rule.

---

## 4. Data model

New Prisma models, following existing conventions in
`backend/src/database/schema.prisma`:

```prisma
enum AssistantSurface   { PORTAL  PUBLIC  WHATSAPP }
enum AssistantMode      { DOUBT   COACH   SALES     ESCALATED }
enum AssistantLeadStatus{ NEW     CONTACTED  CONVERTED  LOST }
enum EscalationReason   { UNKNOWN_ANSWER  DISTRESS  COMPLAINT  PRICING_EDGE  USER_REQUEST }

/// One conversation thread. `userId` is null for anonymous public visitors and
/// for WhatsApp numbers not yet matched to an account.
model AssistantConversation {
  id            String            @id @default(uuid())
  userId        String?
  surface       AssistantSurface
  visitorKey    String?           // hashed IP+UA (public) or phone hash (WhatsApp)
  mode          AssistantMode     @default(DOUBT)
  escalatedAt   DateTime?
  escalationReason EscalationReason?
  handledAt     DateTime?
  handledBy     String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  messages      AssistantMessage[]
  lead          AssistantLead?

  @@index([userId])
  @@index([surface, escalatedAt])
  @@index([visitorKey])
}

model AssistantMessage {
  id             String   @id @default(uuid())
  conversationId String
  role           String   // "user" | "assistant"
  content        String   @db.Text
  mode           AssistantMode?
  sourceChunkIds String[]         // transcript chunks used — for auditing answers
  tokensIn       Int?
  tokensOut      Int?
  createdAt      DateTime @default(now())

  conversation   AssistantConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
}

/// Captured prospect. The team closes the sale; the AI never transacts.
model AssistantLead {
  id             String   @id @default(uuid())
  conversationId String   @unique
  name           String?
  email          String?
  whatsapp       String?
  interestedIn   String?             // product/course mentioned
  mainObjection  String?             // detected objection, for follow-up
  status         AssistantLeadStatus @default(NEW)
  notes          String?  @db.Text
  createdAt      DateTime @default(now())

  conversation   AssistantConversation @relation(fields: [conversationId], references: [id])
  @@index([status, createdAt])
}

/// Indexed lecture transcript. `embedding` needs pgvector — added by raw SQL
/// migration, since Prisma has no native vector type.
model AssistantKnowledgeChunk {
  id           String   @id @default(uuid())
  lectureId    String?                  // links to CourseLecture where known
  sourceTitle  String
  topic        String?
  skill        Skill?
  content      String   @db.Text
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@index([isActive, skill])
}

/// Durable per-visitor daily cap. The existing RateLimitService is in-memory,
/// so it resets on deploy and does not hold across multiple instances.
model AssistantUsageCounter {
  id         String   @id @default(uuid())
  visitorKey String
  dayKey     Int
  count      Int      @default(0)

  @@unique([visitorKey, dayKey])
  @@index([dayKey])
}
```

---

## 5. Backend

New module `backend/src/modules/assistant/`, matching the existing service
pattern and registered in `backend/src/http/container.ts`:

- `assistant.service.ts` — orchestration: identify → route → retrieve → generate
- `assistant-persona.ts` — the voice guide and per-mode system prompts
- `assistant-retrieval.service.ts` — pgvector search over transcript chunks
- `assistant-guardrails.ts` — pre- and post-checks, escalation triggers
- `assistant-ingest.service.ts` — transcript chunking and embedding (admin-run)
- `whatsapp.service.ts` — Cloud API webhook verification, receive, send

Routes in `backend/src/http/routes/assistant.router.ts`:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/assistant/chat` | optional | Send a message, get a reply |
| `GET` | `/assistant/conversations/:id` | owner | Load thread history |
| `POST` | `/assistant/lead` | public | Submit captured contact details |
| `POST` | `/assistant/whatsapp/webhook` | signature | Inbound WhatsApp messages |
| `GET` | `/assistant/whatsapp/webhook` | token | Meta's verification handshake |
| `GET` | `/admin/assistant/escalations` | ADMIN | Escalation queue |
| `POST` | `/admin/assistant/escalations/:id/handle` | ADMIN | Mark handled |
| `GET` | `/admin/assistant/leads` | ADMIN | Lead list with filters |
| `PATCH` | `/admin/assistant/leads/:id` | ADMIN | Update lead status/notes |
| `POST` | `/admin/assistant/ingest` | ADMIN | Index or re-index transcripts |
| `GET` | `/admin/assistant/usage` | ADMIN | Token spend and volume |

Model access uses the Anthropic API. Recommended split:

- **Portal + WhatsApp** (known students, higher value): the stronger model
- **Public anonymous**: a cheaper tier, still full-quality answers per the
  chosen public policy, with the daily cap doing the cost control

Both are one config change, so this can be tuned after seeing real traffic.

---

## 6. Frontend

- **Portal** — chat panel in the student dashboard, reusing the existing
  shadcn/Radix primitives already in `frontend/`. Sees the student's scores,
  weak skills, subscription tier and exam date.
- **Public site** — floating chat widget. Cold start, no visitor profile.
  Counter shows remaining messages as the cap approaches, then invites signup.
- **Admin** — two new screens: **Escalations** (queue, filters, mark handled)
  and **Leads** (status pipeline, detected objection, full transcript).

---

## 7. WhatsApp

Requires **WhatsApp Cloud API**. Two things to plan for before committing:

1. Migrating the number to the Cloud API means **losing the WhatsApp Business
   App** on that number. It is one or the other, and it is a one-way door.
2. Outside a 24-hour window from the student's last message, only pre-approved
   template messages may be sent. Since the assistant is reactive, this is
   mostly a non-issue — but it does mean escalation follow-ups landing more than
   24 hrs later need an approved template.

Inbound numbers are matched against `User.whatsapp` to personalise for existing
students; unmatched numbers are treated as public-tier visitors.

Recommendation: launch portal-first, add WhatsApp once the voice is proven. It
is the surface with the most external dependencies and the least reversible
setup.

---

## 8. Guardrails

**Never, in any mode:**
- Predict a student's OET grade or guarantee a pass
- Give visa, immigration or legal advice
- Give clinical or medical advice
- Quote a price it is not certain of
- Disparage a named competitor
- State or imply a date for lecture material
- Invent a pass-rate or outcome statistic

**Sales floor (agreed):** no fake scarcity, no invented deadlines, no pass
guarantees, no unevidenced pass-rate claims, no naming competitors.

**Comparative claims.** "Students like you usually…" is permitted **only when
computed from real data already in the platform** — actual score progression for
comparable students, read from `TestResult`. Never generated from the model's
imagination. This reconciles the agreed sales floor with the approved use of
social proof: the line stays persuasive because it stays true.

**Escalation to a human when:** the answer is not in the knowledge base; a
complaint or refund request appears; a pricing question falls outside the
supplied rules; the student asks for a human.

**Distress.** Exam despair — "I've failed five times, I'm done" — gets
motivation in the team's voice, as directed. Signals of **self-harm** are a
narrow, separate branch: the coaching voice drops, the response is plainly
human, appropriate support resources are surfaced, and a real person is alerted
immediately. This trigger should fire rarely; it exists so that the one time it
matters, the system does not respond with study tips.

---

## 9. Cost and abuse control

Public traffic is free and unauthenticated, which is the main cost exposure.
Controls:

- Hard daily message cap per visitor key (chosen policy)
- Durable counter in Postgres, not the in-memory `RateLimitService`
- Per-conversation token ceiling and reply length limit
- Monthly spend ceiling with admin alert, and an automatic degrade to a cheaper
  model if breached rather than a hard outage
- Prompt-injection filtering on public input

Rough expectation: portal + WhatsApp for a few hundred students lands around
$50–150/month. Public traffic is the variable — the cap is what keeps it
bounded, and the usage dashboard is what makes it visible before it is a
surprise.

---

## 10. Open risks

**R1 — AI disclosure is "only when asked".** This is a recorded product
decision, made with the trade-off understood. The exposure: EU/UK chatbot
transparency rules and California's bot-disclosure rule (which applies
specifically to bots that push a sale, as this one does) point toward proactive
disclosure, and students span all regions. The mitigation available at any time
is one line under the chat header — a small change, deliberately built so it can
be switched on with a config flag rather than a rewrite. Flagged once here for
the record; revisit if EU marketing expands.

**R2 — Voice quality is the whole product.** If it does not sound like the team,
none of the architecture matters. Phase 1 should be judged on blind-read
comparisons against real replies, not on whether the pipeline runs.

**R3 — WhatsApp number migration is irreversible.** Decide deliberately.

**R4 — Transcript quality is unverified.** Cleanup effort is unknown until
samples are reviewed.

---

## 11. Build order

**Phase 1 — Voice and knowledge (highest risk, do first)**
Extract the voice guide offline from the chat archive. Ingest and index the 40
hrs of transcripts. Ship a portal-only doubt-solver behind an admin flag. Judge
it on blind comparisons against real replies before building anything else.

**Phase 2 — Coach and personalisation**
Wire in the student's own scores, weak skills and exam date. Add mode routing.
Add escalation and the admin queue.

**Phase 3 — Sales and public surface**
Sales mode with the supplied objections and pricing. Public widget with caps.
Lead capture and the admin lead pipeline.

**Phase 4 — WhatsApp**
Cloud API migration, webhook, number matching. Last, because it is the least
reversible.

**Phase 5 — Optional fine-tuning**
Only if the voice still is not right after Phase 1 has been measured.

---

## 12. Still needed from Dr Nasir

Blocking Phase 1:

1. **Lecture transcripts** — 3–5 samples first to check format and cleanup need
2. **WhatsApp exports** — the `.txt` archives, for offline voice extraction

Blocking Phase 3:

3. **Course and price list** — exact names, prices, what each includes
4. **Objection replies** — the real wording that works, for: too expensive /
   free YouTube / failed with another academy / no time / Writing only
5. **Converted sales conversations** — 20–30 is enough to extract the pattern
6. **Discount rules** — when a discount may be offered, and who authorises it

Blocking Phase 2:

7. **Escalation ownership** — who works the admin queue, and working hours, so
   the assistant can set an honest expectation about reply time

Not blocking, but needed for cost planning:

8. **Rough active student count and public traffic volume**
