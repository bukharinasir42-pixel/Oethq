import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";
import { chunkDocument, type DraftChunk } from "./chunker";

export type RetrievedChunk = {
  id: string;
  heading: string | null;
  content: string;
  sourceName: string;
  rank: number;
};

/**
 * Words that carry no retrieval signal. Postgres already strips English stop
 * words inside `to_tsvector`, but the OR query below is built in TypeScript, and
 * a query of "how do I" that survives to `to_tsquery` matches every passage in
 * the corpus and ranks them all identically.
 */
const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "this", "that", "have", "has",
  "was", "were", "can", "could", "would", "should", "will", "from", "what", "when", "where", "who",
  "how", "why", "does", "did", "get", "got", "any", "all", "about", "into", "than", "then", "them",
  "there", "their", "been", "being", "just", "like", "more", "most", "some", "such", "only", "own",
  "same", "too", "very", "want", "need", "please", "tell", "know", "let", "hi", "hello", "hey",
  "thanks", "thank", "sir", "maam", "mam", "ok", "okay", "yes", "yeah", "yep", "nope"
]);

/** Query terms, cleaned so nothing reaches `to_tsquery` that could break it. */
export function queryTerms(question: string): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        // Everything but letters, digits and spaces goes — which also removes
        // every character that means something to tsquery (& | ! : * ( ) < >).
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !STOP.has(t))
    )
  ).slice(0, 12);
}

export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rank the corpus against a question.
   *
   * Two queries in one pass, because they fail in opposite directions:
   *
   *  - `websearch_to_tsquery` is AND-ish. Precise, and returns nothing at all
   *    for a normal spoken question ("how much is the reading course for
   *    nurses") because no single passage contains every word.
   *  - an OR query over the significant terms always returns something, but a
   *    passage matching one common word outranks nothing.
   *
   * So: match on OR, rank on OR, and add a flat bonus to anything that ALSO
   * satisfies the strict query. Precision when it is available, recall always.
   */
  async search(question: string, limit = 6): Promise<RetrievedChunk[]> {
    const terms = queryTerms(question);
    if (terms.length === 0) return [];
    const orQuery = terms.join(" | ");
    const take = Math.min(Math.max(limit, 1), 20);

    return this.prisma.$queryRaw<RetrievedChunk[]>`
      WITH q AS (
        SELECT websearch_to_tsquery('english', ${question}) AS aq,
               to_tsquery('english', ${orQuery}) AS oq
      )
      SELECT c.id,
             c.heading,
             c.content,
             s.name AS "sourceName",
             (CASE WHEN c."searchVector" @@ q.aq THEN 2.0 ELSE 0.0 END)
               + ts_rank_cd(c."searchVector", q.oq)::float8 AS rank
      FROM "KnowledgeChunk" c
      JOIN "KnowledgeSource" s ON s.id = c."sourceId"
      CROSS JOIN q
      WHERE s."isActive"
        AND (c."searchVector" @@ q.oq OR c."searchVector" @@ q.aq)
      ORDER BY rank DESC, c."ordinal" ASC
      LIMIT ${take}`;
  }

  /**
   * Ingest one document as a new source.
   *
   * `searchVector` is written in the same INSERT as the row rather than by a
   * trigger or a generated column: a trigger is invisible to Prisma's migration
   * diff, and a chunk whose vector was written by a second statement is a chunk
   * that is unsearchable if that statement fails.
   */
  async ingestDocument(input: { name: string; kind?: string; text: string; maxChars?: number }) {
    const chunks = chunkDocument(input.text, input.maxChars);
    return this.ingestChunks({ name: input.name, kind: input.kind, chunks });
  }

  async ingestChunks(input: { name: string; kind?: string; chunks: DraftChunk[] }) {
    const chunks = input.chunks.filter((c) => c.content.trim().length > 0);
    if (chunks.length === 0) {
      throw new Error("Nothing to ingest — the document produced no passages.");
    }

    return this.prisma.$transaction(async (tx) => {
      const source = await tx.knowledgeSource.create({
        data: { name: input.name.slice(0, 200), kind: (input.kind || "document").slice(0, 40), chunkCount: chunks.length }
      });

      // One multi-row INSERT rather than a create-then-update-vector pair, so a
      // chunk can never exist in a state where it is stored but unsearchable.
      const values = chunks.map((c, i) =>
        Prisma.sql`(gen_random_uuid()::text, ${source.id}, ${i}, ${c.heading ?? null}, ${c.content},
          setweight(to_tsvector('english', coalesce(${c.heading ?? null}, '')), 'A') ||
          setweight(to_tsvector('english', ${c.content}), 'B'))`
      );
      await tx.$executeRaw`
        INSERT INTO "KnowledgeChunk" (id, "sourceId", ordinal, heading, content, "searchVector")
        VALUES ${Prisma.join(values)}`;

      return { sourceId: source.id, name: source.name, chunkCount: chunks.length };
    }, { timeout: 120_000 });
  }

  async listSources() {
    const rows = await this.prisma.knowledgeSource.findMany({ orderBy: { createdAt: "desc" } });
    const totalChunks = await this.prisma.knowledgeChunk.count();
    return { totalChunks, sources: rows };
  }

  async setSourceActive(id: string, isActive: boolean) {
    return this.prisma.knowledgeSource.update({ where: { id }, data: { isActive } });
  }

  async deleteSource(id: string) {
    await this.prisma.knowledgeSource.delete({ where: { id } });
    return { ok: true };
  }

  /** Chunks of one source, for the admin "what does it actually know" view. */
  async sourceChunks(id: string, take = 50, skip = 0) {
    const [total, items] = await Promise.all([
      this.prisma.knowledgeChunk.count({ where: { sourceId: id } }),
      this.prisma.knowledgeChunk.findMany({
        where: { sourceId: id },
        orderBy: { ordinal: "asc" },
        take: Math.min(Math.max(take, 1), 200),
        skip: Math.max(skip, 0),
        select: { id: true, ordinal: true, heading: true, content: true }
      })
    ]);
    return { total, items };
  }

  async isEmpty(): Promise<boolean> {
    const n = await this.prisma.knowledgeChunk.count({ where: { source: { isActive: true } } });
    return n === 0;
  }
}
