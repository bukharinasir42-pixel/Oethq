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
/** Term rarity only changes on ingest; recomputed then, and hourly as a backstop. */
const DF_TTL_MS = 60 * 60 * 1000;

const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "this", "that", "have", "has",
  "was", "were", "can", "could", "would", "should", "will", "from", "what", "when", "where", "who",
  "how", "why", "does", "did", "get", "got", "any", "all", "about", "into", "than", "then", "them",
  "there", "their", "been", "being", "just", "like", "more", "most", "some", "such", "only", "own",
  "same", "too", "very", "want", "need", "please", "tell", "know", "let", "hi", "hello", "hey",
  "thanks", "thank", "sir", "maam", "mam", "ok", "okay", "yes", "yeah", "yep", "nope",
  // Hollow verbs and fillers. These survive IDF weighting because they are not
  // quite common enough to be discounted, while carrying no meaning at all:
  // "give me tips", "do you give refunds" and "give the whole test again" are
  // three unrelated questions that a density score happily groups together.
  "give", "gives", "given", "giving", "make", "makes", "made", "put", "also", "even",
  "sure", "really", "actually", "already", "still", "many", "much", "one", "way", "thing", "things"
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
   * How many active chunks contain each term, and the corpus size.
   *
   * Cached because it only changes on ingest, and it is asked on every single
   * question. Each lookup is a GIN index probe, so even cold it is cheap.
   */
  private dfCache: { at: number; total: number; df: Map<string, number> } | null = null;

  private async documentFrequencies(terms: string[]): Promise<{ total: number; df: Map<string, number> }> {
    const fresh = this.dfCache && Date.now() - this.dfCache.at < DF_TTL_MS;
    const cache = fresh ? this.dfCache! : { at: Date.now(), total: -1, df: new Map<string, number>() };

    if (cache.total < 0) {
      const [{ n }] = await this.prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*)::bigint AS n
        FROM "KnowledgeChunk" c JOIN "KnowledgeSource" s ON s.id = c."sourceId"
        WHERE s."isActive"`;
      cache.total = Number(n);
    }

    const missing = terms.filter((t) => !cache.df.has(t));
    if (missing.length > 0) {
      const rows = await this.prisma.$queryRaw<Array<{ term: string; n: bigint }>>`
        SELECT t.term, (
          SELECT COUNT(*)::bigint
          FROM "KnowledgeChunk" c JOIN "KnowledgeSource" s ON s.id = c."sourceId"
          WHERE s."isActive" AND c."searchVector" @@ to_tsquery('english', t.term)
        ) AS n
        FROM unnest(${missing}::text[]) AS t(term)`;
      for (const r of rows) cache.df.set(r.term, Number(r.n));
    }

    this.dfCache = cache;
    return { total: cache.total, df: cache.df };
  }

  /**
   * Rank the corpus against a question.
   *
   * Three signals, in order of weight.
   *
   * 1. **IDF-weighted term matches — the one that decides the answer.** Postgres
   *    `ts_rank_cd` measures how densely the query terms appear, but it has no
   *    notion of which term *mattered*: it cannot tell that "refund" is
   *    decisive and "fail" is in a tenth of the corpus. On a small corpus that
   *    is invisible. On two thousand entries it is the difference between the
   *    right answer and a wrong one — asked "do you give a refund if I fail",
   *    density ranking put six passages about failing exams above the passage
   *    that actually answers it, because they matched the common word more
   *    often. Each term is therefore weighted by how rare it is, the same idea
   *    BM25 uses.
   *
   * 2. **A strict-match bonus.** A passage that satisfies `websearch_to_tsquery`
   *    contains *every* word of the question, which is a strong signal when it
   *    happens and silent when it does not.
   *
   * 3. **`ts_rank_cd` itself**, scaled down to a tie-breaker. It honours the
   *    heading weighting applied at ingest, so between two passages that match
   *    equally, the one whose HEADING matched wins — and a heading here is the
   *    customer's own question.
   *
   * Matching is still OR, so a normally-phrased question always retrieves
   * something. Only the ordering changed.
   */
  async search(question: string, limit = 6): Promise<RetrievedChunk[]> {
    const terms = queryTerms(question);
    if (terms.length === 0) return [];
    const take = Math.min(Math.max(limit, 1), 20);
    const orQuery = terms.join(" | ");

    const { total, df } = await this.documentFrequencies(terms);

    // BM25's IDF. The +0.5 smoothing keeps a term that appears in every chunk
    // from going negative, and a term appearing in none from dividing by zero.
    const weighted = terms
      .map((term) => {
        const n = df.get(term) ?? 0;
        const idf = Math.log(1 + (total - n + 0.5) / (n + 0.5));
        return { term, idf };
      })
      // A term in more than half the corpus carries almost no information and
      // its tiny weight only adds noise to the sum.
      .filter((t) => t.idf > 0.2);

    if (weighted.length === 0) return [];

    const idfSum = Prisma.join(
      weighted.map(
        (t) =>
          Prisma.sql`(CASE WHEN c."searchVector" @@ to_tsquery('english', ${t.term}) THEN ${t.idf}::float8 ELSE 0::float8 END)`
      ),
      " + "
    );

    return this.prisma.$queryRaw<RetrievedChunk[]>`
      WITH q AS (
        SELECT websearch_to_tsquery('english', ${question}) AS aq,
               to_tsquery('english', ${orQuery}) AS oq
      )
      SELECT c.id,
             c.heading,
             c.content,
             s.name AS "sourceName",
             (${idfSum})
               + (CASE WHEN c."searchVector" @@ q.aq THEN 2.0::float8 ELSE 0::float8 END)
               + (ts_rank_cd(c."searchVector", q.oq)::float8 * 2.0) AS rank
      FROM "KnowledgeChunk" c
      JOIN "KnowledgeSource" s ON s.id = c."sourceId"
      CROSS JOIN q
      WHERE s."isActive"
        AND (c."searchVector" @@ q.oq OR c."searchVector" @@ q.aq)
      ORDER BY rank DESC, c."ordinal" ASC
      LIMIT ${take}`;
  }

  /** Ingest changes what is rare, so the weights must be recomputed. */
  private invalidateStats() {
    this.dfCache = null;
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
    }, { timeout: 120_000 }).then((out) => {
      this.invalidateStats();
      return out;
    });
  }

  async listSources() {
    const rows = await this.prisma.knowledgeSource.findMany({ orderBy: { createdAt: "desc" } });
    const totalChunks = await this.prisma.knowledgeChunk.count();
    return { totalChunks, sources: rows };
  }

  async setSourceActive(id: string, isActive: boolean) {
    const out = await this.prisma.knowledgeSource.update({ where: { id }, data: { isActive } });
    this.invalidateStats();
    return out;
  }

  async deleteSource(id: string) {
    await this.prisma.knowledgeSource.delete({ where: { id } });
    this.invalidateStats();
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
