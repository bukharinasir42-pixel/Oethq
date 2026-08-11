/**
 * attribution.ts — capture where a visitor came from.
 *
 * What this collects, and what it does not:
 *
 *   It collects — a random id for this browser, the URL's utm tags, the ad
 *   network's click id if there is one, and `document.referrer`. That is the
 *   same information the site's own web server sees in its access logs.
 *
 *   It does NOT collect — anything about the person, any fingerprint, any
 *   cross-site identifier, or any third-party script. Nothing here is sent to
 *   anyone but this application's own API, and no cookie is set: everything is
 *   in localStorage, scoped to this origin, and clearing site data clears it.
 *
 * The BROWSER only observes. Which channel a visit belongs to is decided on the
 * server, because a visitor can put anything in a query string and a report the
 * public can edit is not a report.
 */

const VISITOR_KEY = "oet_visitor";
const FIRST_TOUCH_KEY = "oet_attr_first";
const LAST_PING_KEY = "oet_attr_ping";

/** Click ids, most specific first. Each identifies the ad network that sent them. */
const CLICK_IDS = ["gclid", "msclkid", "fbclid", "ttclid", "li_fat_id"] as const;

export type Attribution = {
  visitorKey: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  clickId?: string;
  clickIdKind?: string;
  landingPath?: string;
};

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode with storage denied — the visit simply is not attributed */
  }
}

/** Stable id for this browser, minted on first visit. */
export function getVisitorKey(): string {
  if (typeof window === "undefined") return "";
  let id = read(VISITOR_KEY);
  if (!id) {
    id = randomId();
    write(VISITOR_KEY, id);
  }
  return id;
}

/**
 * The referrer, dropped when it is our own site.
 *
 * Without this every internal click looks like a fresh visit from oethq.com,
 * and the second page a visitor opens overwrites the channel that brought them.
 */
function externalReferrer(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const ref = document.referrer;
  if (!ref) return undefined;
  try {
    if (new URL(ref).hostname === window.location.hostname) return undefined;
  } catch {
    return undefined;
  }
  return ref.slice(0, 500);
}

/** Read the signals present on the current URL. */
export function currentSignals(): Attribution {
  const visitorKey = getVisitorKey();
  const out: Attribution = { visitorKey };
  if (typeof window === "undefined") return out;

  const params = new URLSearchParams(window.location.search);
  const pick = (k: string) => params.get(k)?.trim().slice(0, 200) || undefined;

  out.utmSource = pick("utm_source");
  out.utmMedium = pick("utm_medium");
  out.utmCampaign = pick("utm_campaign");
  out.utmTerm = pick("utm_term");
  out.utmContent = pick("utm_content");

  for (const kind of CLICK_IDS) {
    const v = pick(kind);
    if (v) {
      out.clickId = v;
      out.clickIdKind = kind;
      break;
    }
  }

  out.referrer = externalReferrer();
  out.landingPath = `${window.location.pathname}${window.location.search}`.slice(0, 500);
  return out;
}

/**
 * First touch, kept locally as well as on the server.
 *
 * The local copy is what makes sign-up attribution survive a visitor who first
 * arrives on a phone with a flaky connection: the ping may have failed, but the
 * tags are still on this browser when they eventually register.
 */
export function rememberFirstTouch(signals: Attribution) {
  if (read(FIRST_TOUCH_KEY)) return;
  const hasSignal = Boolean(signals.utmSource || signals.clickId || signals.referrer);
  if (!hasSignal) return;
  write(FIRST_TOUCH_KEY, JSON.stringify({ ...signals, at: new Date().toISOString() }));
}

export function firstTouch(): (Attribution & { at?: string }) | null {
  const raw = read(FIRST_TOUCH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Attribution & { at?: string };
  } catch {
    return null;
  }
}

/** Guard against double-firing on the same URL (React strict mode, fast re-renders). */
function alreadyPinged(path: string): boolean {
  const last = read(LAST_PING_KEY);
  if (!last) return false;
  const [prevPath, prevAt] = last.split("|");
  return prevPath === path && Date.now() - Number(prevAt || 0) < 2000;
}

/**
 * Report one page view.
 *
 * Deliberately fire-and-forget and deliberately silent. This runs on every page
 * of the public site, and analytics that can throw an error into a visitor's
 * console — or hold up a render — is worse than no analytics.
 */
export async function reportVisit(apiBase: string, token?: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  const signals = currentSignals();
  if (!signals.visitorKey) return;

  const path = signals.landingPath ?? "/";
  if (alreadyPinged(path)) return;
  write(LAST_PING_KEY, `${path}|${Date.now()}`);

  rememberFirstTouch(signals);

  try {
    await fetch(`${apiBase}/attribution/visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(signals),
      keepalive: true,
      cache: "no-store"
    });
  } catch {
    /* offline, blocked by an extension, or the API is down — never surface it */
  }
}
