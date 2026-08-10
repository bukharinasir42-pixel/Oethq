/**
 * traffic-channel.ts — turn "where did this visit come from" into one bucket.
 *
 * Pure and dependency-free on purpose: this is the one piece of the attribution
 * feature whose output is a number on a dashboard the business acts on, so it
 * is unit-tested against real referrer strings rather than exercised only
 * through the API.
 *
 * The classification runs on the SERVER even though the browser sends the raw
 * signals. A visitor can put anything in a query string; if the browser also
 * decided the channel, "?utm_source=youtube" would be enough to forge the
 * report. The browser reports observations, the server decides meaning.
 */

export const TRAFFIC_CHANNELS = [
  "DIRECT",
  "ORGANIC_SEARCH",
  "PAID_SEARCH",
  "YOUTUBE",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "WHATSAPP",
  "TELEGRAM",
  "LINKEDIN",
  "TWITTER",
  "PAID_SOCIAL",
  "EMAIL",
  "REFERRAL",
  "ADMIN",
  "OTHER"
] as const;

export type TrafficChannelName = (typeof TRAFFIC_CHANNELS)[number];

/**
 * A report-only bucket for people whose channel was never recorded — every
 * student who existed before this shipped, and anyone whose browser blocked the
 * visit ping.
 *
 * It is deliberately NOT a value in the database enum, and deliberately not
 * folded into OTHER. On the day this goes live the entire existing student list
 * and all historical revenue land here; under the label "Other" that reads as a
 * marketing channel that quietly outperforms every real one.
 */
export const UNATTRIBUTED = "UNATTRIBUTED" as const;

export type ReportChannelName = TrafficChannelName | typeof UNATTRIBUTED;

/** Human labels for the admin dashboard, in the order they should be read. */
export const CHANNEL_LABELS: Record<ReportChannelName, string> = {
  ORGANIC_SEARCH: "Google / organic search",
  PAID_SEARCH: "Paid search (Google Ads)",
  YOUTUBE: "YouTube",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  LINKEDIN: "LinkedIn",
  TWITTER: "X / Twitter",
  PAID_SOCIAL: "Paid social",
  EMAIL: "Email",
  REFERRAL: "Another website",
  DIRECT: "Direct / typed the address",
  ADMIN: "Created by admin",
  OTHER: "Other",
  UNATTRIBUTED: "Not tracked (joined before tracking, or ping blocked)"
};

/** Read order for the dashboard — biggest acquisition stories first. */
export const CHANNEL_DISPLAY_ORDER: ReportChannelName[] = [
  "ORGANIC_SEARCH",
  "YOUTUBE",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "PAID_SEARCH",
  "PAID_SOCIAL",
  "WHATSAPP",
  "TELEGRAM",
  "LINKEDIN",
  "TWITTER",
  "EMAIL",
  "REFERRAL",
  "DIRECT",
  "ADMIN",
  "OTHER",
  UNATTRIBUTED
];

export type TrafficSignals = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  /** `document.referrer`, or empty when the visit had none. */
  referrer?: string | null;
  /** gclid / fbclid / ttclid / msclkid / li_fat_id, whichever was present. */
  clickId?: string | null;
  /** Which ad network the click id came from, e.g. "gclid". */
  clickIdKind?: string | null;
};

export type Classification = {
  channel: TrafficChannelName;
  /** Normalised source: "google", "youtube", "facebook", a bare host, or null. */
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

/** utm_medium values that mean money was spent on the click. */
const PAID_MEDIA = new Set([
  "cpc",
  "ppc",
  "cpm",
  "cpv",
  "cpa",
  "paid",
  "paidsearch",
  "paid_search",
  "paid-search",
  "paidsocial",
  "paid_social",
  "paid-social",
  "display",
  "banner",
  "retargeting",
  "remarketing"
]);

const EMAIL_MEDIA = new Set(["email", "e-mail", "newsletter", "mail"]);

/**
 * Host suffix → channel. Matched against the referrer host and against the
 * `utm_source` when that source looks like a domain.
 *
 * The entries that matter most are the shims: Facebook rewrites outbound links
 * through `l.facebook.com` and `lm.facebook.com`, and Twitter through `t.co`.
 * Without those rows the largest social channels land in "Another website",
 * which is the single most common way an attribution report ends up wrong.
 */
const HOST_CHANNELS: Array<[suffix: string, channel: TrafficChannelName, source: string]> = [
  // Video
  ["youtube.com", "YOUTUBE", "youtube"],
  ["youtu.be", "YOUTUBE", "youtube"],
  ["youtube-nocookie.com", "YOUTUBE", "youtube"],

  // Meta
  ["facebook.com", "FACEBOOK", "facebook"],
  ["fb.com", "FACEBOOK", "facebook"],
  ["fb.me", "FACEBOOK", "facebook"],
  ["messenger.com", "FACEBOOK", "messenger"],
  ["instagram.com", "INSTAGRAM", "instagram"],

  // Other social
  ["tiktok.com", "TIKTOK", "tiktok"],
  ["linkedin.com", "LINKEDIN", "linkedin"],
  ["lnkd.in", "LINKEDIN", "linkedin"],
  ["twitter.com", "TWITTER", "twitter"],
  ["x.com", "TWITTER", "twitter"],
  ["t.co", "TWITTER", "twitter"],
  ["reddit.com", "REFERRAL", "reddit"],
  ["pinterest.com", "REFERRAL", "pinterest"],
  ["quora.com", "REFERRAL", "quora"],

  // Messaging
  ["whatsapp.com", "WHATSAPP", "whatsapp"],
  ["wa.me", "WHATSAPP", "whatsapp"],
  ["t.me", "TELEGRAM", "telegram"],
  ["telegram.me", "TELEGRAM", "telegram"],
  ["telegram.org", "TELEGRAM", "telegram"],

  // Webmail — a click from an inbox, whether or not the sender tagged the link
  ["mail.google.com", "EMAIL", "gmail"],
  ["outlook.live.com", "EMAIL", "outlook"],
  ["outlook.office.com", "EMAIL", "outlook"],
  ["outlook.office365.com", "EMAIL", "outlook"],
  ["mail.yahoo.com", "EMAIL", "yahoo-mail"],
  ["mail.proton.me", "EMAIL", "proton"]
];

/** Search-engine host suffixes. Organic unless a paid click id says otherwise. */
const SEARCH_HOSTS: Array<[suffix: string, source: string]> = [
  ["google.", "google"],
  ["google.com", "google"],
  ["bing.com", "bing"],
  ["duckduckgo.com", "duckduckgo"],
  ["search.yahoo.com", "yahoo"],
  ["yahoo.com", "yahoo"],
  ["yandex.", "yandex"],
  ["baidu.com", "baidu"],
  ["ecosia.org", "ecosia"],
  ["search.brave.com", "brave"],
  ["startpage.com", "startpage"],
  ["qwant.com", "qwant"],
  ["ask.com", "ask"]
];

/** utm_source values people actually type, mapped to a channel. */
const SOURCE_CHANNELS: Array<[match: string, channel: TrafficChannelName]> = [
  ["youtube", "YOUTUBE"],
  ["yt", "YOUTUBE"],
  ["facebook", "FACEBOOK"],
  ["fb", "FACEBOOK"],
  ["meta", "FACEBOOK"],
  ["instagram", "INSTAGRAM"],
  ["ig", "INSTAGRAM"],
  ["tiktok", "TIKTOK"],
  ["whatsapp", "WHATSAPP"],
  ["telegram", "TELEGRAM"],
  ["linkedin", "LINKEDIN"],
  ["twitter", "TWITTER"],
  ["x", "TWITTER"],
  ["google", "ORGANIC_SEARCH"],
  ["bing", "ORGANIC_SEARCH"],
  ["duckduckgo", "ORGANIC_SEARCH"],
  ["yahoo", "ORGANIC_SEARCH"],
  ["newsletter", "EMAIL"],
  ["email", "EMAIL"],
  ["mailchimp", "EMAIL"],
  ["sendgrid", "EMAIL"],
  ["ses", "EMAIL"]
];

const SOCIAL_CHANNELS = new Set<TrafficChannelName>([
  "YOUTUBE",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "LINKEDIN",
  "TWITTER"
]);

function clean(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  // Query strings are attacker-controlled; nothing downstream should have to
  // defend against a 10 KB "campaign".
  return t.slice(0, 200);
}

function lower(v: string | null): string | null {
  return v ? v.toLowerCase() : null;
}

/** Host of a referrer URL, lowercased and stripped of `www.`. */
export function referrerHost(referrer: string | null | undefined): string | null {
  const raw = clean(referrer);
  if (!raw) return null;
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function hostMatches(host: string, suffix: string): boolean {
  // `google.` matches google.com, google.co.uk, google.com.pk — one row instead
  // of the ~190 country domains Google actually serves search from.
  if (suffix.endsWith(".")) return host === suffix.slice(0, -1) || host.startsWith(suffix) || host.includes(`.${suffix}`);
  return host === suffix || host.endsWith(`.${suffix}`);
}

function searchSourceFor(host: string): string | null {
  for (const [suffix, source] of SEARCH_HOSTS) {
    if (hostMatches(host, suffix)) return source;
  }
  return null;
}

function hostChannelFor(host: string): { channel: TrafficChannelName; source: string } | null {
  for (const [suffix, channel, source] of HOST_CHANNELS) {
    if (hostMatches(host, suffix)) return { channel, source };
  }
  return null;
}

function sourceChannelFor(source: string): TrafficChannelName | null {
  for (const [match, channel] of SOURCE_CHANNELS) {
    if (source === match || source.startsWith(`${match}.`) || source.startsWith(`${match}-`)) {
      return channel;
    }
  }
  return null;
}

/**
 * Classify one visit.
 *
 * Precedence, highest first:
 *   1. A paid click id (gclid/msclkid/fbclid/ttclid) — the ad network's own
 *      stamp beats anything hand-typed in a utm.
 *   2. An explicit utm_source, upgraded to a paid channel if utm_medium says so.
 *   3. The referrer host.
 *   4. Nothing → DIRECT.
 */
export function classifyTraffic(signals: TrafficSignals): Classification {
  const utmSource = lower(clean(signals.utmSource));
  const utmMedium = lower(clean(signals.utmMedium));
  const campaign = clean(signals.utmCampaign);
  const clickId = clean(signals.clickId);
  const clickIdKind = lower(clean(signals.clickIdKind));
  const host = referrerHost(signals.referrer);

  const paidMedium = utmMedium ? PAID_MEDIA.has(utmMedium) : false;

  // 1 — the ad network's own click stamp.
  if (clickId && clickIdKind) {
    if (clickIdKind === "gclid" || clickIdKind === "msclkid") {
      return { channel: "PAID_SEARCH", source: utmSource ?? (clickIdKind === "msclkid" ? "bing" : "google"), medium: utmMedium ?? "cpc", campaign };
    }
    if (clickIdKind === "fbclid") {
      // A fbclid appears on ORGANIC Facebook links too, not just ads — Facebook
      // stamps every outbound click. Only call it paid when the medium agrees.
      return { channel: paidMedium ? "PAID_SOCIAL" : "FACEBOOK", source: utmSource ?? "facebook", medium: utmMedium, campaign };
    }
    if (clickIdKind === "ttclid") {
      return { channel: paidMedium ? "PAID_SOCIAL" : "TIKTOK", source: utmSource ?? "tiktok", medium: utmMedium, campaign };
    }
    if (clickIdKind === "li_fat_id") {
      return { channel: paidMedium ? "PAID_SOCIAL" : "LINKEDIN", source: utmSource ?? "linkedin", medium: utmMedium, campaign };
    }
  }

  // 2 — an explicit utm_source.
  if (utmSource) {
    let channel = sourceChannelFor(utmSource);
    if (!channel) {
      // A source that looks like a domain ("m.youtube.com") still classifies.
      const viaHost = hostChannelFor(utmSource.replace(/^www\./, ""));
      channel = viaHost?.channel ?? null;
    }
    if (utmMedium && EMAIL_MEDIA.has(utmMedium)) {
      return { channel: "EMAIL", source: utmSource, medium: utmMedium, campaign };
    }
    if (channel) {
      if (paidMedium) {
        channel = channel === "ORGANIC_SEARCH" ? "PAID_SEARCH" : SOCIAL_CHANNELS.has(channel) ? "PAID_SOCIAL" : channel;
      }
      return { channel, source: utmSource, medium: utmMedium, campaign };
    }
    // Tagged, but with a source we have never seen. Still better than guessing.
    return { channel: paidMedium ? "PAID_SOCIAL" : "REFERRAL", source: utmSource, medium: utmMedium, campaign };
  }

  if (utmMedium && EMAIL_MEDIA.has(utmMedium)) {
    return { channel: "EMAIL", source: null, medium: utmMedium, campaign };
  }

  // 3 — the referrer. Named hosts are checked BEFORE search engines: the
  // webmail rows are subdomains of search-engine domains (mail.google.com,
  // mail.yahoo.com), and checking search first would file every click from a
  // Gmail inbox as organic search.
  if (host) {
    const known = hostChannelFor(host);
    if (known) {
      const channel = paidMedium && SOCIAL_CHANNELS.has(known.channel) ? "PAID_SOCIAL" : known.channel;
      return { channel, source: known.source, medium: utmMedium ?? "referral", campaign };
    }
    const search = searchSourceFor(host);
    if (search) {
      return { channel: paidMedium ? "PAID_SEARCH" : "ORGANIC_SEARCH", source: search, medium: utmMedium ?? "organic", campaign };
    }
    return { channel: "REFERRAL", source: host, medium: utmMedium ?? "referral", campaign };
  }

  // 4 — no referrer, no tags. Typed it, a bookmark, or a client that strips the
  // referrer (most in-app browsers and every https→http hop do).
  return { channel: "DIRECT", source: null, medium: utmMedium, campaign };
}

/** The trimmed signal set we persist, so route and service agree on shape. */
export function normaliseSignals(raw: TrafficSignals): TrafficSignals {
  return {
    utmSource: clean(raw.utmSource),
    utmMedium: clean(raw.utmMedium),
    utmCampaign: clean(raw.utmCampaign),
    utmTerm: clean(raw.utmTerm),
    utmContent: clean(raw.utmContent),
    referrer: clean(raw.referrer),
    clickId: clean(raw.clickId),
    clickIdKind: lower(clean(raw.clickIdKind))
  };
}
