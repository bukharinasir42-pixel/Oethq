/**
 * The public URL of the student-facing app, for links that leave the server —
 * emails, above all.
 *
 * This exists because the cohort emails built their links from
 * `process.env.FRONTEND_ORIGIN || ""`, and FRONTEND_ORIGIN is set nowhere and
 * read nowhere else in the codebase. So it was always the empty string, and
 * every cohort link went out as a bare path:
 *
 *     "" + "/portal/tasks?day=3"  →  "/portal/tasks?day=3"
 *
 * A relative path is not a valid link in an email. Mail clients prepend a
 * scheme, and the student lands on `http:///portal/tasks?day=3` — no host,
 * three slashes — which every browser rejects. The class link in the email was
 * dead for every student who ever clicked it.
 *
 * Two rules keep it from coming back:
 *
 *   1. One resolver, used everywhere. Adding another env var name is how this
 *      drifted in the first place.
 *   2. It NEVER returns an empty string. A wrong-but-absolute link is a bug you
 *      can see; a relative one silently produces the broken URL above.
 */

const DEFAULT_APP_URL = "http://localhost:3000";

/** Reads NEXT_PUBLIC_APP_URL, then the older aliases, then a usable default. */
export function resolveAppUrl(get?: (key: string) => string | undefined): string {
  const read = (key: string) => (get ? get(key) : undefined) ?? process.env[key];
  const raw =
    read("NEXT_PUBLIC_APP_URL") ||
    read("PUBLIC_APP_URL") ||
    // Only ever referenced by the cohort mailer. Honoured so an environment
    // that happens to set it keeps working.
    read("FRONTEND_ORIGIN") ||
    read("FRONTEND_URL") ||
    DEFAULT_APP_URL;
  return String(raw).trim().replace(/\/+$/, "");
}

/**
 * Absolute link into the app. Always returns something a mail client can open.
 *
 * @param path e.g. "/portal/tasks?day=3" — a leading slash is optional.
 */
export function appLink(path: string, get?: (key: string) => string | undefined): string {
  const base = resolveAppUrl(get);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
