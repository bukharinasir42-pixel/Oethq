import type { Request } from "express";

export type RequestAuditContext = {
  route?: string;
  ipAddress?: string;
  userAgent?: string;
  actorUserId?: string;
  actorEmail?: string;
  /**
   * Browser-generated device id (x-device-id). Rides along here so every
   * existing caller carries it without a new parameter on 20-odd signatures.
   */
  deviceId?: string;
  /** Hash of stable browser traits (x-device-fp). */
  fingerprint?: string;
  /** ISO-3166 country, from the CDN's geo header. */
  country?: string;
  /** City, from the CDN's geo header. */
  city?: string;
};

/**
 * Country / city as injected by the CDN in front of the app. Read from headers
 * rather than resolved at runtime: no extra dependency, no per-request latency,
 * and no third party learning your students' addresses.
 *
 * Cloudflare, Vercel, Fastly, Google Cloud and AWS CloudFront each use their own
 * header, so all of them are checked. Behind a proxy that injects none of these
 * both come back undefined, and the admin screen shows "Unknown" rather than
 * guessing — see the note in the device-audit instructions.
 */
function geoFromHeaders(req: Request): { country?: string; city?: string } {
  const pick = (...names: string[]) => {
    for (const n of names) {
      const v = firstForwardedValue(req.headers[n]);
      if (v && v !== "XX" && v !== "T1") return v;
    }
    return undefined;
  };
  const country = pick(
    "cf-ipcountry",              // Cloudflare
    "x-vercel-ip-country",       // Vercel
    "fastly-client-country",     // Fastly
    "x-appengine-country",       // Google
    "cloudfront-viewer-country"  // AWS
  );
  const city = pick(
    "cf-ipcity",
    "x-vercel-ip-city",
    "x-appengine-city",
    "cloudfront-viewer-city"
  );
  return {
    country: country ? country.toUpperCase().slice(0, 2) : undefined,
    // Vercel percent-encodes city names ("New%20Delhi").
    city: city ? safeDecode(city) : undefined
  };
}

function safeDecode(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
}

type CurrentUserLike = {
  userId?: string;
  email?: string;
};

function firstForwardedValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(",")[0]?.trim() || undefined;
}

export function buildRequestAuditContext(
  req: Request,
  currentUser?: CurrentUserLike | null
): RequestAuditContext {
  const requestUser = (req as Request & { user?: CurrentUserLike }).user;
  const forwardedFor = firstForwardedValue(req.headers["x-forwarded-for"]);
  const ipAddress = forwardedFor || req.ip || req.socket.remoteAddress || undefined;

  return {
    route: req.originalUrl || req.url,
    ipAddress,
    userAgent: req.get("user-agent") || undefined,
    actorUserId: currentUser?.userId || requestUser?.userId,
    actorEmail: currentUser?.email || requestUser?.email,
    deviceId: firstForwardedValue(req.headers["x-device-id"]) || undefined,
    fingerprint: firstForwardedValue(req.headers["x-device-fp"]) || undefined,
    ...geoFromHeaders(req)
  };
}
