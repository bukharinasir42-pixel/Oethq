import { apiFetch } from "./api";

export type ArticleOfDay = {
  id: string;
  kicker: string | null;
  title: string;
  standfirst: string | null;
  bodyText: string;
  attribution: string | null;
  total: number;
  dayKey: number;
  nextRotatesInMs: number;
};

export type AdminArticle = {
  id: string;
  kicker: string | null;
  title: string;
  standfirst: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  words: number;
};

export type ArticleInput = {
  kicker?: string | null;
  title: string;
  standfirst?: string | null;
  bodyText: string;
  attribution?: string | null;
};

export type AdminArticleFull = AdminArticle & { bodyText: string; attribution: string | null; updatedAt: string };

export const readingArticlesApi = {
  // Candidate
  ofDay: () => apiFetch<{ article: ArticleOfDay | null }>("/reading-articles/of-day"),

  // Admin
  adminCounts: () => apiFetch<{ total: number; active: number }>("/admin/reading-articles/counts"),
  adminList: () => apiFetch<{ articles: AdminArticle[] }>("/admin/reading-articles"),
  adminGet: (id: string) => apiFetch<AdminArticleFull>(`/admin/reading-articles/${id}`),
  adminCreate: (articles: ArticleInput[]) =>
    apiFetch<{ created: number }>("/admin/reading-articles", { method: "POST", body: { articles } }),
  adminUpdate: (id: string, data: Partial<ArticleInput & { isActive: boolean; displayOrder: number }>) =>
    apiFetch<AdminArticleFull>(`/admin/reading-articles/${id}`, { method: "PATCH", body: data }),
  adminDelete: (id: string) => apiFetch<{ ok: boolean }>(`/admin/reading-articles/${id}`, { method: "DELETE" })
};

/**
 * Parse the bulk-paste format into article inputs. Articles are separated by a
 * line of three or more dashes (`---`). Within each block:
 *   TITLE: …            (required)
 *   KICKER: …           (optional; defaults applied server-side if blank)
 *   STANDFIRST: …       (optional, may wrap onto following lines until a blank line)
 *   ATTRIBUTION: …      (optional, trailing)
 *   <blank line>
 *   body paragraphs, separated by blank lines (leading "01"/"02" numbers are stripped)
 */
export function parseArticleBulk(raw: string): ArticleInput[] {
  const blocks = raw.split(/^\s*-{3,}\s*$/m).map((b) => b.trim()).filter(Boolean);
  const out: ArticleInput[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    let kicker = "";
    let title = "";
    let standfirst = "";
    let attribution = "";
    const bodyLines: string[] = [];
    let section: "head" | "body" = "head";
    let lastField: "standfirst" | "attribution" | null = null;
    let inAttribution = false; // ATTRIBUTION may appear at the end, after the body
    for (const line of lines) {
      if (section === "head") {
        const m = line.match(/^\s*(TITLE|KICKER|STANDFIRST|ATTRIBUTION)\s*:\s*(.*)$/i);
        if (m) {
          const key = m[1].toUpperCase();
          const val = m[2];
          if (key === "TITLE") { title = val; lastField = null; }
          else if (key === "KICKER") { kicker = val; lastField = null; }
          else if (key === "STANDFIRST") { standfirst = val; lastField = "standfirst"; }
          else if (key === "ATTRIBUTION") { attribution = val; lastField = "attribution"; }
          continue;
        }
        if (line.trim() === "") { section = "body"; lastField = null; continue; }
        // continuation of a wrapping field
        if (lastField === "standfirst") { standfirst += " " + line.trim(); continue; }
        if (lastField === "attribution") { attribution += " " + line.trim(); continue; }
        // stray text before a blank line — treat as start of body
        bodyLines.push(line);
        continue;
      }
      // body section — a trailing "ATTRIBUTION:" ends the body and captures the rest
      if (inAttribution) {
        if (line.trim()) attribution += (attribution ? " " : "") + line.trim();
        continue;
      }
      const am = line.match(/^\s*ATTRIBUTION\s*:\s*(.*)$/i);
      if (am) { attribution = am[1]; inAttribution = true; continue; }
      bodyLines.push(line);
    }
    // strip leading paragraph numbers like "01 " / "1. " at the start of each paragraph
    const bodyText = bodyLines
      .join("\n")
      .split(/\n\s*\n/)
      .map((para) => para.replace(/^\s*\d{1,2}[.)\s]\s*/, "").replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
    if (title.trim() && bodyText.trim()) {
      out.push({
        kicker: kicker.trim() || null,
        title: title.trim(),
        standfirst: standfirst.trim() || null,
        bodyText,
        attribution: attribution.trim() || null
      });
    }
  }
  return out;
}

/**
 * Parse a JSON bulk-import into article inputs. Accepts either a top-level array
 * `[ {…}, {…} ]` or an object `{ "articles": [ … ] }`. Each article object:
 *   title        (required, string)
 *   paragraphs   (array of strings)  — preferred; joined into the body
 *   bodyText     (string)            — alternative to paragraphs (blank line between paragraphs)
 *   kicker, standfirst, attribution  (optional strings)
 * Returns the valid articles plus a list of per-article errors (invalid items are skipped).
 */
export function parseArticleJson(raw: string): { articles: ArticleInput[]; errors: string[] } {
  const errors: string[] = [];
  if (!raw.trim()) return { articles: [], errors };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { articles: [], errors: [`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`] };
  }
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { articles?: unknown }).articles)
      ? ((data as { articles: unknown[] }).articles)
      : null;
  if (!arr) {
    return { articles: [], errors: ['Expected a JSON array of articles, or an object { "articles": [ … ] }.'] };
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const out: ArticleInput[] = [];
  arr.forEach((item, i) => {
    const where = `Article ${i + 1}`;
    if (!item || typeof item !== "object") {
      errors.push(`${where}: not an object`);
      return;
    }
    const it = item as Record<string, unknown>;
    const title = str(it.title);
    if (!title) {
      errors.push(`${where}: missing "title"`);
      return;
    }
    let bodyText = "";
    if (Array.isArray(it.paragraphs)) {
      bodyText = it.paragraphs.map((p) => String(p ?? "").trim()).filter(Boolean).join("\n\n");
    } else if (typeof it.bodyText === "string") {
      bodyText = it.bodyText.trim();
    }
    if (!bodyText) {
      errors.push(`${where} ("${title}"): needs a non-empty "paragraphs" array or "bodyText"`);
      return;
    }
    out.push({
      kicker: str(it.kicker),
      title,
      standfirst: str(it.standfirst),
      bodyText,
      attribution: str(it.attribution)
    });
  });
  return { articles: out, errors };
}
