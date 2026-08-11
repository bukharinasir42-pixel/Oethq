import Anthropic from "@anthropic-ai/sdk";
import { ChatRole, Prisma, type TrafficChannel } from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";
import type { AttributionService } from "../attribution/attribution.service";
import type { KnowledgeService, RetrievedChunk } from "./knowledge.service";
import {
  audienceBlock,
  baseInstructions,
  flowBlock,
  catalogueBlock,
  factsBlock,
  HANDOFF_MARKER,
  linkRulesBlock,
  referenceBlock,
  splitHandoff,
  splitLead,
  type Audience,
  type CatalogueFact,
  type ExtractedLead
} from "./chat-prompt";
import { guardLinks } from "./link-guard";

/**
 * Length of the longest suffix of `buf` that is a proper prefix of the handoff
 * marker — i.e. how many trailing characters might still turn into one and so
 * must not be streamed to the browser yet.
 */
function partialMarkerTail(buf: string): number {
  const max = Math.min(buf.length, HANDOFF_MARKER.length - 1);
  for (let k = max; k > 0; k--) {
    if (HANDOFF_MARKER.startsWith(buf.slice(buf.length - k))) return k;
  }
  return 0;
}

/**
 * The model. Opus 5 by default — it is the most careful about answering only
 * from what it was given, which is the whole job here.
 *
 * Overridable because the cost difference is real and this is a support bot
 * reading from passages already in its context, not a reasoning task:
 *   claude-sonnet-5   — roughly half the price
 *   claude-haiku-4-5  — roughly a fifth
 * Change it, then read the answers in Admin → Assistant before deciding.
 */
const MODEL = process.env.ANTHROPIC_CHAT_MODEL?.trim() || "claude-opus-5";

/** List price per million tokens, for the spend estimate on the admin page. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 }
};

/**
 * A support answer that runs long is a support answer nobody reads, and output
 * tokens are the expensive half. 700 is about 500 words — far more than any
 * good answer to "how much is the reading course" needs.
 */
const MAX_TOKENS = 700;

/** Turns of history sent back. Enough to follow a thread, bounded so cost is. */
const HISTORY_TURNS = 12;

/**
 * Replies a VISITOR thread gets before it closes.
 *
 * A sales conversation that has not reached a recommendation in ten replies is
 * not going to, and every further message costs money while making the visitor
 * less likely to act. The prompt paces towards a close by reply 8 to 10; this is
 * the backstop that makes the budget real.
 *
 * Signed-in students are NOT capped. Cutting off a paying student in the middle
 * of a problem is a support failure, and there is nothing to "lead them to" —
 * they have already bought.
 */
const VISITOR_REPLY_BUDGET = 10;

/** What a closed visitor thread says, without spending a model call to say it. */
const BUDGET_REACHED_REPLY =
  "We have covered a lot here, so let me hand you to the team to take it from the top. Send us a message on the contact page with your sub-test and your exam date and someone will pick it up personally. Everything is on oethq.com when you are ready.";

/** Passages retrieved per question. */
const RETRIEVE_K = 6;

/**
 * Images accepted per message. Students send a score report, occasionally a
 * two-page one. Beyond that it is someone emptying their camera roll, and every
 * image is billed.
 */
const MAX_IMAGES = 3;

/** Cache the catalogue rather than hitting the database on every message. */
const CATALOGUE_TTL_MS = 5 * 60 * 1000;

const FALLBACK_REPLY =
  "Sorry — I could not reach the assistant just then. Please try again in a moment, or email us and a person will pick it up.";

export type ChatIdentity = {
  userId?: string | null;
  visitorKey?: string | null;
  ip?: string | null;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * ChatService — the site assistant.
 *
 * The API key is read from the environment and never leaves this process. There
 * is deliberately no route that returns it, no route that proxies an arbitrary
 * prompt, and no path by which the browser talks to Anthropic directly: a key in
 * the frontend bundle is a key anyone can spend.
 *
 * Extended thinking is NOT enabled. It earns its latency on multi-step
 * reasoning; this is retrieval-grounded question answering where the facts are
 * already in the context window, and a chat widget that takes eight seconds to
 * start typing reads as broken.
 */
export class ChatService {
  private client: Anthropic | null = null;
  private catalogue: { at: number; facts: CatalogueFact[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly attribution: AttributionService
  ) {}

  /** True when the assistant is configured. Drives the widget's visibility. */
  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  private anthropic(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not set — the assistant is switched off.");
      }
      this.client = new Anthropic({ apiKey, maxRetries: 2 });
    }
    return this.client;
  }

  // ------------------------------------------------------------- conversation

  /**
   * Find or create the thread this message belongs to.
   *
   * A conversation id is sent by the browser, so it is a claim, not proof.
   * Ownership is re-checked on every message: a signed-in thread must match the
   * bearer token, and an anonymous thread must match the browser's visitor row.
   * Failing the check silently starts a NEW thread rather than erroring — the
   * legitimate reason to fail is a student who cleared storage, and they should
   * get a working chat box, not a 403.
   */
  async resolveConversation(id: string | null | undefined, identity: ChatIdentity) {
    const visitor = await this.attribution.signalsForVisitor(identity.visitorKey);

    if (id) {
      const existing = await this.prisma.chatConversation.findUnique({ where: { id } });
      if (existing) {
        const ownsIt = existing.userId
          ? existing.userId === identity.userId
          : Boolean(visitor?.id) && existing.visitorId === visitor?.id;
        if (ownsIt) return existing;
      }
    }

    return this.prisma.chatConversation.create({
      data: {
        userId: identity.userId ?? null,
        visitorId: visitor?.id ?? null,
        channel: (visitor?.firstChannel as TrafficChannel | undefined) ?? null,
        source: visitor?.firstSource ?? null,
        campaign: visitor?.firstCampaign ?? null,
        landingPath: visitor?.firstLandingPath ?? null
      }
    });
  }

  async history(conversationId: string): Promise<ChatTurn[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId, errorCode: null },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TURNS,
      select: { role: true, content: true }
    });
    return rows
      .reverse()
      .map((m) => ({ role: m.role === ChatRole.USER ? ("user" as const) : ("assistant" as const), content: m.content }));
  }

  async transcript(conversationId: string) {
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true, errorCode: true }
    });
  }

  // ------------------------------------------------------------------ prompt

  private async catalogueFacts(): Promise<CatalogueFact[]> {
    if (this.catalogue && Date.now() - this.catalogue.at < CATALOGUE_TTL_MS) {
      return this.catalogue.facts;
    }
    const facts: CatalogueFact[] = [];
    try {
      const [plans, products] = await Promise.all([
        this.prisma.plan.findMany({ where: { isActive: true, isCustom: false }, orderBy: { price: "asc" } }),
        this.prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { price: "asc" } })
      ]);
      for (const p of plans) {
        facts.push({
          name: `${p.name} (Complete Course)`,
          price: `${p.currency} ${p.price.toFixed(2)} for ${p.durationDays} days`,
          summary: p.description
        });
      }
      for (const p of products) {
        // A product with no price set is deliberately listed as "not on sale"
        // rather than omitted: the model needs to know the course exists so it
        // can say "that one is not open for enrolment yet" instead of denying it.
        facts.push({
          name: p.name,
          price: p.price ? `${p.currency} ${p.price.toFixed(2)}` : "price not published yet",
          summary: p.shortDescription ?? null
        });
      }
    } catch {
      /* a catalogue read failure must not take the assistant down; the prompt
         then tells the model it has no prices rather than letting it invent one */
    }
    this.catalogue = { at: Date.now(), facts };
    return facts;
  }

  /**
   * The system prompt, in four blocks with the cache breakpoint after the third.
   *
   * Ordering is what makes caching work: prompt caching matches on an exact
   * PREFIX, so the blocks are arranged strictly from never-changing to
   * changes-every-message. Instructions, verified facts and the link allowlist
   * are byte-identical on every request and sit before the breakpoint; the live
   * catalogue changes only when a price is edited; the audience block differs
   * per person and must come last or it would invalidate everything ahead of it.
   */
  private async buildSystem(audience: Audience) {
    const facts = await this.catalogueFacts();
    return [
      { type: "text" as const, text: baseInstructions() },
      { type: "text" as const, text: factsBlock() },
      { type: "text" as const, text: linkRulesBlock() },
      // First breakpoint: everything to here is identical for EVERY person, so
      // all four flow variants below share this one cache entry instead of each
      // paying to store its own copy of the 6,000-token facts block.
      { type: "text" as const, text: catalogueBlock(facts), cache_control: { type: "ephemeral" as const } },
      // Second breakpoint. The flow script is large and has only four possible
      // values, so caching it keeps almost the entire prompt out of the
      // full-rate charge; only the one-line audience block below is billed in
      // full on every message.
      { type: "text" as const, text: flowBlock(audience), cache_control: { type: "ephemeral" as const } },
      { type: "text" as const, text: audienceBlock(audience) }
    ];
  }

  // -------------------------------------------------------------------- reply

  /**
   * Answer one message, streaming the text out through `onDelta`.
   *
   * The student's message is persisted BEFORE the model is called, and the
   * answer after: a crash mid-generation must leave a question in the transcript
   * with a visible failure against it, not a silent gap that looks like the
   * student never asked.
   */
  async respond(params: {
    conversationId: string;
    message: string;
    identity: ChatIdentity;
    /**
     * Images the person attached, as base64. Sent to the model and then
     * discarded — a score report is a medical-adjacent document and there is no
     * reason for this application to become its archive.
     */
    images?: Array<{ mediaType: string; data: string }>;
    onDelta: (text: string) => void;
    /**
     * Called when the final answer is not what was streamed — a refusal or an
     * outage, where the text is decided only after the stream ends. Without it
     * the student is left looking at an empty bubble, which reads as a broken
     * widget rather than as an answer.
     */
    onReplace?: (text: string) => void;
    signal?: AbortSignal;
  }): Promise<{
    text: string;
    handoff: boolean;
    chunks: RetrievedChunk[];
    errorCode: string | null;
    lead: ExtractedLead | null;
  }> {
    const { conversationId, identity, onDelta } = params;
    const message = params.message.trim().slice(0, 4000);
    const startedAt = Date.now();

    const user = identity.userId
      ? await this.prisma.user.findUnique({
          where: { id: identity.userId },
          select: { name: true, profession: true }
        })
      : null;

    const priorTurns = await this.history(conversationId);
    const convo = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { leadAskedCount: true, leadCapturedAt: true, channel: true, source: true, messageCount: true }
    });
    const isStudentThread = Boolean(identity.userId);
    // Replies already given, from the stored pair count.
    const repliesSoFar = Math.floor((convo?.messageCount ?? 0) / 2);
    const replyNumber = repliesSoFar + 1;
    const images = (params.images ?? []).slice(0, MAX_IMAGES);

    await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId,
          role: ChatRole.USER,
          content: message || (images.length ? "(sent an image)" : ""),
          attachmentCount: images.length
        }
      }),
      this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 1 },
          lastMessageAt: new Date(),
          title: priorTurns.length === 0 ? message.slice(0, 120) : undefined,
          // A signed-in student may have started the thread anonymously.
          userId: identity.userId ?? undefined
        }
      })
    ]);

    // Budget spent. Close the thread without calling the model at all: the
    // answer is fixed, so paying for it would be paying to generate a sentence
    // we already know. The question is still stored above, so the transcript
    // shows what they asked when the chat ran out.
    if (!isStudentThread && replyNumber > VISITOR_REPLY_BUDGET) {
      const closing = BUDGET_REACHED_REPLY;
      params.onReplace?.(closing);
      await this.prisma.$transaction([
        this.prisma.chatMessage.create({
          data: {
            conversationId,
            role: ChatRole.ASSISTANT,
            content: closing,
            latencyMs: Date.now() - startedAt,
            errorCode: "budget_reached"
          }
        }),
        this.prisma.chatConversation.update({
          where: { id: conversationId },
          data: { messageCount: { increment: 1 }, lastMessageAt: new Date(), handoffAt: new Date() }
        })
      ]);
      return { text: closing, handoff: true, chunks: [], errorCode: "budget_reached", lead: null };
    }

    let chunks: RetrievedChunk[] = [];
    try {
      chunks = await this.knowledge.search(message, RETRIEVE_K);
    } catch {
      /* an empty or broken index degrades to "I don't know", not to a 500 */
    }

    const isStudent = isStudentThread;
    const system = await this.buildSystem({
      name: user?.name ?? null,
      profession: user?.profession ?? null,
      isStudent,
      timesAsked: convo?.leadAskedCount ?? 0,
      hasLead: Boolean(convo?.leadCapturedAt),
      replyNumber,
      replyBudget: VISITOR_REPLY_BUDGET
    });

    // Images ride in the same user turn as the question. They come FIRST:
    // Claude reads a prompt that follows its images more reliably than one that
    // precedes them, and "read the scores off this" only means something once
    // the picture is in view.
    const askText = `${referenceBlock(chunks)}\n\n---\n\nTHE PERSON ASKS:\n${message || "(no text, see the attached image)"}`;
    const userContent: Anthropic.ContentBlockParam[] = [
      ...images.map(
        (img) =>
          ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType as "image/png", data: img.data }
          })
      ),
      { type: "text" as const, text: askText }
    ];

    const messages: Anthropic.MessageParam[] = [
      ...priorTurns.map((t) => ({ role: t.role, content: t.content })),
      { role: "user" as const, content: images.length ? userContent : askText }
    ];

    let raw = "";
    /** Characters actually pushed to the browser, so a silent stream is visible. */
    let emitted = 0;
    let errorCode: string | null = null;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let cacheReadTokens: number | null = null;

    try {
      const stream = this.anthropic().messages.stream(
        { model: MODEL, max_tokens: MAX_TOKENS, system, messages },
        params.signal ? { signal: params.signal } : undefined
      );

      // The handoff marker must never flash on screen. Stripping it only after
      // the stream finishes is too late — it streams token by token, so
      // "[[HAND" would be visible for a second and then vanish. Deltas are
      // therefore held back while their tail could still be the start of one.
      let pending = "";
      const emitSafely = (flush: boolean) => {
        let idx = pending.indexOf(HANDOFF_MARKER);
        while (idx !== -1) {
          if (idx > 0) onDelta(pending.slice(0, idx));
          pending = pending.slice(idx + HANDOFF_MARKER.length);
          idx = pending.indexOf(HANDOFF_MARKER);
        }
        const keep = flush ? 0 : partialMarkerTail(pending);
        const send = pending.slice(0, pending.length - keep);
        if (send) {
          emitted += send.length;
          onDelta(send);
        }
        pending = pending.slice(pending.length - keep);
      };

      stream.on("text", (delta) => {
        raw += delta;
        pending += delta;
        emitSafely(false);
      });

      const final = await stream.finalMessage();
      emitSafely(true);

      // A refusal carries no usable content; reading `content[0].text` would
      // throw or, worse, surface an empty bubble that looks like a bug.
      if (final.stop_reason === "refusal") {
        errorCode = "refusal";
        raw =
          "I can't help with that one. If it is about the course, your account or your payment, say the word and I will put you through to a person.";
      }

      inputTokens = final.usage?.input_tokens ?? null;
      outputTokens = final.usage?.output_tokens ?? null;
      cacheReadTokens = final.usage?.cache_read_input_tokens ?? null;
    } catch (e) {
      errorCode = e instanceof Anthropic.APIError ? `api_${e.status ?? "error"}` : "error";
      // eslint-disable-next-line no-console
      console.error("[chat] Claude call failed:", e instanceof Error ? e.message : e);
      if (!raw) raw = FALLBACK_REPLY;
    }

    // Post-processing order matters. The lead marker comes out first so a
    // number inside it is never treated as prose; links are guarded next, so a
    // rewritten link is what gets stored and shown; the handoff marker is last
    // because it is always on its own final line.
    const afterLead = splitLead(raw || FALLBACK_REPLY);
    const guarded = guardLinks(afterLead.text);
    const { text, handoff } = splitHandoff(guarded.text);
    const lead = afterLead.lead;

    if (guarded.rewritten.length > 0) {
      // Worth seeing: if the model keeps reaching for a path that does not
      // exist, the allowlist is missing something real.
      // eslint-disable-next-line no-console
      console.warn(`[chat] rewrote ${guarded.rewritten.length} unlisted link(s):`, guarded.rewritten.join(", "));
    }

    // The streamed text is now stale — a link was rewritten, or a marker was
    // removed mid-sentence. Correct the bubble rather than leaving a dead URL
    // on screen.
    if (emitted === 0 && text) params.onReplace?.(text);
    else if (text !== raw.trim()) params.onReplace?.(text);

    await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId,
          role: ChatRole.ASSISTANT,
          content: text,
          citedChunkIds: chunks.map((c) => c.id),
          inputTokens,
          outputTokens,
          cacheReadTokens,
          latencyMs: Date.now() - startedAt,
          errorCode
        }
      }),
      this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 1 },
          lastMessageAt: new Date(),
          handoffAt: handoff ? new Date() : undefined,
          // The script allows two asks and no more, so the count has to survive
          // between messages. Incremented when the reply actually asked.
          leadAskedCount:
            !isStudent && !convo?.leadCapturedAt && !lead && this.asksForNumber(text)
              ? { increment: 1 }
              : undefined,
          leadCapturedAt: lead?.whatsapp ? new Date() : undefined
        }
      })
    ]);

    if (lead?.whatsapp) {
      await this.saveLead(conversationId, lead, convo?.channel ?? null, convo?.source ?? null);
    }

    return { text, handoff, chunks, errorCode, lead: lead ?? null };
  }

  /**
   * Did this reply actually ask for a number?
   *
   * The two-ask limit only means something if the counter tracks real asks. It
   * cannot be incremented on every turn (the limit would be spent in two
   * messages whether or not it ever asked), and the model cannot be trusted to
   * report it. Reading the reply is the only honest signal.
   */
  private asksForNumber(reply: string): boolean {
    const t = reply.toLowerCase();
    const asks = /\?/.test(reply);
    const aboutNumber = /(whatsapp|what'?s app|contact number|phone number|mobile number|your number)/.test(t);
    return asks && aboutNumber;
  }

  /**
   * Store a captured lead.
   *
   * Upserted on the conversation: the script asks at most twice, so a second
   * number in the same thread is a correction, not a second person.
   */
  private async saveLead(
    conversationId: string,
    lead: ExtractedLead,
    channel: TrafficChannel | null,
    source: string | null
  ) {
    const whatsapp = (lead.whatsapp ?? "").trim().slice(0, 40);
    // Guard against the model echoing its own template ("THE NUMBER") or
    // capturing a fragment. Six digits is below any real number and well above
    // anything that appears by accident.
    if (whatsapp.replace(/\D/g, "").length < 6) return;
    try {
      const data = {
        whatsapp,
        name: lead.name?.slice(0, 120) ?? null,
        profession: lead.profession?.slice(0, 80) ?? null,
        examDate: lead.exam?.slice(0, 60) ?? null,
        channel,
        source
      };
      await this.prisma.chatLead.upsert({
        where: { conversationId },
        create: { conversationId, ...data },
        update: data
      });
    } catch (e) {
      // A lead that fails to save must not fail the reply the student is reading.
      // eslint-disable-next-line no-console
      console.error("[chat] could not save lead:", e instanceof Error ? e.message : e);
    }
  }

  // ------------------------------------------------------------------- admin

  async listLeads(opts: { take?: number; skip?: number; uncontactedOnly?: boolean } = {}) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    const where = opts.uncontactedOnly ? { contactedAt: null } : {};
    const [total, items] = await Promise.all([
      this.prisma.chatLead.count({ where }),
      this.prisma.chatLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip: Math.max(opts.skip ?? 0, 0),
        include: { conversation: { select: { id: true, title: true, messageCount: true, lastMessageAt: true } } }
      })
    ]);
    return { total, items };
  }

  async markLeadContacted(id: string, contacted: boolean) {
    return this.prisma.chatLead.update({
      where: { id },
      data: { contactedAt: contacted ? new Date() : null }
    });
  }

  async listConversations(opts: { channel?: string; handoffOnly?: boolean; search?: string; take?: number; skip?: number } = {}) {
    const take = Math.min(Math.max(opts.take ?? 40, 1), 200);
    const skip = Math.max(opts.skip ?? 0, 0);
    const where: Prisma.ChatConversationWhereInput = {};
    if (opts.channel) where.channel = opts.channel as TrafficChannel;
    if (opts.handoffOnly) where.handoffAt = { not: null };
    if (opts.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
        { user: { is: { email: { contains: q, mode: "insensitive" } } } }
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.chatConversation.count({ where }),
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        take,
        skip,
        include: { user: { select: { id: true, name: true, email: true } } }
      })
    ]);
    return { total, take, skip, items };
  }

  async conversationDetail(id: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } }
      }
    });
    return conversation;
  }

  /** Volume, cost and answer-quality counters for the admin header. */
  async stats(days = 30) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [convos, handoffs, msgs, tokens] = await Promise.all([
      this.prisma.chatConversation.count({ where: { startedAt: { gte: from } } }),
      this.prisma.chatConversation.count({ where: { startedAt: { gte: from }, handoffAt: { not: null } } }),
      this.prisma.chatMessage.count({ where: { createdAt: { gte: from } } }),
      this.prisma.chatMessage.aggregate({
        where: { createdAt: { gte: from }, role: ChatRole.ASSISTANT },
        _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true },
        _avg: { latencyMs: true }
      })
    ]);

    const inTok = tokens._sum.inputTokens ?? 0;
    const outTok = tokens._sum.outputTokens ?? 0;
    const cachedTok = tokens._sum.cacheReadTokens ?? 0;
    // Cache reads bill at 10% of the input rate.
    const price = PRICING[MODEL] ?? PRICING["claude-opus-5"];
    const estimatedCostUsd =
      ((inTok - cachedTok) / 1_000_000) * price.input +
      (cachedTok / 1_000_000) * (price.input * 0.1) +
      (outTok / 1_000_000) * price.output;

    return {
      days,
      model: MODEL,
      conversations: convos,
      handoffs,
      messages: msgs,
      inputTokens: inTok,
      outputTokens: outTok,
      cacheReadTokens: cachedTok,
      avgLatencyMs: Math.round(tokens._avg.latencyMs ?? 0),
      estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100
    };
  }
}
