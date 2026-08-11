/**
 * chat.router.ts — the site assistant.
 *
 *   Public:  GET  /chat/config              (is the assistant switched on)
 *            POST /chat/message             (SSE stream of the reply)
 *            GET  /chat/conversations/:id   (own transcript, for a reload)
 *   Admin:   GET  /admin/chat/stats
 *            GET  /admin/chat/conversations
 *            GET  /admin/chat/conversations/:id
 *            GET/POST/PATCH/DELETE /admin/chat/knowledge…
 */
import { Router, type Response } from "express";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import { chunkConversation, chunkDocument, chunkQaJson } from "../../modules/chat/chunker";

/**
 * Per-hour message caps.
 *
 * The public widget spends real money on every message, so the anonymous cap is
 * the one that matters — it is the difference between a support tool and an
 * open-ended bill. Signed-in students are trusted further because they are
 * identifiable and have already paid.
 */
const ANON_MESSAGES_PER_HOUR = 30;
const USER_MESSAGES_PER_HOUR = 120;

/** Image formats Claude accepts. Anything else is dropped rather than rejected. */
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** ~4.5 MB of base64 is roughly a 3 MB photo — past that a phone camera dump. */
const MAX_IMAGE_CHARS = 4_500_000;

/**
 * Accept `data:image/png;base64,...` from the widget.
 *
 * Validated here rather than trusted: the base64 goes straight into an API call
 * that is billed by the token, so an oversized or bogus payload is a cost and a
 * failure, not just bad input.
 */
function parseImages(raw: unknown): Array<{ mediaType: string; data: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ mediaType: string; data: string }> = [];
  for (const item of raw.slice(0, 3)) {
    if (typeof item !== "string") continue;
    const m = /^data:([a-z]+\/[a-z+.-]+);base64,(.+)$/i.exec(item.trim());
    if (!m) continue;
    const mediaType = m[1].toLowerCase();
    const data = m[2];
    if (!IMAGE_TYPES.has(mediaType)) continue;
    if (data.length > MAX_IMAGE_CHARS) continue;
    out.push({ mediaType, data });
  }
  return out;
}

/** Server-Sent Events, written by hand: one small stream, no dependency needed. */
function openStream(res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  // `no-transform` matters as much as `no-cache`: a proxy that gzips this
  // buffers it, and a buffered stream arrives all at once at the end, which is
  // indistinguishable from the feature not working.
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

function send(res: Response, payload: unknown) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createChatRouter(c: AppContainer): Router {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const chat = c.chatService;
  const knowledge = c.knowledgeService;

  /** Resolve an optional bearer token — the widget serves visitors and students. */
  const optionalUser = async (authz: string | undefined): Promise<string | null> => {
    if (typeof authz !== "string" || !authz.startsWith("Bearer ")) return null;
    try {
      const payload = await c.jwtHelper.verifyAsync<{ sub: string }>(authz.slice(7).trim());
      return payload.sub;
    } catch {
      return null;
    }
  };

  r.get(
    "/chat/config",
    asyncHandler(async (_req, res) => {
      res.json({ enabled: chat.isConfigured(), knowledgeReady: !(await knowledge.isEmpty()) });
    })
  );

  r.post(
    "/chat/message",
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const images = parseImages(body.images);
      const visitorKey = typeof body.visitorKey === "string" ? body.visitorKey.trim() : "";
      const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;

      if (!message && images.length === 0) {
        res.status(400).json({ message: "Say something first." });
        return;
      }
      if (message.length > 4000) {
        res.status(400).json({ message: "That message is too long. Please shorten it." });
        return;
      }
      if (!chat.isConfigured()) {
        res.status(503).json({ message: "The assistant is not switched on yet." });
        return;
      }

      const userId = await optionalUser(req.headers.authorization);
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const limitKey = userId ? `chat-user:${userId}` : `chat-ip:${ip}`;
      const { allowed, retryAfterSeconds } = c.rateLimit.consume(
        limitKey,
        userId ? USER_MESSAGES_PER_HOUR : ANON_MESSAGES_PER_HOUR,
        3600
      );
      if (!allowed) {
        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(429).json({
          message: "You have sent a lot of messages in the last hour. Please try again shortly.",
          retryAfterSeconds
        });
        return;
      }

      const identity = { userId, visitorKey: visitorKey || null, ip };
      const conversation = await chat.resolveConversation(conversationId, identity);

      openStream(res);
      send(res, { type: "start", conversationId: conversation.id });

      // The student closing the tab must stop the generation, not leave it
      // running and billing against a reply nobody will read.
      const abort = new AbortController();
      req.on("close", () => abort.abort());

      try {
        const out = await chat.respond({
          conversationId: conversation.id,
          message,
          images,
          identity,
          signal: abort.signal,
          onDelta: (text) => send(res, { type: "delta", text }),
          onReplace: (text) => send(res, { type: "replace", text })
        });
        // `text` on the done frame is authoritative: the widget renders it
        // instead of its own accumulated deltas, so a stream that was cut short
        // cannot leave a half sentence on screen.
        send(res, { type: "done", text: out.text, handoff: out.handoff, error: out.errorCode });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[chat] stream failed:", e instanceof Error ? e.message : e);
        send(res, { type: "error", message: "Something went wrong. Please try again." });
      } finally {
        res.end();
      }
    })
  );

  /** Own transcript, so reopening the widget after a reload is not a blank box. */
  r.get(
    "/chat/conversations/:id",
    asyncHandler(async (req, res) => {
      const userId = await optionalUser(req.headers.authorization);
      const visitorKey = typeof req.query.visitorKey === "string" ? req.query.visitorKey : null;
      const conversation = await c.prisma.chatConversation.findUnique({ where: { id: req.params.id } });
      if (!conversation) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      const visitor = await c.attributionService.signalsForVisitor(visitorKey);
      const owns = conversation.userId
        ? conversation.userId === userId
        : Boolean(visitor?.id) && conversation.visitorId === visitor?.id;
      if (!owns) {
        res.status(403).json({ message: "Not your conversation" });
        return;
      }
      res.json({ id: conversation.id, messages: await chat.transcript(conversation.id) });
    })
  );

  // ---- Admin: conversations ----

  r.get(
    "/admin/chat/stats",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await chat.stats(req.query.days ? Number(req.query.days) : undefined));
    })
  );

  r.get(
    "/admin/chat/conversations",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(
        await chat.listConversations({
          channel: typeof req.query.channel === "string" ? req.query.channel : undefined,
          handoffOnly: req.query.handoffOnly === "true",
          search: typeof req.query.search === "string" ? req.query.search : undefined,
          take: req.query.take ? Number(req.query.take) : undefined,
          skip: req.query.skip ? Number(req.query.skip) : undefined
        })
      );
    })
  );

  r.get(
    "/admin/chat/conversations/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const detail = await chat.conversationDetail(req.params.id);
      if (!detail) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      res.json(detail);
    })
  );

  // ---- Admin: leads ----

  r.get(
    "/admin/chat/leads",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(
        await chat.listLeads({
          take: req.query.take ? Number(req.query.take) : undefined,
          skip: req.query.skip ? Number(req.query.skip) : undefined,
          uncontactedOnly: req.query.uncontactedOnly === "true"
        })
      );
    })
  );

  r.patch(
    "/admin/chat/leads/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await chat.markLeadContacted(req.params.id, Boolean((req.body ?? {}).contacted)));
    })
  );

  // ---- Admin: knowledge base ----

  r.get(
    "/admin/chat/knowledge",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await knowledge.listSources());
    })
  );

  r.get(
    "/admin/chat/knowledge/:id/chunks",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(
        await knowledge.sourceChunks(
          req.params.id,
          req.query.take ? Number(req.query.take) : undefined,
          req.query.skip ? Number(req.query.skip) : undefined
        )
      );
    })
  );

  /**
   * Ingest one document.
   *
   * `format` decides how it is split, and the split is what decides whether the
   * assistant can find anything later — so it is an explicit choice, not a guess
   * from the file extension.
   */
  r.post(
    "/admin/chat/knowledge",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof b.name === "string" ? b.name.trim() : "";
      const text = typeof b.text === "string" ? b.text : "";
      const format = typeof b.format === "string" ? b.format : "document";
      if (!name) {
        res.status(400).json({ message: "Give this batch a name so you can find it later." });
        return;
      }
      if (!text.trim()) {
        res.status(400).json({ message: "There is no text to ingest." });
        return;
      }

      try {
        const chunks =
          format === "conversation"
            ? chunkConversation(text)
            : format === "qa_json"
              ? chunkQaJson(text)
              : chunkDocument(text);
        const out = await knowledge.ingestChunks({
          name,
          kind: typeof b.kind === "string" ? b.kind : format,
          chunks
        });
        await c.auditService.record({
          actorUserId: (req as AuthedRequest).user.id,
          action: "chat.knowledge.ingest",
          entityType: "KnowledgeSource",
          entityId: out.sourceId,
          metadata: { name: out.name, chunkCount: out.chunkCount, format }
        });
        res.status(201).json(out);
      } catch (e) {
        res.status(400).json({ message: e instanceof Error ? e.message : "Could not ingest that." });
      }
    })
  );

  r.patch(
    "/admin/chat/knowledge/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const isActive = Boolean((req.body ?? {}).isActive);
      res.json(await knowledge.setSourceActive(req.params.id, isActive));
    })
  );

  r.delete(
    "/admin/chat/knowledge/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      await c.auditService.record({
        actorUserId: (req as AuthedRequest).user.id,
        action: "chat.knowledge.delete",
        entityType: "KnowledgeSource",
        entityId: req.params.id
      });
      res.json(await knowledge.deleteSource(req.params.id));
    })
  );

  /** Try a question against the index without spending a model call. */
  r.get(
    "/admin/chat/knowledge/search",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      res.json({ query: q, results: q ? await knowledge.search(q, 10) : [] });
    })
  );

  return r;
}
