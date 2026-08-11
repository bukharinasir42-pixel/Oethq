/**
 * link-guard.ts — never let the assistant send a URL that does not work.
 *
 * A link that 404s loses the sale at the exact moment the student was ready to
 * buy, which is the most expensive moment to fail. Models are also fluent at
 * inventing plausible paths (`/courses/reading-listening-elite`), and a
 * plausible-looking dead link is worse than no link, because the student blames
 * the business rather than retrying.
 *
 * So the rule is an allowlist, enforced after generation rather than only asked
 * for in the prompt: prompts are guidance, this is a guarantee. Any oethq.com
 * URL that is not explicitly known-good is rewritten to the site root, which
 * always works. Links to other sites (the official OET site, YouTube) are left
 * alone — the risk being managed here is our own broken routing.
 */

import { BUSINESS_FACTS } from "./business-facts";

const SITE_HOSTS = ["oethq.com", "www.oethq.com"];

function asStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** URLs the owner has confirmed resolve. Everything else on our domain does not. */
export function allowedUrls(): string[] {
  const links = (BUSINESS_FACTS.checkout_links ?? {}) as Record<string, unknown>;
  const working = asStringList(links.working);
  const perTier = links.per_tier && typeof links.per_tier === "object"
    ? Object.values(links.per_tier as Record<string, unknown>).filter(
        (v): v is string => typeof v === "string" && v.startsWith("http")
      )
    : [];
  const all = [...working, ...perTier].map((u) => u.trim()).filter(Boolean);
  return all.length > 0 ? Array.from(new Set(all)) : ["https://oethq.com"];
}

/** The URL to fall back to. Always the safest working link we have. */
export function safeUrl(): string {
  const allowed = allowedUrls();
  return allowed.find((u) => /^https?:\/\/(www\.)?oethq\.com\/?$/i.test(u)) ?? allowed[0] ?? "https://oethq.com";
}

function isOurHost(host: string): boolean {
  return SITE_HOSTS.includes(host.toLowerCase());
}

function normalise(u: string): string {
  return u.replace(/[)\].,;:!?'"]+$/, "").replace(/\/+$/, "").toLowerCase();
}

/**
 * Rewrite any of our own URLs that are not on the allowlist.
 *
 * Returns the cleaned text and what was replaced, so a rewrite is visible in the
 * transcript rather than silent — if the model keeps reaching for a link that
 * does not exist, that is worth knowing.
 */
export function guardLinks(text: string): { text: string; rewritten: string[] } {
  const allowed = new Set(allowedUrls().map(normalise));
  const fallback = safeUrl();
  const rewritten: string[] = [];

  const cleaned = text.replace(/https?:\/\/[^\s<>()\[\]"']+/gi, (raw) => {
    // Trailing punctuation belongs to the sentence, not the URL.
    const trailing = /[)\].,;:!?'"]+$/.exec(raw)?.[0] ?? "";
    const url = trailing ? raw.slice(0, -trailing.length) : raw;

    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return raw;
    }
    if (!isOurHost(host)) return raw;
    if (allowed.has(normalise(url))) return raw;

    rewritten.push(url);
    return fallback + trailing;
  });

  return { text: cleaned, rewritten };
}

/** The allowlist, rendered for the prompt so the model is told before it guesses. */
export function linkRulesBlock(): string {
  const allowed = allowedUrls();
  const note = typeof (BUSINESS_FACTS.checkout_links as Record<string, unknown>)?.assistant_rule === "string"
    ? ((BUSINESS_FACTS.checkout_links as Record<string, string>).assistant_rule)
    : "";
  return [
    "LINKS YOU MAY SEND — this is the complete list. Never construct, guess or complete a path.",
    ...allowed.map((u) => `- ${u}`),
    note ? `\n${note}` : "",
    "Any other oethq.com address will be replaced before the student sees it, so sending one just wastes the message."
  ]
    .filter(Boolean)
    .join("\n");
}
