import { Prisma, type TrafficChannel } from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";
import {
  CHANNEL_DISPLAY_ORDER,
  CHANNEL_LABELS,
  classifyTraffic,
  normaliseSignals,
  referrerHost,
  TRAFFIC_CHANNELS,
  UNATTRIBUTED,
  type ReportChannelName,
  type TrafficChannelName,
  type TrafficSignals
} from "./traffic-channel";

/** A gap this long or longer starts a new session for the same browser. */
const SESSION_GAP_MS = 30 * 60 * 1000;

export type VisitInput = TrafficSignals & {
  visitorKey: string;
  landingPath?: string | null;
  userAgent?: string | null;
  country?: string | null;
  /** Set when the ping came from a signed-in browser. */
  userId?: string | null;
};

export type ChannelRow = {
  channel: ReportChannelName;
  label: string;
  visitors: number;
  signups: number;
  buyers: number;
  revenue: number;
  conversationCount: number;
  /** signups ÷ visitors, as a percentage. Null when there were no visitors. */
  signupRate: number | null;
};

export type TrafficSummary = {
  from: string;
  to: string;
  totals: {
    visitors: number;
    pageViews: number;
    signups: number;
    buyers: number;
    revenue: number;
    conversations: number;
  };
  /** Credit given to the channel that FOUND the person. */
  firstTouch: ChannelRow[];
  /** Credit given to the channel of their most recent tagged visit. */
  lastTouch: ChannelRow[];
  /** Per-day visitor counts for the chart, oldest first. */
  daily: Array<{ day: string; visitors: number; signups: number }>;
  topSources: Array<{ source: string; channel: ReportChannelName; visitors: number; signups: number }>;
  topCampaigns: Array<{ campaign: string; visitors: number; signups: number }>;
};

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Prisma.Decimal) return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clip(v: string | null | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/**
 * AttributionService — records where visitors came from and reports on it.
 *
 * Two deliberate choices are worth knowing before changing anything here.
 *
 * FIRST TOUCH IS IMMUTABLE. It is written once, when the browser is first seen,
 * and never again. It answers "which channel found this student", which is the
 * question you spend marketing money against.
 *
 * LAST TOUCH IS ONLY OVERWRITTEN BY AN ATTRIBUTED VISIT. Every internal page
 * view pings this service, and an internal navigation classifies as DIRECT
 * (same-origin referrers are dropped by the client). If DIRECT were allowed to
 * overwrite last touch, the second page anyone opened would erase the channel
 * that brought them, and every report would converge on "Direct". So a DIRECT
 * ping updates the counters and the timestamp, and leaves the attribution alone.
 */
export class AttributionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record one visit. Idempotent per browser: the first call creates the
   * visitor, later calls update counters and (when attributed) last touch.
   */
  async recordVisit(input: VisitInput) {
    const key = clip(input.visitorKey, 64);
    if (!key) return { ok: false as const, reason: "missing visitorKey" };

    const signals = normaliseSignals(input);
    const c = classifyTraffic(signals);
    const landingPath = clip(input.landingPath, 500);
    const host = referrerHost(signals.referrer);
    const now = new Date();

    const existing = await this.prisma.visitor.findUnique({ where: { visitorKey: key } });

    if (!existing) {
      const visitor = await this.prisma.visitor.create({
        data: {
          visitorKey: key,
          firstChannel: c.channel as TrafficChannel,
          firstSource: c.source,
          firstMedium: c.medium,
          firstCampaign: c.campaign,
          firstTerm: clip(signals.utmTerm, 200),
          firstContent: clip(signals.utmContent, 200),
          firstReferrer: clip(signals.referrer, 500),
          firstLandingPath: landingPath,
          firstClickId: clip(signals.clickIdKind, 32),
          lastChannel: c.channel as TrafficChannel,
          lastSource: c.source,
          lastMedium: c.medium,
          lastCampaign: c.campaign,
          lastReferrer: clip(signals.referrer, 500),
          lastLandingPath: landingPath,
          country: clip(input.country, 8),
          userAgent: clip(input.userAgent, 400),
          userId: input.userId ?? null,
          convertedAt: input.userId ? now : null
        }
      });
      return { ok: true as const, visitorId: visitor.id, channel: c.channel, isNew: true };
    }

    const attributed = c.channel !== "DIRECT";
    const newSession = now.getTime() - existing.lastSeenAt.getTime() >= SESSION_GAP_MS;

    const visitor = await this.prisma.visitor.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: now,
        pageViews: { increment: 1 },
        sessions: newSession ? { increment: 1 } : undefined,
        country: clip(input.country, 8) ?? existing.country,
        // Linking a browser to a user is one-way: once we know who this is, a
        // later anonymous ping must not unlink them.
        userId: existing.userId ?? input.userId ?? null,
        convertedAt: existing.convertedAt ?? (input.userId ? now : null),
        ...(attributed
          ? {
              lastChannel: c.channel as TrafficChannel,
              lastSource: c.source,
              lastMedium: c.medium,
              lastCampaign: c.campaign,
              lastReferrer: clip(signals.referrer, 500),
              lastLandingPath: landingPath
            }
          : {})
      }
    });

    void host; // kept for readability of the classification above
    return { ok: true as const, visitorId: visitor.id, channel: c.channel, isNew: false };
  }

  /** The attribution a chat conversation should be stamped with. */
  async signalsForVisitor(visitorKey: string | null | undefined) {
    const key = clip(visitorKey, 64);
    if (!key) return null;
    return this.prisma.visitor.findUnique({
      where: { visitorKey: key },
      select: { id: true, firstChannel: true, firstSource: true, firstCampaign: true, firstLandingPath: true }
    });
  }

  /**
   * Called at sign-up. Links the browser to the new account and copies its
   * FIRST-touch attribution onto the user, which is what every revenue query
   * reads. Never throws into the registration path: a failure to attribute must
   * not be able to fail a registration.
   */
  async attachSignup(visitorKey: string | null | undefined, userId: string): Promise<void> {
    const key = clip(visitorKey, 64);
    if (!key) return;
    try {
      const visitor = await this.prisma.visitor.findUnique({ where: { visitorKey: key } });
      if (!visitor) return;
      await this.prisma.$transaction([
        this.prisma.visitor.update({
          where: { id: visitor.id },
          data: { userId, convertedAt: visitor.convertedAt ?? new Date() }
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: {
            signupChannel: visitor.firstChannel,
            signupSource: visitor.firstSource,
            signupCampaign: visitor.firstCampaign,
            signupLandingPath: visitor.firstLandingPath
          }
        })
      ]);
    } catch {
      /* attribution is reporting, never a blocker on account creation */
    }
  }

  /** Stamp an admin-created account so it never pollutes the acquisition report. */
  async markAdminCreated(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { signupChannel: "ADMIN" } });
    } catch {
      /* reporting only */
    }
  }

  // ---------------------------------------------------------------- reporting

  async summary(opts: { from?: Date; to?: Date } = {}): Promise<TrafficSummary> {
    const to = opts.to ?? new Date();
    const from = opts.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [visitorRows, signupRows, purchaseRows, productRows, convoRows, dailyRows, sourceRows, campaignRows, totals] =
      await Promise.all([
        this.prisma.$queryRaw<Array<{ first: TrafficChannel; last: TrafficChannel; n: bigint }>>`
          SELECT "firstChannel" AS first, "lastChannel" AS last, COUNT(*)::bigint AS n
          FROM "Visitor"
          WHERE "firstSeenAt" >= ${from} AND "firstSeenAt" <= ${to}
          GROUP BY 1, 2`,

        this.prisma.$queryRaw<Array<{ channel: TrafficChannel | null; n: bigint }>>`
          SELECT "signupChannel" AS channel, COUNT(*)::bigint AS n
          FROM "User"
          WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} AND role = 'CANDIDATE'
          GROUP BY 1`,

        // Complete Course purchases.
        this.prisma.$queryRaw<Array<{ channel: TrafficChannel | null; buyers: bigint; revenue: Prisma.Decimal }>>`
          SELECT u."signupChannel" AS channel,
                 COUNT(DISTINCT p."userId")::bigint AS buyers,
                 COALESCE(SUM(p.amount), 0) AS revenue
          FROM "Purchase" p
          JOIN "User" u ON u.id = p."userId"
          WHERE p.status = 'COMPLETED' AND p."completedAt" >= ${from} AND p."completedAt" <= ${to}
          GROUP BY 1`,

        // Standalone product purchases — same funnel, different table.
        this.prisma.$queryRaw<Array<{ channel: TrafficChannel | null; buyers: bigint; revenue: Prisma.Decimal }>>`
          SELECT u."signupChannel" AS channel,
                 COUNT(DISTINCT p."userId")::bigint AS buyers,
                 COALESCE(SUM(p.amount), 0) AS revenue
          FROM "ProductPurchase" p
          JOIN "User" u ON u.id = p."userId"
          WHERE p.status = 'COMPLETED' AND p."completedAt" >= ${from} AND p."completedAt" <= ${to}
          GROUP BY 1`,

        this.prisma.$queryRaw<Array<{ channel: TrafficChannel | null; n: bigint }>>`
          SELECT channel, COUNT(*)::bigint AS n
          FROM "ChatConversation"
          WHERE "startedAt" >= ${from} AND "startedAt" <= ${to}
          GROUP BY 1`,

        this.prisma.$queryRaw<Array<{ day: Date; visitors: bigint }>>`
          SELECT date_trunc('day', "firstSeenAt") AS day, COUNT(*)::bigint AS visitors
          FROM "Visitor"
          WHERE "firstSeenAt" >= ${from} AND "firstSeenAt" <= ${to}
          GROUP BY 1 ORDER BY 1`,

        this.prisma.$queryRaw<Array<{ source: string; channel: TrafficChannel; visitors: bigint }>>`
          SELECT COALESCE("firstSource", '(none)') AS source, "firstChannel" AS channel, COUNT(*)::bigint AS visitors
          FROM "Visitor"
          WHERE "firstSeenAt" >= ${from} AND "firstSeenAt" <= ${to}
          GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15`,

        this.prisma.$queryRaw<Array<{ campaign: string; visitors: bigint }>>`
          SELECT "firstCampaign" AS campaign, COUNT(*)::bigint AS visitors
          FROM "Visitor"
          WHERE "firstSeenAt" >= ${from} AND "firstSeenAt" <= ${to} AND "firstCampaign" IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,

        this.prisma.$queryRaw<Array<{ visitors: bigint; pageviews: bigint }>>`
          SELECT COUNT(*)::bigint AS visitors, COALESCE(SUM("pageViews"), 0)::bigint AS pageviews
          FROM "Visitor"
          WHERE "firstSeenAt" >= ${from} AND "firstSeenAt" <= ${to}`
      ]);

    const dailySignups = await this.prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS n
      FROM "User"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} AND role = 'CANDIDATE'
      GROUP BY 1 ORDER BY 1`;

    const signupsByChannelForSource = await this.prisma.$queryRaw<Array<{ source: string; n: bigint }>>`
      SELECT COALESCE("signupSource", '(none)') AS source, COUNT(*)::bigint AS n
      FROM "User"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} AND role = 'CANDIDATE'
      GROUP BY 1`;

    const signupsByCampaign = await this.prisma.$queryRaw<Array<{ campaign: string; n: bigint }>>`
      SELECT "signupCampaign" AS campaign, COUNT(*)::bigint AS n
      FROM "User"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} AND "signupCampaign" IS NOT NULL
      GROUP BY 1`;

    const blank = (): Omit<ChannelRow, "channel" | "label" | "signupRate"> => ({
      visitors: 0,
      signups: 0,
      buyers: 0,
      revenue: 0,
      conversationCount: 0
    });

    const first = new Map<ReportChannelName, ReturnType<typeof blank>>();
    const last = new Map<ReportChannelName, ReturnType<typeof blank>>();
    const bucket = (m: Map<ReportChannelName, ReturnType<typeof blank>>, k: ReportChannelName) => {
      let row = m.get(k);
      if (!row) {
        row = blank();
        m.set(k, row);
      }
      return row;
    };

    for (const r of visitorRows) {
      bucket(first, r.first as ReportChannelName).visitors += toNumber(r.n);
      bucket(last, r.last as ReportChannelName).visitors += toNumber(r.n);
    }
    // Signups, buyers and revenue are attributed on FIRST touch (that is what is
    // stored on the user). Last touch shows visitor volume only, and the UI says
    // so rather than printing a zero that looks like lost revenue.
    for (const r of signupRows) {
      bucket(first, (r.channel ?? UNATTRIBUTED) as ReportChannelName).signups += toNumber(r.n);
    }
    for (const r of [...purchaseRows, ...productRows]) {
      const row = bucket(first, (r.channel ?? UNATTRIBUTED) as ReportChannelName);
      row.buyers += toNumber(r.buyers);
      row.revenue += toNumber(r.revenue);
    }
    for (const r of convoRows) {
      bucket(first, (r.channel ?? UNATTRIBUTED) as ReportChannelName).conversationCount += toNumber(r.n);
    }

    const rowsOf = (m: Map<ReportChannelName, ReturnType<typeof blank>>): ChannelRow[] =>
      CHANNEL_DISPLAY_ORDER.filter((ch) => m.has(ch)).map((ch) => {
        const r = m.get(ch)!;
        return {
          channel: ch,
          label: CHANNEL_LABELS[ch],
          ...r,
          revenue: Math.round(r.revenue * 100) / 100,
          signupRate: r.visitors > 0 ? Math.round((r.signups / r.visitors) * 1000) / 10 : null
        };
      });

    const signupByDay = new Map(dailySignups.map((r) => [r.day.toISOString().slice(0, 10), toNumber(r.n)]));
    const signupBySource = new Map(signupsByChannelForSource.map((r) => [r.source, toNumber(r.n)]));
    const signupByCampaign = new Map(signupsByCampaign.map((r) => [r.campaign, toNumber(r.n)]));

    const t = totals[0] ?? { visitors: 0n, pageviews: 0n };
    const firstRows = rowsOf(first);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: {
        visitors: toNumber(t.visitors),
        pageViews: toNumber(t.pageviews),
        signups: firstRows.reduce((a, r) => a + r.signups, 0),
        buyers: firstRows.reduce((a, r) => a + r.buyers, 0),
        revenue: Math.round(firstRows.reduce((a, r) => a + r.revenue, 0) * 100) / 100,
        conversations: firstRows.reduce((a, r) => a + r.conversationCount, 0)
      },
      firstTouch: firstRows,
      lastTouch: rowsOf(last),
      daily: dailyRows.map((r) => {
        const day = r.day.toISOString().slice(0, 10);
        return { day, visitors: toNumber(r.visitors), signups: signupByDay.get(day) ?? 0 };
      }),
      topSources: sourceRows.map((r) => ({
        source: r.source,
        channel: r.channel as ReportChannelName,
        visitors: toNumber(r.visitors),
        signups: signupBySource.get(r.source) ?? 0
      })),
      topCampaigns: campaignRows.map((r) => ({
        campaign: r.campaign,
        visitors: toNumber(r.visitors),
        signups: signupByCampaign.get(r.campaign) ?? 0
      }))
    };
  }

  /** Paginated visitor list for the drill-down table. */
  async listVisitors(opts: { channel?: string; converted?: boolean; search?: string; take?: number; skip?: number } = {}) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    const skip = Math.max(opts.skip ?? 0, 0);
    const where: Prisma.VisitorWhereInput = {};
    // Validate against the DATABASE enum, not the report list: UNATTRIBUTED is a
    // reporting bucket and passing it to Prisma would throw.
    if (opts.channel && (TRAFFIC_CHANNELS as readonly string[]).includes(opts.channel)) {
      where.firstChannel = opts.channel as TrafficChannel;
    }
    if (opts.converted === true) where.userId = { not: null };
    if (opts.converted === false) where.userId = null;
    if (opts.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { firstSource: { contains: q, mode: "insensitive" } },
        { firstCampaign: { contains: q, mode: "insensitive" } },
        { firstReferrer: { contains: q, mode: "insensitive" } },
        { firstLandingPath: { contains: q, mode: "insensitive" } },
        { user: { is: { email: { contains: q, mode: "insensitive" } } } },
        { user: { is: { name: { contains: q, mode: "insensitive" } } } }
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.visitor.count({ where }),
      this.prisma.visitor.findMany({
        where,
        orderBy: { firstSeenAt: "desc" },
        take,
        skip,
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
          _count: { select: { conversations: true } }
        }
      })
    ]);

    return {
      total,
      take,
      skip,
      items: rows.map((v) => ({
        id: v.id,
        firstChannel: v.firstChannel,
        firstChannelLabel: CHANNEL_LABELS[v.firstChannel as TrafficChannelName],
        firstSource: v.firstSource,
        firstCampaign: v.firstCampaign,
        firstReferrer: v.firstReferrer,
        firstLandingPath: v.firstLandingPath,
        firstSeenAt: v.firstSeenAt,
        lastChannel: v.lastChannel,
        lastChannelLabel: CHANNEL_LABELS[v.lastChannel as TrafficChannelName],
        lastSeenAt: v.lastSeenAt,
        pageViews: v.pageViews,
        sessions: v.sessions,
        country: v.country,
        conversations: v._count.conversations,
        user: v.user
      }))
    };
  }
}
