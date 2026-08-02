/**
 * DeviceSessionService — one row per signed-in device, and the cap on how many
 * a student may have.
 *
 * Why sessions exist at all: the access token was a stateless bearer JWT, so
 * there was no way to end a session, count devices, or see where anyone was
 * signed in. The token now carries `sid` (a UserSession id) and every request
 * checks that row is still live, which buys revocation as well as the cap.
 *
 * The cap is SILENT by design. A third sign-in quietly ends the oldest session
 * rather than refusing the new one: the student is never shown an error, and
 * the eviction trail in the admin device list is what surfaces sharing. Two
 * people passing one account back and forth generate a stream of evictions that
 * a single student on a phone and a laptop never will.
 *
 * Flip EVICT_OLDEST to false to refuse the third device instead. That does stop
 * sharing outright, at the cost of a visible error for the student.
 */
import type { PrismaService } from "../../common/prisma.service";
import { Role } from "@prisma/client";
import { createLogger } from "../../common/logger";

/** Devices a candidate may be signed in on at once. Admins are exempt. */
export const DEVICE_LIMIT = 2;

/** true = silently end the oldest session; false = refuse the new device. */
const EVICT_OLDEST = true;

/**
 * Inactivity window, NOT a countdown from sign-in. Every authenticated request
 * slides it forward, so a student who opens the portal at least weekly is never
 * asked for a password again — while an abandoned session on a borrowed or
 * public computer closes itself after a week of silence.
 */
export const SESSION_DAYS = 7;

/**
 * How long a liveness check is trusted before hitting the database again.
 * Without this the cap would cost one query per API call. 60s means a revoked
 * session keeps working for at most a minute, which is the right trade for a
 * study portal — the access checks that actually gate content are separate and
 * are never cached.
 */
const LIVENESS_TTL_MS = 60_000;

const DAY_MS = 86_400_000;

export class SessionRevokedError extends Error {
  statusCode = 401;
  /** The client keys on this to sign out cleanly instead of showing an error. */
  code = "SESSION_ENDED";
  constructor() {
    super("This session has ended. Please sign in again.");
  }
}

export class DeviceLimitError extends Error {
  statusCode = 403;
  code = "DEVICE_LIMIT";
  constructor() {
    super(`You can be signed in on ${DEVICE_LIMIT} devices at a time.`);
  }
}

/** "Chrome on Windows" from a user-agent — best effort, for the admin list only. */
export function describeDevice(userAgent?: string | null): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge"
      : /OPR\/|Opera/.test(ua) ? "Opera"
        : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome"
          : /Firefox\//.test(ua) ? "Firefox"
            : /Safari\//.test(ua) ? "Safari"
              : "Browser";
  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS"
      : /Android/.test(ua) ? "Android"
        : /Windows/.test(ua) ? "Windows"
          : /Mac OS X|Macintosh/.test(ua) ? "macOS"
            : /Linux/.test(ua) ? "Linux"
              : "";
  return os ? `${browser} on ${os}` : browser;
}

type OpenInput = {
  userId: string;
  role: Role;
  deviceId: string;
  /** Hash of stable browser traits; used to re-link a cleared browser. */
  fingerprint?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
  city?: string | null;
};

export class DeviceSessionService {
  private readonly logger = createLogger("DeviceSessionService");
  /** sessionId → { live, checkedAt } */
  private readonly liveness = new Map<string, { live: boolean; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Start (or resume) this device's session and return its id for the token.
   *
   * Signing in again on a device the student already uses RESUMES that session
   * rather than adding one — otherwise a student who simply signed out and back
   * in on their laptop would burn both of their two slots.
   */
  async open(input: OpenInput): Promise<string> {
    const { userId, role, deviceId } = input;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
    const label = describeDevice(input.userAgent);

    // Prefer the stored device id. If site data was cleared it will not match,
    // so fall back to the fingerprint and re-link that session — otherwise a
    // student who clears their browser silently spends their second slot, and
    // anyone wanting a third device could just use a private window.
    // Scoped to this user, so a shared clinic PC never merges two students.
    let existing = await this.prisma.userSession.findUnique({
      where: { userId_deviceId: { userId, deviceId } }
    });
    if (!existing && input.fingerprint) {
      existing = await this.prisma.userSession.findFirst({
        where: { userId, fingerprint: input.fingerprint, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { lastSeenAt: "desc" }
      });
    }
    if (existing) {
      const resumed = await this.prisma.userSession.update({
        where: { id: existing.id },
        data: {
          deviceId,
          fingerprint: input.fingerprint ?? existing.fingerprint,
          label,
          userAgent: input.userAgent ?? existing.userAgent,
          ip: input.ip ?? existing.ip,
          country: input.country ?? existing.country,
          city: input.city ?? existing.city,
          lastSeenAt: now,
          expiresAt,
          revokedAt: null,
          revokedReason: null
        }
      });
      this.liveness.delete(resumed.id);
      return resumed.id;
    }

    // Only students are capped. Admins and any future staff role work from
    // several machines and must never be evicted mid-task.
    if (role === Role.CANDIDATE) {
      await this.enforceLimit(userId, now);
    }

    const created = await this.prisma.userSession.create({
      data: {
        userId,
        deviceId,
        fingerprint: input.fingerprint ?? null,
        label,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
        country: input.country ?? null,
        city: input.city ?? null,
        expiresAt
      }
    });
    return created.id;
  }

  /** Make room for one more device, oldest-first. */
  private async enforceLimit(userId: string, now: Date) {
    const live = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastSeenAt: "asc" },
      select: { id: true }
    });
    if (live.length < DEVICE_LIMIT) return;

    if (!EVICT_OLDEST) throw new DeviceLimitError();

    // Evict enough of the least-recently-used to leave one slot free.
    const evict = live.slice(0, live.length - DEVICE_LIMIT + 1).map((s) => s.id);
    await this.prisma.userSession.updateMany({
      where: { id: { in: evict } },
      data: { revokedAt: now, revokedReason: "device_limit" }
    });
    for (const id of evict) this.liveness.set(id, { live: false, at: Date.now() });
    this.logger.log(`device cap: evicted ${evict.length} session(s) for user=${userId}`);
  }

  /**
   * Is this session still usable? Cached for LIVENESS_TTL_MS.
   *
   * Also slides the expiry forward, so a student who keeps using the portal
   * never has to sign in again. That is the whole point of the 60 days: it is a
   * window of inactivity, not a countdown from their last password entry.
   */
  async isLive(sessionId: string): Promise<boolean> {
    const cached = this.liveness.get(sessionId);
    const nowMs = Date.now();
    if (cached && nowMs - cached.at < LIVENESS_TTL_MS) return cached.live;

    const row = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { id: true, revokedAt: true, expiresAt: true }
    });
    const live = Boolean(row && !row.revokedAt && row.expiresAt.getTime() > nowMs);
    this.liveness.set(sessionId, { live, at: nowMs });

    if (live) {
      // Fire-and-forget: a failed touch must never break the request.
      void this.prisma.userSession
        .update({
          where: { id: sessionId },
          data: { lastSeenAt: new Date(nowMs), expiresAt: new Date(nowMs + SESSION_DAYS * DAY_MS) }
        })
        .catch(() => undefined);
    }
    return live;
  }

  /** End one session (sign-out, or an admin ending a device). */
  async revoke(sessionId: string, reason: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason }
    });
    this.liveness.set(sessionId, { live: false, at: Date.now() });
  }

  /** End every session for a user (admin: "sign out everywhere"). */
  async revokeAllForUser(userId: string, reason: string) {
    const rows = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      select: { id: true }
    });
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason }
    });
    for (const r of rows) this.liveness.set(r.id, { live: false, at: Date.now() });
    return { ended: rows.length };
  }


  /**
   * Accounts that look shared, worst first.
   *
   * Nothing here is proof, and the code says so rather than pretending: these
   * are signals, each with the reason spelled out, so a person decides. The
   * strongest by far is two countries — a student does not study from Lahore and
   * Manila in the same week. Evictions come next: the cap only pushes a device
   * out when a third one signs in, so a steady stream means people are taking
   * turns. Distinct hardware (fingerprints) and IP spread fill in the picture.
   *
   * `minScore` filters the noise; the default surfaces only accounts with at
   * least one real signal.
   */
  async sharingReport(opts?: { minScore?: number; limit?: number }) {
    const minScore = opts?.minScore ?? 2;
    const limit = opts?.limit ?? 200;
    const now = new Date();

    const rows = await this.prisma.userSession.findMany({
      where: { user: { role: Role.CANDIDATE } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        userId: true, deviceId: true, fingerprint: true, label: true, ip: true,
        country: true, city: true, createdAt: true, lastSeenAt: true,
        expiresAt: true, revokedAt: true, revokedReason: true,
        user: { select: { id: true, name: true, email: true, suspendedAt: true } }
      }
    });

    type Acc = {
      userId: string; name: string; email: string; suspended: boolean;
      devices: number; liveDevices: number; evictions: number;
      countries: Set<string>; cities: Set<string>; ips: Set<string>; hardware: Set<string>;
      lastSeenAt: Date;
    };
    const byUser = new Map<string, Acc>();
    for (const r of rows) {
      let a = byUser.get(r.userId);
      if (!a) {
        a = {
          userId: r.userId,
          name: r.user.name,
          email: r.user.email,
          suspended: Boolean(r.user.suspendedAt),
          devices: 0, liveDevices: 0, evictions: 0,
          countries: new Set(), cities: new Set(), ips: new Set(), hardware: new Set(),
          lastSeenAt: r.lastSeenAt
        };
        byUser.set(r.userId, a);
      }
      a.devices += 1;
      if (!r.revokedAt && r.expiresAt > now) a.liveDevices += 1;
      if (r.revokedReason === "device_limit") a.evictions += 1;
      if (r.country) a.countries.add(r.country);
      if (r.city) a.cities.add(r.city);
      if (r.ip) a.ips.add(r.ip);
      if (r.fingerprint) a.hardware.add(r.fingerprint);
      if (r.lastSeenAt > a.lastSeenAt) a.lastSeenAt = r.lastSeenAt;
    }

    const scored = [...byUser.values()].map((a) => {
      const reasons: string[] = [];
      let score = 0;
      if (a.countries.size > 1) {
        score += 4 * (a.countries.size - 1);
        reasons.push(`Signed in from ${a.countries.size} countries (${[...a.countries].join(", ")})`);
      }
      if (a.evictions >= 5) {
        score += 4;
        reasons.push(`${a.evictions} devices pushed out by the 2-device limit`);
      } else if (a.evictions >= 2) {
        score += 2;
        reasons.push(`${a.evictions} devices pushed out by the 2-device limit`);
      }
      if (a.hardware.size > 3) {
        score += 2;
        reasons.push(`${a.hardware.size} different machines`);
      }
      if (a.ips.size > 6) {
        score += 1;
        reasons.push(`${a.ips.size} different IP addresses`);
      }
      if (a.cities.size > 2) {
        score += 1;
        reasons.push(`${a.cities.size} cities (${[...a.cities].slice(0, 4).join(", ")})`);
      }
      return {
        userId: a.userId, name: a.name, email: a.email, suspended: a.suspended,
        devices: a.devices, liveDevices: a.liveDevices, evictions: a.evictions,
        countries: [...a.countries], cities: [...a.cities],
        ipCount: a.ips.size, hardwareCount: a.hardware.size,
        lastSeenAt: a.lastSeenAt.toISOString(),
        score,
        risk: score >= 6 ? "high" : score >= 3 ? "medium" : score > 0 ? "low" : "none",
        reasons
      };
    });

    const flagged = scored.filter((r) => r.score >= minScore).sort((a, b) => b.score - a.score).slice(0, limit);
    return {
      generatedAt: now.toISOString(),
      /** True when no session has ever recorded a country — see the geo note. */
      geoUnavailable: rows.length > 0 && rows.every((r) => !r.country),
      totalAccounts: scored.length,
      flagged
    };
  }

  /**
   * Admin device list for one student. Returns live sessions first, then the
   * history — `evictions` is the number of times the cap pushed a device out,
   * which is the number to look at when you suspect account sharing.
   */
  async listForUser(userId: string) {
    const now = new Date();
    const rows = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: "desc" },
      take: 50
    });
    const sessions = rows.map((r) => ({
      id: r.id,
      label: r.label ?? describeDevice(r.userAgent),
      ip: r.ip,
      country: r.country,
      city: r.city,
      fingerprint: r.fingerprint,
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      revokedAt: r.revokedAt?.toISOString() ?? null,
      revokedReason: r.revokedReason,
      live: !r.revokedAt && r.expiresAt > now
    }));
    return {
      limit: DEVICE_LIMIT,
      liveCount: sessions.filter((s) => s.live).length,
      evictions: rows.filter((r) => r.revokedReason === "device_limit").length,
      sessions
    };
  }
}
