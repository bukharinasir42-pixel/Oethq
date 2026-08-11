/**
 * chunker.ts — split ingested material into retrievable passages.
 *
 * Chunk size is the single biggest lever on answer quality, and it fails in both
 * directions. Chunks that are too small lose the context that makes them
 * answerable ("Yes, it is included" — in what?). Chunks that are too large dilute
 * the ranking, because a passage about six topics matches every question about
 * any of them and outranks the passage that is actually about the question.
 *
 * ~1,200 characters (roughly 250 words) split on paragraph boundaries is the
 * middle. What matters more than the number is that splits land on boundaries
 * the author intended, which is why headings and speaker turns are respected.
 */

export type DraftChunk = { heading: string | null; content: string };

const DEFAULT_MAX_CHARS = 1200;
/** Conversation turns are short and change topic fast — see chunkConversation. */
const CONVERSATION_MAX_CHARS = 650;
const MIN_CHARS = 120;

/** A markdown-ish heading: "## Fees", "Fees:", "FEES", "Q: how much…". */
function headingOf(line: string): string | null {
  const t = line.trim();
  if (!t || t.length > 120) return null;
  const md = /^#{1,6}\s+(.{2,})$/.exec(t);
  if (md) return md[1].trim();
  const qa = /^(?:Q|Question)\s*[:.)-]\s*(.{2,})$/i.exec(t);
  if (qa) return qa[1].trim();
  // "Fees and payment:" — a short line ending in a colon.
  if (/^[A-Z][^.!?]{2,80}:$/.test(t)) return t.slice(0, -1).trim();
  // A short ALL-CAPS line.
  if (/^[A-Z0-9][A-Z0-9 &/'’,()-]{3,60}$/.test(t) && t === t.toUpperCase()) return t;
  return null;
}

function tidy(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Split a long paragraph that is itself over the limit, on sentence ends where
 * possible and on a hard character boundary only as a last resort — never mid
 * word, because a half word is unsearchable and unreadable if it is ever quoted.
 */
function splitLongParagraph(p: string, max: number): string[] {
  if (p.length <= max) return [p];
  const out: string[] = [];
  let rest = p;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
    if (cut < max * 0.4) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    else cut += 1;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Chunk free text (a transcript, an FAQ sheet, a page of notes).
 * The most recent heading seen travels with each chunk, so a passage that reads
 * "included in the Elite tier" still carries "Fees and payment" into the ranking.
 */
export function chunkDocument(raw: string, maxChars = DEFAULT_MAX_CHARS): DraftChunk[] {
  const text = tidy(raw);
  if (!text) return [];

  const blocks = text.split(/\n{2,}/);
  const chunks: DraftChunk[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];
  let size = 0;

  const flush = () => {
    const content = buffer.join("\n\n").trim();
    buffer = [];
    size = 0;
    if (content.length === 0) return;
    // A scrap too small to answer anything is appended to the previous chunk
    // instead of becoming its own unrankable row.
    if (content.length < MIN_CHARS && chunks.length > 0) {
      chunks[chunks.length - 1].content += `\n\n${redact(content)}`;
      return;
    }
    chunks.push({ heading: heading ? redact(heading) : null, content: redact(content) });
  };

  for (const block of blocks) {
    const lines = block.split("\n");
    const maybeHeading = lines.length === 1 ? headingOf(lines[0]) : headingOf(lines[0]);

    // A heading starts a new chunk: it marks a topic change the author declared.
    if (maybeHeading && lines.length === 1) {
      flush();
      heading = maybeHeading;
      continue;
    }
    if (maybeHeading && lines.length > 1) {
      flush();
      heading = maybeHeading;
      const body = lines.slice(1).join("\n").trim();
      if (body) {
        buffer.push(body);
        size += body.length;
      }
      continue;
    }

    for (const piece of splitLongParagraph(block.trim(), maxChars)) {
      if (size + piece.length > maxChars && size > 0) flush();
      buffer.push(piece);
      size += piece.length + 2;
    }
  }
  flush();
  return chunks;
}

/**
 * Chunk an exported conversation.
 *
 * Every export format worth supporting is "timestamp, sender, message" — the
 * WhatsApp `.txt` export, most CRM exports, and any transcript with speaker
 * labels. One message is far too small to retrieve on (a bare "yes" answers
 * nothing), so turns are grouped into windows that keep the question and its
 * answer in the same passage.
 *
 * Timestamps and phone numbers are stripped, not kept: they are noise in the
 * ranking, and shipping a real customer's number into a system prompt that a
 * stranger's question can surface is a data leak waiting to happen.
 */
export function chunkConversation(raw: string, maxChars = DEFAULT_MAX_CHARS): DraftChunk[] {
  const text = tidy(raw);
  if (!text) return [];

  // "[12/03/2026, 14:22:01] Name: message" and "12/03/2026, 14:22 - Name: message"
  const LINE =
    /^\s*\[?\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\]?\s*[-–]?\s*([^:]{1,60}):\s*([\s\S]*)$/;

  const turns: Array<{ who: string; text: string }> = [];
  for (const line of text.split("\n")) {
    const m = LINE.exec(line);
    if (m) {
      const who = m[1].trim();
      const body = m[2].trim();
      if (!body || /^(?:<Media omitted>|image omitted|video omitted|audio omitted|sticker omitted|This message was deleted|null)$/i.test(body)) {
        continue;
      }
      turns.push({ who: redact(who), text: redact(body) });
    } else if (turns.length > 0 && line.trim()) {
      // Continuation of the previous message (a multi-line send).
      turns[turns.length - 1].text += `\n${redact(line.trim())}`;
    }
  }

  // Not a conversation export after all — fall back to plain document chunking
  // rather than silently ingesting nothing.
  if (turns.length < 4) return chunkDocument(raw, maxChars);

  // A conversation window is deliberately smaller than a document chunk. Turns
  // are short and topics change every few lines, so a 1,200-character window
  // covers half a dozen unrelated questions — and a chunk about six things
  // outranks the chunk that is about the one thing that was asked.
  const window = Math.min(maxChars, CONVERSATION_MAX_CHARS);

  const chunks: DraftChunk[] = [];
  let buffer: string[] = [];
  let size = 0;

  const flush = (carry: string | null) => {
    const content = buffer.join("\n").trim();
    buffer = [];
    size = 0;
    if (content) {
      if (content.length < MIN_CHARS && chunks.length > 0) {
        chunks[chunks.length - 1].content += `\n${content}`;
      } else {
        chunks.push({ heading: null, content });
      }
    }
    // Overlap: the new chunk opens with the last turn of the one just closed,
    // so a question at the end of one window and its answer at the start of the
    // next are each retrievable with their other half in view. Without this,
    // "can i pay in installments" and "We do not offer installments" can land in
    // different chunks and the answer is retrieved without its question.
    if (carry) {
      buffer.push(carry);
      size = carry.length + 1;
    }
  };

  for (const t of turns) {
    const line = `${t.who}: ${t.text}`;
    for (const piece of splitLongParagraph(line, window)) {
      if (size + piece.length > window && size > 0) {
        flush(buffer.length > 1 ? buffer[buffer.length - 1] : null);
      }
      buffer.push(piece);
      size += piece.length + 1;
    }
  }
  flush(null);

  return chunks;
}

/**
 * Your own domains, which must survive redaction.
 *
 * Without this, "email support@oethq.com" becomes "email [email]" and the
 * assistant loses the one contact detail it most needs to be able to give out.
 */
export function companyDomains(): string[] {
  const raw = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    return host && !host.startsWith("localhost") ? [host] : [];
  } catch {
    return [];
  }
}

/**
 * Strip other people's contact details before anything is stored.
 *
 * This runs on EVERY ingest format, not just raw chat exports. The material
 * being loaded is other people's messages, and a passage that carries a
 * student's phone number is a passage a stranger's question can surface — the
 * knowledge base is read out to whoever is chatting.
 *
 * It is a filter, not a guarantee: it catches emails, phone numbers and long
 * digit runs, which is what appears in practice. It cannot catch a name, and it
 * is not a substitute for not putting personal details in the file.
 */
export function redact(s: string, keepDomains: string[] = companyDomains()): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, (match) => {
      const domain = match.split("@")[1]?.toLowerCase() ?? "";
      return keepDomains.some((d) => domain === d || domain.endsWith(`.${d}`)) ? match : "[email]";
    })
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone]")
    .replace(/\b\d{9,}\b/g, "[number]");
}

/**
 * Chunk a Q&A list: `[{ "question": "...", "answer": "..." }]`, or
 * `[{ "q": "...", "a": "..." }]`. The most useful format to hand-write, because
 * one pair is exactly one retrievable unit.
 */
export function chunkQaJson(raw: string): DraftChunk[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of question/answer objects.");
  const out: DraftChunk[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const q = String(o.question ?? o.q ?? o.title ?? "").trim();
    const a = String(o.answer ?? o.a ?? o.body ?? o.content ?? "").trim();
    if (!a) continue;
    out.push({
      heading: q ? redact(q) : null,
      content: redact(q ? `Q: ${q}\nA: ${a}` : a)
    });
  }
  if (out.length === 0) throw new Error("No question/answer pairs found in the JSON.");
  return out;
}
