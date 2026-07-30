/**
 * SecurityService — exam-integrity: cumulative screenshot-attempt strikes per
 * account. Warn on strikes 1–2, hard-suspend on the 3rd (blocks login until an
 * admin reinstates). Strikes persist across tests/sessions (account-level).
 */
import type { PrismaService } from "../../common/prisma.service";

const STRIKE_LIMIT = 3;

export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Record one screenshot-attempt strike; suspend the account on the 3rd. */
  async recordScreenshotStrike(userId: string, context?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { screenshotStrikes: true, suspendedAt: true }
    });
    if (!existing) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    if (existing.suspendedAt) {
      return { strikes: existing.screenshotStrikes, suspended: true, limit: STRIKE_LIMIT, warningsLeft: 0 };
    }

    const strikes = existing.screenshotStrikes + 1;
    const suspend = strikes >= STRIKE_LIMIT;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        screenshotStrikes: strikes,
        ...(suspend
          ? { suspendedAt: new Date(), suspendedReason: `Repeated screenshot attempts during a test${context ? ` (${context})` : ""}` }
          : {})
      }
    });
    return {
      strikes,
      suspended: suspend,
      limit: STRIKE_LIMIT,
      warningsLeft: Math.max(0, STRIKE_LIMIT - 1 - strikes)
    };
  }

  /** Admin: list suspended candidates. */
  async listSuspended() {
    const rows = await this.prisma.user.findMany({
      where: { suspendedAt: { not: null } },
      select: { id: true, name: true, email: true, screenshotStrikes: true, suspendedAt: true, suspendedReason: true },
      orderBy: { suspendedAt: "desc" }
    });
    return rows.map((r) => ({ ...r, suspendedAt: r.suspendedAt?.toISOString() ?? null }));
  }

  /** Admin: reinstate a suspended account (clears the strike counter). */
  async reinstate(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: null, suspendedReason: null, screenshotStrikes: 0 }
    });
    return { ok: true };
  }

  /** Admin: manually suspend an account. */
  async suspend(userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date(), suspendedReason: reason || "Suspended by an administrator" }
    });
    return { ok: true };
  }
}
